"use client";

/* eslint-disable @next/next/no-img-element */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ChevronDown,
  ImageIcon,
  ListChecks,
  LogIn,
  Pencil,
  RefreshCw,
  Trash2,
  UserPlus,
  LogOut
} from "lucide-react";
import { useRouter } from "next/navigation";
import pencilIcon from "./pencil.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type EventRow = {
  event_id: string;
  artist_name: string | null;
  event_name: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  image_url: string | null;
};

type SavedListItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

type SavedList = {
  shopping_list_id: string;
  event_id: string | null;
  list_name: string;
  created_at: string | null;
  event: EventRow | null;
  total_items: number;
  total_amount: number;
  items: SavedListItem[];
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function createDummyEmail(userName: string) {
  return `${userName.trim()}@mountainorg.exampledummy.com`;
}

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

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

function getEventTitle(event: EventRow | null) {
  if (!event) return "イベント未設定";
  if (event.artist_name && event.event_name) {
    return `${event.artist_name} / ${event.event_name}`;
  }
  return event.event_name || event.artist_name || "イベント未設定";
}

export default function ShoppingListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authUserName, setAuthUserName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [openListIds, setOpenListIds] = useState<Record<string, boolean>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [savingNameListId, setSavingNameListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (mode: "signin" | "signup") => {
    setAuthMessage(null);
    const trimmedUserName = authUserName.trim();

    if (!trimmedUserName) {
      setAuthMessage("ユーザー名を入力してください。");
      return;
    }

    if (!authPassword) {
      setAuthMessage("パスワードを入力してください。");
      return;
    }

    if (mode === "signup" && authPassword.length < 6) {
      setAuthMessage("パスワードは6文字以上で入力してください。");
      return;
    }

    setAuthBusy(true);
    setMessage(null);

    try {
      const dummyEmail = createDummyEmail(trimmedUserName);
      const { data, error } =
        mode === "signin"
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

      if (error) {
        const normalized = error.message ?? String(error);
        if (
          mode === "signup" &&
          /duplicate|already|既に|登録済み/.test(normalized)
        ) {
          setAuthMessage("そのユーザー名はすでに使われています。");
          return;
        }
        setAuthMessage(getErrorMessage(error));
        return;
      }

      setMessage(mode === "signin" ? "ログインしました。" : "登録しました。" );
      setAuthMessage(null);
      setAuthUserName("");
      setAuthPassword("");
    } catch (error) {
      logError("auth error", error);
      setAuthMessage(getErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      logError('logout error', error);
      setMessage(`ログアウトに失敗しました: ${getErrorMessage(error)}`);
      setIsLoggingOut(false);
    }
  };

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
        const eventIds = Array.from(
          new Set(
            lists
              .map((list) => list.event_id)
              .filter((eventId): eventId is string => Boolean(eventId))
          )
        );

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
              .filter((itemId): itemId is string => Boolean(itemId))
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

        let eventRows: EventRow[] = [];
        if (eventIds.length > 0) {
          const { data: eventsData, error: eventsError } = await supabase
            .from("events")
            .select(
              "event_id,artist_name,event_name,event_start_date,event_end_date,image_url"
            )
            .in("event_id", eventIds);

          if (eventsError) throw eventsError;
          eventRows = (eventsData ?? []) as unknown as EventRow[];
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
        const eventById = new Map(
          eventRows.map((eventItem) => [eventItem.event_id, eventItem])
        );

        const normalizedLists = lists.map((list): SavedList => {
          const items = itemsByListId.get(list.shopping_list_id) ?? [];
          const detailItems = items
            .map((item) => {
              const goodsId = item.goods_id ?? item.item_id;
              const goodsItem = goodsById.get(goodsId);
              const quantity = item.quantity ?? 0;

              if (!goodsItem || quantity <= 0) return null;

              return {
                id:
                  item.item_id ||
                  `${item.list_id}:${goodsId}:${item.variant_id ?? "no-variant"}`,
                name: goodsItem.item_name,
                quantity,
                unit_price: goodsItem.price ?? 0,
              };
            })
            .filter((item): item is SavedListItem => Boolean(item));

          const totalItems = detailItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          );
          const totalAmount = detailItems.reduce(
            (sum, item) => sum + item.unit_price * item.quantity,
            0
          );

          return {
            shopping_list_id: list.shopping_list_id,
            event_id: list.event_id ?? null,
            list_name: list.list_name ?? "マイリスト",
            created_at: list.created_at ?? null,
            event: list.event_id ? eventById.get(list.event_id) ?? null : null,
            total_items: totalItems,
            total_amount: totalAmount,
            items: detailItems,
          };
        });

        setSavedLists(normalizedLists);
      } catch (error) {
        logError("fetch shopping lists error", error);
        setMessage(
          `買い物リストの取得に失敗しました: ${getErrorMessage(error)}`
        );
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
          setMessage(
            `ログイン状態の確認に失敗しました: ${getErrorMessage(error)}`
          );
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
        setOpenListIds({});
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadSavedLists, supabase]);

  useEffect(() => {
    if (!editingListId) return;

    window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, [editingListId]);

  const toggleListOpen = (listId: string) => {
    setOpenListIds((current) => ({
      ...current,
      [listId]: !current[listId],
    }));
  };

  const startEditingListName = (list: SavedList) => {
    setMessage(null);
    setEditingListId(list.shopping_list_id);
    setEditingListName(list.list_name);
  };

  const cancelEditingListName = () => {
    setEditingListId(null);
    setEditingListName("");
  };

  const saveListName = async (list: SavedList) => {
    if (savingNameListId === list.shopping_list_id) return;

    const nextName = editingListName.trim();
    if (!nextName) {
      setMessage("買い物リスト名を入力してください。");
      return;
    }

    if (nextName === list.list_name) {
      cancelEditingListName();
      return;
    }

    setSavingNameListId(list.shopping_list_id);
    setMessage(null);

    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!currentSession?.user) {
        throw new Error("ログイン状態を確認できませんでした。再ログインしてください。");
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("shopping_list")
        .update({ list_name: nextName })
        .eq("shopping_list_id", list.shopping_list_id)
        .eq("user_id", currentSession.user.id)
        .select("shopping_list_id,list_name");

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("更新対象の買い物リストを確認できませんでした。");
      }

      setSavedLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.shopping_list_id === list.shopping_list_id
            ? { ...currentList, list_name: nextName }
            : currentList
        )
      );
      cancelEditingListName();
      setMessage("買い物リスト名を更新しました。");
    } catch (error) {
      logError("update shopping list name error", error);
      setMessage(`買い物リスト名の更新に失敗しました: ${getErrorMessage(error)}`);
    } finally {
      setSavingNameListId(null);
    }
  };

  const handleEditList = (list: SavedList) => {
    if (!list.event_id) {
      setMessage("この買い物リストにはイベントが紐づいていないため編集できません。");
      return;
    }

    const params = new URLSearchParams({
      event_id: list.event_id,
      list_id: list.shopping_list_id,
    });
    router.push(`/goods-calculator?${params.toString()}`);
  };

  const handleDeleteList = async (list: SavedList) => {
    if (deletingListId) return;

    const confirmed = window.confirm(
      `「${list.list_name}」を削除します。この操作は元に戻せません。`
    );
    if (!confirmed) return;

    setDeletingListId(list.shopping_list_id);
    setMessage(null);

    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!currentSession?.user) {
        throw new Error("ログイン状態を確認できませんでした。再ログインしてください。");
      }

      const { error: itemDeleteError } = await supabase
        .from("list_item")
        .delete()
        .eq("list_id", list.shopping_list_id);

      if (itemDeleteError) throw itemDeleteError;

      const { data: deletedRows, error: listDeleteError } = await supabase
        .from("shopping_list")
        .delete()
        .eq("shopping_list_id", list.shopping_list_id)
        .eq("user_id", currentSession.user.id)
        .select("shopping_list_id");

      if (listDeleteError) throw listDeleteError;
      if (!deletedRows || deletedRows.length !== 1) {
        throw new Error(
          "削除対象の買い物リストを確認できませんでした。画面を更新して状態を確認してください。"
        );
      }

      setSavedLists((currentLists) =>
        currentLists.filter(
          (currentList) =>
            currentList.shopping_list_id !== list.shopping_list_id
        )
      );
      setOpenListIds((current) => {
        const next = { ...current };
        delete next[list.shopping_list_id];
        return next;
      });
      setMessage("買い物リストを削除しました。");
    } catch (error) {
      logError("delete shopping list error", error);
      setMessage(`買い物リストの削除に失敗しました: ${getErrorMessage(error)}`);
    } finally {
      setDeletingListId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
              保存済みリストの概要を確認し、必要なリストだけ詳細を開けます。
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
                    買い物リスト画面からログインまたは登録してください
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    この画面は認証のゲートウェイです。ログイン後に保存済みリストを確認できます。
                  </p>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                  <Button
                    type="button"
                    variant={authMode === "signin" ? "default" : "ghost"}
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthMessage(null);
                    }}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    ログイン
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "signup" ? "default" : "ghost"}
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthMessage(null);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    登録
                  </Button>
                </div>
                <div className="grid gap-3">
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
                  {authMessage ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {authMessage}
                    </div>
                  ) : null}
                  <Button
                    onClick={() => void handleAuth(authMode)}
                    disabled={authBusy}
                    className="w-full sm:w-auto"
                  >
                    {authBusy
                      ? authMode === "signin"
                        ? "ログイン中..."
                        : "登録中..."
                      : authMode === "signin"
                        ? "ログイン"
                        : "登録"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  保存済みリスト
                </h2>
                <p className="text-sm text-slate-600">
                  詳細を開くと、グッズごとの点数と単価を確認できます。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" />
                  <span>ログアウト</span>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white"
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
                {savedLists.map((list) => {
                  const isOpen = Boolean(openListIds[list.shopping_list_id]);
                  const isEditingName =
                    editingListId === list.shopping_list_id;
                  const isSavingName =
                    savingNameListId === list.shopping_list_id;

                  return (
                    <Card
                      key={list.shopping_list_id}
                      className="overflow-hidden bg-white"
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex h-[72px] w-[112px] shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:h-[80px] sm:w-[120px]">
                            {list.event?.image_url ? (
                              <img
                                src={list.event.image_url}
                                alt={getEventTitle(list.event)}
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <ImageIcon className="h-7 w-7" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-medium text-slate-600">
                                {getEventTitle(list.event)}
                              </div>

                              {isEditingName ? (
                                <Input
                                  ref={nameInputRef}
                                  value={editingListName}
                                  onChange={(event) =>
                                    setEditingListName(event.target.value)
                                  }
                                  onBlur={() => void saveListName(list)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelEditingListName();
                                    }
                                  }}
                                  disabled={isSavingName}
                                  className="mt-1 h-9 max-w-lg text-lg font-semibold"
                                />
                              ) : (
                                <div className="mt-1 flex min-w-0 items-center gap-2">
                                  <h3 className="min-w-0 truncate text-lg font-semibold text-slate-950">
                                    {list.list_name}
                                  </h3>
                                  <button
                                    type="button"
                                    data-html2canvas-ignore="true"
                                    onClick={() => startEditingListName(list)}
                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                    aria-label="買い物リスト名を編集"
                                  >
                                    <img
                                      src={pencilIcon.src}
                                      alt=""
                                      className="h-4 w-4 object-contain"
                                    />
                                  </button>
                                </div>
                              )}

                              <div className="mt-2 text-sm text-slate-600">
                                作成日: {formatDate(list.created_at)}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 lg:min-w-56">
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

                          <div
                            data-html2canvas-ignore="true"
                            className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              data-html2canvas-ignore="true"
                              onClick={() =>
                                toggleListOpen(list.shopping_list_id)
                              }
                              aria-expanded={isOpen}
                              className="w-full justify-between sm:w-auto"
                            >
                              {isOpen ? "詳細を閉じる" : "詳細を表示する"}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </Button>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                type="button"
                                variant="outline"
                                data-html2canvas-ignore="true"
                                onClick={() => handleEditList(list)}
                                className="w-full sm:w-auto"
                              >
                                <img src={pencilIcon.src} alt="編集" className="h-4 w-4" />
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                data-html2canvas-ignore="true"
                                onClick={() => void handleDeleteList(list)}
                                disabled={
                                  deletingListId === list.shopping_list_id
                                }
                                className="w-full sm:w-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                {deletingListId === list.shopping_list_id
                                  ? "削除中..."
                                  : "削除"}
                              </Button>
                            </div>
                          </div>
                          </div>
                        </div>

                        <div
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out sm:ml-[136px] ${
                              isOpen
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="mt-4 rounded-lg border border-slate-200">
                                {list.items.length > 0 ? (
                                  <div className="divide-y divide-slate-100">
                                    <div className="grid grid-cols-[1fr_72px_96px] gap-3 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                                      <div>グッズ名</div>
                                      <div className="text-right">点数</div>
                                      <div className="text-right">単価</div>
                                    </div>
                                    {list.items.map((item) => (
                                      <div
                                        key={item.id}
                                        className="grid grid-cols-[1fr_72px_96px] gap-3 px-3 py-3 text-sm text-slate-700"
                                      >
                                        <div className="min-w-0 truncate font-medium text-slate-900">
                                          {item.name}
                                        </div>
                                        <div className="text-right">
                                          {item.quantity}点
                                        </div>
                                        <div className="text-right">
                                          {formatYen(item.unit_price)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-3 py-4 text-sm text-slate-600">
                                    このリストにはグッズがありません。
                                  </div>
                                )}
                              </div>
                            </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
