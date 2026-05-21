"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { ArrowLeft, Download, ListChecks, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import {
  ExportListImage,
  type ExportListImageData,
} from "@/components/ExportListImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { downloadElementAsImage } from "@/utils/imageExport";

const DUMMY_AUTH_DOMAIN = "mountainorg.exampledummy.com";
const SELECTED_QUANTITIES_STORAGE_KEY = "goods-calculator:selectedQuantities";

type GoodsVariant = {
  variant_id: string;
  goods_id: string;
  variant_name: string;
};

type Good = {
  goods_id: string;
  event_id: string;
  item_name: string;
  price: number;
  image_url?: string | null;
  max_quantity: number;
  has_variants: boolean;
  variants?: GoodsVariant[];
};

type Event = {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
};

type StoredQuantities = {
  event_id?: string;
  quantities?: Record<string, number>;
};

type ShoppingListInsertResult = {
  id?: string;
  shopping_list_id?: string;
};

type ListItemInsertRow = {
  list_id: string;
  goods_id: string;
  variant_id: string | null;
  quantity: number;
};

type ExistingListItemRow = {
  item_id: string;
  goods_id?: string | null;
  variant_id?: string | null;
  quantity: number | null;
};

type Props = {
  goods: Good[];
  event: Event;
  initialListId?: string | null;
};

function createDummyEmail(userName: string) {
  return `${userName.trim()}@${DUMMY_AUTH_DOMAIN}`;
}

function formatYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function isQuantitiesRecord(value: unknown): value is Record<string, number> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.values(value as Record<string, unknown>).every(
      (quantity) => typeof quantity === "number"
    )
  );
}

function qKey(goodsId: string, variantId: string | null) {
  return `${goodsId}::${variantId ?? "null"}`;
}

export function GoodsCalculatorClient({
  goods,
  event,
  initialListId,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isLoadingExistingList, setIsLoadingExistingList] = useState(
    Boolean(initialListId)
  );
  const [user, setUser] = useState<User | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authUserName, setAuthUserName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const goodsById = useMemo(
    () => new Map(goods.map((good) => [good.goods_id, good])),
    [goods]
  );

  const getQuantity = (goodsId: string, variantId: string | null) =>
    quantities[qKey(goodsId, variantId)] ?? 0;

  const setQuantity = (
    goodsId: string,
    variantId: string | null,
    value: number
  ) => {
    setQuantities((prev) => {
      const key = qKey(goodsId, variantId);
      const next = { ...prev };

      if (value <= 0) {
        delete next[key];
      } else {
        next[key] = value;
      }

      return next;
    });
  };

  const bump = (goodsId: string, variantId: string | null, delta: number) => {
    const good = goodsById.get(goodsId);
    const max = good?.max_quantity ?? 9999;
    const next = Math.max(
      0,
      Math.min(max, getQuantity(goodsId, variantId) + delta)
    );
    setQuantity(goodsId, variantId, next);
  };

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalAmount = 0;

    for (const [key, quantity] of Object.entries(quantities)) {
      if (quantity <= 0) continue;
      const [goodsId] = key.split("::");
      const good = goodsById.get(goodsId);
      totalItems += quantity;
      totalAmount += (good?.price ?? 0) * quantity;
    }

    return { totalItems, totalAmount };
  }, [goodsById, quantities]);

  const exportImageData = useMemo<ExportListImageData>(() => {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([key, quantity]) => {
        const [goodsId, variantIdValue] = key.split("::");
        const good = goodsById.get(goodsId);
        const variant =
          variantIdValue === "null"
            ? null
            : good?.variants?.find(
                (variantItem) => variantItem.variant_id === variantIdValue
              );

        return {
          name: variant
            ? `${good?.item_name ?? "商品"} / ${variant.variant_name}`
            : good?.item_name ?? "商品",
          quantity,
          unitPrice: good?.price ?? 0,
        };
      });

    return {
      title: event.event_name || "買い物リスト",
      totalItems: totals.totalItems,
      totalAmount: totals.totalAmount,
      items,
    };
  }, [event.event_name, goodsById, quantities, totals.totalAmount, totals.totalItems]);

  const persistSelectedQuantities = () => {
    window.localStorage.setItem(
      SELECTED_QUANTITIES_STORAGE_KEY,
      JSON.stringify({
        event_id: event.event_id,
        quantities,
      } satisfies StoredQuantities)
    );
  };

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("initial auth session error:", error);
      }
      setUser(data.session?.user ?? null);
    });

    if (initialListId) return;

    try {
      const rawValue = window.localStorage.getItem(
        SELECTED_QUANTITIES_STORAGE_KEY
      );
      if (!rawValue) return;

      const parsed = JSON.parse(rawValue) as
        | StoredQuantities
        | Record<string, number>;
      const restoredQuantities =
        "quantities" in parsed ? parsed.quantities : parsed;
      const storedEventId = "event_id" in parsed ? parsed.event_id : undefined;

      if (
        isQuantitiesRecord(restoredQuantities) &&
        (!storedEventId || storedEventId === event.event_id)
      ) {
        window.setTimeout(() => {
          setQuantities(restoredQuantities);
          toast({ title: "保存していた選択内容を復元しました" });
        }, 0);
      }

      window.localStorage.removeItem(SELECTED_QUANTITIES_STORAGE_KEY);
    } catch (error) {
      console.error("restore selected quantities error:", error);
      window.localStorage.removeItem(SELECTED_QUANTITIES_STORAGE_KEY);
    }
  }, [event.event_id, initialListId, supabase, toast]);

  useEffect(() => {
    if (!initialListId) {
      return;
    }

    let cancelled = false;

    const loadExistingList = async () => {
      setIsLoadingExistingList(true);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw new Error("ログイン状態を確認できませんでした。");
        }

        const { data: listData, error: listError } = await supabase
          .from("shopping_list")
          .select("shopping_list_id,event_id,user_id")
          .eq("shopping_list_id", initialListId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (listError) throw listError;
        if (!listData) {
          throw new Error("編集対象の買い物リストが見つかりませんでした。");
        }
        if (listData.event_id !== event.event_id) {
          throw new Error("買い物リストとイベントの紐づきが一致しません。");
        }

        const { data: itemData, error: itemError } = await supabase
          .from("list_item")
          .select("item_id,goods_id,variant_id,quantity")
          .eq("list_id", initialListId);

        if (itemError) throw itemError;

        const restoredQuantities = (
          (itemData ?? []) as ExistingListItemRow[]
        ).reduce<Record<string, number>>((next, item) => {
          const goodsId = item.goods_id ?? item.item_id;
          const quantity = item.quantity ?? 0;

          if (goodsId && quantity > 0) {
            next[qKey(goodsId, item.variant_id ?? null)] = quantity;
          }

          return next;
        }, {});

        if (!cancelled) {
          setQuantities(restoredQuantities);
          toast({ title: "買い物リストを編集用に読み込みました" });
        }
      } catch (error) {
        console.error("load existing shopping list error:", error);
        if (!cancelled) {
          toast({
            title: "買い物リストの読み込みに失敗しました",
            description:
              error instanceof Error
                ? error.message
                : "編集データを取得できませんでした",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExistingList(false);
        }
      }
    };

    void loadExistingList();

    return () => {
      cancelled = true;
    };
  }, [event.event_id, initialListId, supabase, toast]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSaveCart = async () => {
    setIsSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!session?.user || !session.access_token || sessionError) {
        console.error("auth session error:", sessionError);
        persistSelectedQuantities();
        setAuthDialogOpen(true);
        alert("ログイン後にもう一度保存してください。");
        return;
      }

      const authedSupabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        }
      );

      const eventTitle = event.event_name || "イベント";
      const listPayload = {
        user_id: session.user.id,
        event_id: event.event_id,
        list_name: `${eventTitle}の買い物リスト`,
      };

      let savedListId = initialListId ?? null;

      if (savedListId) {
        const { data: updatedRows, error: updateError } = await authedSupabase
          .from("shopping_list")
          .update(listPayload)
          .eq("shopping_list_id", savedListId)
          .eq("user_id", session.user.id)
          .select("shopping_list_id");

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length !== 1) {
          throw new Error("更新対象の買い物リストを確認できませんでした。");
        }

        const { error: deleteItemsError } = await authedSupabase
          .from("list_item")
          .delete()
          .eq("list_id", savedListId);

        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data: listData, error: listError } = await authedSupabase
          .from("shopping_list")
          .insert([listPayload])
          .select();

        if (listError) throw listError;

        const insertedList = (
          listData as Array<ShoppingListInsertResult> | null
        )?.[0];
        savedListId = insertedList?.id || insertedList?.shopping_list_id || null;

        if (!savedListId) {
          throw new Error("買い物リストIDを取得できませんでした。");
        }
      }

      const itemsToInsert: ListItemInsertRow[] = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const [goodsId, variantIdValue] = itemId.split("::");
          return {
            list_id: savedListId,
            goods_id: goodsId,
            variant_id: variantIdValue === "null" ? null : variantIdValue,
            quantity: qty,
          };
        });

      if (itemsToInsert.length > 0) {
        const { error: itemError } = await authedSupabase
          .from("list_item")
          .insert(itemsToInsert);

        if (itemError) throw itemError;
      }

      window.localStorage.removeItem(SELECTED_QUANTITIES_STORAGE_KEY);
      alert(
        initialListId
          ? "買い物リストを更新しました。"
          : "買い物リストを保存しました。"
      );
      router.push("/shopping-list");
    } catch (error) {
      console.error("save shopping list error:", error);
      alert(
        `保存に失敗しました: ${
          error instanceof Error ? error.message : "不明なエラーが発生しました"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogAuth = async () => {
    setAuthBusy(true);

    try {
      const trimmedUserName = authUserName.trim();
      if (!trimmedUserName || !authPassword) {
        throw new Error("ユーザー名とパスワードを入力してください");
      }

      persistSelectedQuantities();
      const dummyEmail = createDummyEmail(trimmedUserName);

      const { data, error } =
        authMode === "signin"
          ? await supabase.auth.signInWithPassword({
              email: dummyEmail,
              password: authPassword,
            })
          : await supabase.auth.signUp({
              email: dummyEmail,
              password: authPassword,
              options: {
                data: {
                  username: trimmedUserName,
                },
              },
            });

      if (error) throw error;
      setUser(data.session?.user ?? data.user ?? null);
      setAuthDialogOpen(false);
      toast({ title: "ログインしました。もう一度保存してください" });
    } catch (error) {
      console.error("auth dialog error:", error);
      toast({
        title:
          authMode === "signin"
            ? "ログインに失敗しました"
            : "登録に失敗しました",
        description:
          error instanceof Error ? error.message : "認証処理に失敗しました",
        variant: "destructive",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleImageSaveClick = async () => {
    if (isSavingImage) return;

    setIsSavingImage(true);

    try {
      await downloadElementAsImage(
        exportImageData,
        <ExportListImage data={exportImageData} />
      );
    } catch (error) {
      console.error("save shopping list image error:", error);
      toast({
        title: "画像保存に失敗しました",
        description:
          error instanceof Error ? error.message : "画像の作成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSavingImage(false);
    }
  };

  const userName =
    user?.user_metadata?.username ?? user?.email ?? user?.id ?? undefined;

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full justify-start sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ホームに戻る
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full justify-start sm:w-auto"
          >
            <Link href="/shopping-list">
              <ListChecks className="mr-2 h-4 w-4" />
              買い物リストへ
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            {initialListId ? "買い物リストを編集" : "イベントグッズ計算"}
          </h1>
          <div className="space-y-1 text-sm text-slate-600">
            <div>
              {event.artist_name} / {event.event_name}
            </div>
            <div>
              {new Date(event.event_start_date).toLocaleDateString("ja-JP")} -{" "}
              {new Date(event.event_end_date).toLocaleDateString("ja-JP")}
            </div>
            {user ? <div>ようこそ、{String(userName)}さん</div> : null}
          </div>
        </div>
      </header>

      {isLoadingExistingList ? (
        <Card>
          <CardContent className="p-4 text-sm text-slate-600">
            編集データを読み込み中...
          </CardContent>
        </Card>
      ) : null}

      <div id="shopping-list-capture-area" className="space-y-4">
        {goods.map((good) => (
          <Card key={good.goods_id} className="p-3">
            <CardHeader className="p-0">
              <div className="flex items-start gap-3">
                {good.image_url ? (
                  <img
                    crossOrigin="anonymous"
                    src={good.image_url}
                    alt={good.item_name}
                    className="h-20 w-20 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base font-medium text-slate-900">
                    {good.item_name}
                  </CardTitle>
                  <div className="mt-1 text-sm text-slate-600">
                    {formatYen(good.price)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-3">
              {good.has_variants && good.variants?.length ? (
                <div className="flex flex-col gap-2">
                  {good.variants.map((variant) => (
                    <div
                      key={variant.variant_id}
                      className="flex min-h-10 items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 truncate text-sm text-slate-800">
                        {variant.variant_name}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-html2canvas-ignore="true"
                          onClick={() =>
                            bump(good.goods_id, variant.variant_id, -1)
                          }
                          disabled={isLoadingExistingList}
                        >
                          -
                        </Button>
                        <div className="w-8 text-center text-sm font-medium">
                          {getQuantity(good.goods_id, variant.variant_id)}
                        </div>
                        <Button
                          size="sm"
                          data-html2canvas-ignore="true"
                          onClick={() =>
                            bump(good.goods_id, variant.variant_id, 1)
                          }
                          disabled={isLoadingExistingList}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-10 items-center justify-between gap-3">
                  <div className="text-sm text-slate-800">数量</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-html2canvas-ignore="true"
                      onClick={() => bump(good.goods_id, null, -1)}
                      disabled={isLoadingExistingList}
                    >
                      -
                    </Button>
                    <div className="w-8 text-center text-sm font-medium">
                      {getQuantity(good.goods_id, null)}
                    </div>
                    <Button
                      size="sm"
                      data-html2canvas-ignore="true"
                      onClick={() => bump(good.goods_id, null, 1)}
                      disabled={isLoadingExistingList}
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="sticky bottom-3 z-10 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-lg backdrop-blur md:static md:shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  合計点数
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-950">
                    {totals.totalItems}
                  </span>
                  <span className="text-sm font-medium text-slate-600">点</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">
                  合計金額
                </div>
                <div className="mt-1 text-2xl font-bold leading-none text-slate-950">
                  {formatYen(totals.totalAmount)}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                data-html2canvas-ignore="true"
                className="h-11 w-full text-base font-semibold sm:w-auto"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  console.log("Save button triggered");
                  event.preventDefault();
                  event.stopPropagation();
                  void handleImageSaveClick();
                }}
                disabled={isSavingImage}
              >
                <Download className="h-4 w-4" />
                {isSavingImage ? "画像保存中..." : "画像として保存"}
              </Button>
              <Button
                data-html2canvas-ignore="true"
                className="h-11 w-full text-base font-semibold sm:w-auto"
                onClick={handleSaveCart}
                disabled={isSaving || isLoadingExistingList}
              >
                {isSaving
                  ? initialListId
                    ? "更新中..."
                    : "保存中..."
                  : initialListId
                    ? "更新する"
                    : "保存する"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ログインが必要です</DialogTitle>
            <DialogDescription>
              選択内容を保持したまま保存するには、ログインまたはアカウント登録を行ってください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <Button
                type="button"
                variant={authMode === "signin" ? "default" : "ghost"}
                onClick={() => setAuthMode("signin")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                ログイン
              </Button>
              <Button
                type="button"
                variant={authMode === "signup" ? "default" : "ghost"}
                onClick={() => setAuthMode("signup")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                登録
              </Button>
            </div>
            <Input
              value={authUserName}
              onChange={(event) => setAuthUserName(event.target.value)}
              placeholder="ユーザー名"
              autoComplete="username"
            />
            <Input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="パスワード"
              autoComplete={
                authMode === "signin" ? "current-password" : "new-password"
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                persistSelectedQuantities();
                router.push("/");
              }}
            >
              ホームへ戻る
            </Button>
            <Button onClick={handleDialogAuth} disabled={authBusy}>
              {authBusy
                ? "処理中..."
                : authMode === "signin"
                  ? "ログイン"
                  : "アカウント登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
