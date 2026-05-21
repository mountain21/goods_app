"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { ArrowLeft, ListChecks, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
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

type Props = {
  goods: Good[];
  event: Event;
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

export function GoodsCalculatorClient({ goods, event }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
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

  const qKey = (goodsId: string, variantId: string | null) =>
    `${goodsId}::${variantId ?? "null"}`;

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
    const next = Math.max(0, Math.min(max, getQuantity(goodsId, variantId) + delta));
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

    try {
      const rawValue = window.localStorage.getItem(
        SELECTED_QUANTITIES_STORAGE_KEY
      );
      if (!rawValue) return;

      const parsed = JSON.parse(rawValue) as StoredQuantities | Record<string, number>;
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
  }, [event.event_id, supabase, toast]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSaveCart = async () => {
    console.log("--- 保存処理スタート ---");
    setIsSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!session?.user || !session.access_token || sessionError) {
        console.error("【認証エラー】セッションが取得できません:", sessionError);
        persistSelectedQuantities();
        setAuthDialogOpen(true);
        alert(
          "ログインセッションが見つかりません。一度ログインしてから再度保存してください。"
        );
        return;
      }

      console.log("現在ログイン中のユーザーUUID:", session.user.id);

      const eventId = event.event_id;
      const eventTitle = event.event_name || "イベント";
      const insertData = {
        user_id: session.user.id,
        event_id: eventId,
        list_name: `${eventTitle}の買い物リスト`,
      };

      console.log("Supabaseに送信する直前のデータ:", insertData);
      console.log("Authorization header will be attached:", {
        hasAccessToken: Boolean(session.access_token),
        tokenPrefix: session.access_token.slice(0, 12),
      });

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

      const { data: listData, error: listError } = await authedSupabase
        .from("shopping_list")
        .insert([insertData])
        .select();

      if (listError) {
        console.error("shopping_listへのインサートに失敗しました。");
        console.error("エラーコード(code):", listError.code);
        console.error("メッセージ(message):", listError.message);
        console.error("エラー詳細(details):", listError.details);
        console.error("ヒント(hint):", listError.hint);
        alert(`保存失敗: ${listError.message} (詳細はコンソールを確認してください)`);
        return;
      }

      console.log("shopping_listへのインサート成功。返ってきたデータ:", listData);

      const insertedList = (listData as Array<ShoppingListInsertResult> | null)?.[0];
      const insertedListId = insertedList?.id || insertedList?.shopping_list_id;

      if (!insertedListId) {
        console.error("shopping_listのIDを取得できませんでした。返却データ:", listData);
        alert("保存失敗: 買い物リストIDを取得できませんでした。");
        return;
      }

      console.log("list_itemに紐づける親リストID:", insertedListId);

      const itemsToInsert: ListItemInsertRow[] = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const [goodsId, variantIdValue] = itemId.split("::");
          return {
            list_id: insertedListId,
            goods_id: goodsId,
            variant_id: variantIdValue === "null" ? null : variantIdValue,
            quantity: qty,
          };
        });

      console.log("list_itemに送信する直前のデータ:", itemsToInsert);

      if (itemsToInsert.length > 0) {
        const { error: itemError } = await authedSupabase
          .from("list_item")
          .insert(itemsToInsert);

        if (itemError) {
          console.error("list_itemへのインサートに失敗しました。");
          console.error("エラーコード(code):", itemError.code);
          console.error("メッセージ(message):", itemError.message);
          console.error("エラー詳細(details):", itemError.details);
          console.error("ヒント(hint):", itemError.hint);
          alert(`保存失敗: ${itemError.message} (詳細はコンソールを確認してください)`);
          return;
        }
      }

      console.log("list_itemへのインサート成功:", itemsToInsert);
      window.localStorage.removeItem(SELECTED_QUANTITIES_STORAGE_KEY);
      alert("お買い物リストを保存しました！");
      router.push("/shopping-list");
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
        title: authMode === "signin" ? "ログインに失敗しました" : "登録に失敗しました",
        description:
          error instanceof Error ? error.message : "認証処理に失敗しました",
        variant: "destructive",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleImageSaveClick = () => {
    toast({ title: "画像保存機能は準備中です" });
  };

  const userName =
    user?.user_metadata?.username ?? user?.email ?? user?.id ?? undefined;

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-4">
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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            イベントグッズ計算
          </h1>
          <div className="space-y-1 text-sm text-slate-600">
            <div>
              {event.artist_name} / {event.event_name}
            </div>
            <div>
              {new Date(event.event_start_date).toLocaleDateString("ja-JP")} -{" "}
              {new Date(event.event_end_date).toLocaleDateString("ja-JP")}
            </div>
            {user ? <div>ようこそ、{String(userName)}さん！</div> : null}
          </div>
        </div>
      </header>

      <div id="shopping-list-capture-area" className="space-y-4">
        {goods.map((good) => (
          <Card key={good.goods_id} className="p-3">
            <CardHeader className="p-0">
              <div className="flex items-start gap-3">
                {good.image_url ? (
                  <img
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
                          onClick={() => bump(good.goods_id, variant.variant_id, -1)}
                        >
                          -
                        </Button>
                        <div className="w-8 text-center text-sm font-medium">
                          {getQuantity(good.goods_id, variant.variant_id)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => bump(good.goods_id, variant.variant_id, 1)}
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
                      onClick={() => bump(good.goods_id, null, -1)}
                    >
                      -
                    </Button>
                    <div className="w-8 text-center text-sm font-medium">
                      {getQuantity(good.goods_id, null)}
                    </div>
                    <Button size="sm" onClick={() => bump(good.goods_id, null, 1)}>
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
                <div className="text-xs font-medium text-slate-500">合計点数</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-950">
                    {totals.totalItems}
                  </span>
                  <span className="text-sm font-medium text-slate-600">点</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">合計金額</div>
                <div className="mt-1 text-2xl font-bold leading-none text-slate-950">
                  {formatYen(totals.totalAmount)}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 w-full text-base font-semibold sm:w-auto"
                onClick={handleImageSaveClick}
              >
                画像として保存
              </Button>
              <Button
                className="h-11 w-full text-base font-semibold sm:w-auto"
                onClick={handleSaveCart}
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : "保存する"}
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
