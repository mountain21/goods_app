"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, ListChecks, LogIn, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/client";

type ShoppingListRow = {
  shopping_list_id: string;
  user_id?: string | null;
  event_id?: string | null;
  list_name?: string | null;
  created_at?: string | null;
};

type ListItemRow = {
  item_id: string;
  list_id: string;
  goods_id?: string | null;
  variant_id?: string | null;
  quantity: number | null;
};

type GoodsRow = {
  goods_id: string;
  item_name: string;
  price: number | null;
};

type SavedList = {
  shopping_list_id: string;
  list_name: string;
  created_at: string | null;
  total_items: number;
  total_amount: number;
  preview_items: Array<{
    id: string;
    name: string;
  }>;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const supabaseError = error as SupabaseLikeError;
    return (
      supabaseError.message ||
      supabaseError.details ||
      supabaseError.hint ||
      "処理に失敗しました"
    );
  }
  return String(error);
}

function logError(label: string, error: unknown) {
  console.error(label);
  console.error("エラー詳細:", error);
  console.dir(error);
}

function formatYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

export default function ShoppingListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSavedLists = useCallback(
    async (userId: string) => {
      setLoading(true);
      setMessage(null);

      try {
        const { data: listsData, error: listsError } = await supabase
          .from("shopping_list")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (listsError) throw listsError;

        const lists = (listsData ?? []) as unknown as ShoppingListRow[];
        const listIds = lists.map((list) => list.shopping_list_id);

        let listItems: ListItemRow[] = [];
        if (listIds.length > 0) {
          const { data: itemData, error: itemError } = await supabase
            .from("list_item")
            .select("item_id,list_id,goods_id,variant_id,quantity")
            .in("list_id", listIds);

          if (itemError) throw itemError;
          listItems = (itemData ?? []) as unknown as ListItemRow[];
        }

        const itemIds = Array.from(
          new Set(
            listItems
              .map((item) => item.goods_id ?? item.item_id)
              .filter(Boolean)
          )
        );

        let goodsRows: GoodsRow[] = [];
        if (itemIds.length > 0) {
          const { data: goodsData, error: goodsError } = await supabase
            .from("goods")
            .select("goods_id,item_name,price")
            .in("goods_id", itemIds);

          if (goodsError) throw goodsError;
          goodsRows = (goodsData ?? []) as unknown as GoodsRow[];
        }

        const itemsByListId = new Map<string, ListItemRow[]>();
        for (const item of listItems) {
          const currentItems = itemsByListId.get(item.list_id) ?? [];
          currentItems.push(item);
          itemsByListId.set(item.list_id, currentItems);
        }

        const goodsById = new Map(
          goodsRows.map((goodsItem) => [goodsItem.goods_id, goodsItem])
        );

        const normalizedLists = lists.map((list): SavedList => {
          const items = itemsByListId.get(list.shopping_list_id) ?? [];
          const totalItems = items.reduce(
            (sum, item) => sum + (item.quantity ?? 0),
            0
          );
          const totalAmount = items.reduce((sum, item) => {
            const goodsItem = goodsById.get(item.goods_id ?? item.item_id);
            const price = goodsItem?.price ?? 0;
            const quantity = item.quantity ?? 0;
            return sum + price * quantity;
          }, 0);
          const previewItems = items
            .map((item) => {
              const goodsId = item.goods_id ?? item.item_id;
              const name = goodsById.get(goodsId)?.item_name;

              if (!name) return null;

              return {
                id: item.item_id || `${item.list_id}:${goodsId}:${item.variant_id ?? "no-variant"}`,
                name,
              };
            })
            .filter((item): item is { id: string; name: string } => Boolean(item))
            .slice(0, 3);

          return {
            shopping_list_id: list.shopping_list_id,
            list_name: list.list_name ?? "マイリスト",
            created_at: list.created_at ?? null,
            total_items: totalItems,
            total_amount: totalAmount,
            preview_items: previewItems,
          };
        });

        setSavedLists(normalizedLists);
      } catch (error) {
        logError("fetch shopping lists error", error);
        setMessage(`買い物リストの取得に失敗しました: ${getErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          logError("getSession error", error);
          setMessage(`ログイン状態の確認に失敗しました: ${getErrorMessage(error)}`);
        }

        setSession(data.session);
        setAuthLoading(false);
        if (data.session?.user) {
          void loadSavedLists(data.session.user.id);
        }
      });
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (nextSession?.user) {
        void loadSavedLists(nextSession.user.id);
      } else {
        setSavedLists([]);
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadSavedLists, supabase]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-4">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full justify-start sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ホームに戻る
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              買い物リスト
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              保存したリストの合計点数と合計金額を確認できます。
            </p>
          </div>
        </header>

        {message ? (
          <Card>
            <CardContent className="p-4 text-sm text-slate-700">
              {message}
            </CardContent>
          </Card>
        ) : null}

        {authLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">
              ログイン状態を確認中...
            </CardContent>
          </Card>
        ) : !session?.user ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-white p-2 text-slate-900 shadow-sm">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-950">
                    保存したリストを見るにはログインしてください
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    ホーム画面からログインすると、保存済みの買い物リストを確認できます。
                  </p>
                </div>
              </div>
              <Button onClick={() => router.push("/")} className="w-full sm:w-auto">
                <LogIn />
                ホームでログインする
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  保存済みリスト
                </h2>
                <p className="text-sm text-slate-600">
                  各リストの金額は、保存された数量とグッズ単価から計算しています。
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void loadSavedLists(session.user.id)}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
                更新
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : savedLists.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-slate-600">
                  保存済みの買い物リストはありません。
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {savedLists.map((list) => (
                  <Card key={list.shopping_list_id} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">
                            {list.list_name}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {formatDateTime(list.created_at)}
                          </div>
                          {list.preview_items.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {list.preview_items.map((item) => (
                                <Badge key={item.id} variant="secondary">
                                  {item.name}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:min-w-52">
                          <div>
                            <div className="text-xs font-medium text-slate-500">
                              合計点数
                            </div>
                            <div className="mt-1 text-xl font-bold text-slate-950">
                              {list.total_items}点
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-500">
                              合計金額
                            </div>
                            <div className="mt-1 text-xl font-bold text-slate-950">
                              {formatYen(list.total_amount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
