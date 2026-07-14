"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  FileDown,
  FileUp,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/client";
import {
  createShoppingListsData,
  deleteShoppingList,
  isLocalShoppingList,
  loadShoppingLists,
  saveShoppingLists,
  upsertShoppingList,
  type LocalShoppingList,
} from "@/lib/goods-storage";

type GoodsRow = {
  goods_id: string;
  item_name: string;
  price: number | null;
};

type VariantRow = {
  variant_id: string;
  goods_id: string;
  variant_name: string;
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

type DisplayList = LocalShoppingList & {
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

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

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

function formatYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}

function getEventTitle(event: EventRow | null) {
  if (!event) return "イベント未設定";
  if (event.artist_name && event.event_name) {
    return `${event.artist_name} / ${event.event_name}`;
  }
  return event.event_name || event.artist_name || "イベント未設定";
}

function splitQuantityKey(key: string) {
  const [goodsId, variantIdValue] = key.split("::");
  return {
    goodsId,
    variantId: variantIdValue && variantIdValue !== "null" ? variantIdValue : null,
  };
}

export default function ShoppingListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [savedLists, setSavedLists] = useState<DisplayList[]>([]);
  const [openListIds, setOpenListIds] = useState<Record<string, boolean>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const buildDisplayLists = useCallback(
    async (lists: LocalShoppingList[]) => {
      const eventIds = Array.from(new Set(lists.map((list) => list.event_id)));
      const quantityKeys = lists.flatMap((list) => Object.keys(list.quantities));
      const goodsIds = Array.from(
        new Set(quantityKeys.map((key) => splitQuantityKey(key).goodsId))
      ).filter(Boolean);
      const variantIds = Array.from(
        new Set(
          quantityKeys
            .map((key) => splitQuantityKey(key).variantId)
            .filter((variantId): variantId is string => Boolean(variantId))
        )
      );

      let eventRows: EventRow[] = [];
      let goodsRows: GoodsRow[] = [];
      let variantRows: VariantRow[] = [];

      if (eventIds.length > 0) {
        const { data, error } = await supabase
          .from("events")
          .select(
            "event_id,artist_name,event_name,event_start_date,event_end_date,image_url"
          )
          .in("event_id", eventIds);

        if (error) throw error;
        eventRows = (data ?? []) as EventRow[];
      }

      if (goodsIds.length > 0) {
        const { data, error } = await supabase
          .from("goods")
          .select("goods_id,item_name,price")
          .in("goods_id", goodsIds);

        if (error) throw error;
        goodsRows = (data ?? []) as GoodsRow[];
      }

      if (variantIds.length > 0) {
        const { data, error } = await supabase
          .from("goods_variant")
          .select("variant_id,goods_id,variant_name")
          .in("variant_id", variantIds);

        if (error) throw error;
        variantRows = (data ?? []) as VariantRow[];
      }

      const eventById = new Map(
        eventRows.map((eventItem) => [eventItem.event_id, eventItem])
      );
      const goodsById = new Map(
        goodsRows.map((goodsItem) => [goodsItem.goods_id, goodsItem])
      );
      const variantById = new Map(
        variantRows.map((variantItem) => [variantItem.variant_id, variantItem])
      );

      return lists
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .map((list): DisplayList => {
          const items = Object.entries(list.quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([key, quantity]) => {
              const { goodsId, variantId } = splitQuantityKey(key);
              const goodsItem = goodsById.get(goodsId);
              const variant = variantId ? variantById.get(variantId) : null;
              const baseName = goodsItem?.item_name ?? "不明なグッズ";

              return {
                id: key,
                name: variant ? `${baseName} / ${variant.variant_name}` : baseName,
                quantity,
                unit_price: goodsItem?.price ?? 0,
              };
            });
          const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
          const totalAmount = items.reduce(
            (sum, item) => sum + item.unit_price * item.quantity,
            0
          );

          return {
            ...list,
            event: eventById.get(list.event_id) ?? null,
            total_items: totalItems,
            total_amount: totalAmount,
            items,
          };
        });
    },
    [supabase]
  );

  const reloadLists = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { data: lists, error } = loadShoppingLists();
      const displayLists = await buildDisplayLists(lists);
      setSavedLists(displayLists);
      setMessage(error);
    } catch (error) {
      console.error("[shopping-list] failed to load lists", error);
      setMessage(`買い物リストの読み込みに失敗しました: ${getErrorMessage(error)}`);
      setSavedLists([]);
    } finally {
      setLoading(false);
    }
  }, [buildDisplayLists]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void reloadLists();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [reloadLists]);

  useEffect(() => {
    if (!editingListId) return;

    const timeoutId = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [editingListId]);

  const toggleListOpen = (listId: string) => {
    setOpenListIds((current) => ({
      ...current,
      [listId]: !current[listId],
    }));
  };

  const handleEditList = (list: DisplayList) => {
    const eventId = list.event_id?.trim();
    if (!eventId || eventId === "undefined" || eventId === "null") {
      setMessage("イベント情報がないため、この買い物リストは編集できません。");
      return;
    }

    const params = new URLSearchParams({
      event_id: eventId,
      list_id: list.id,
    });
    router.push(`/goods-calculator?${params.toString()}`);
  };

  const startEditingListName = (list: DisplayList) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
  };

  const cancelEditingListName = () => {
    setEditingListId(null);
    setEditingListName("");
  };

  const saveListName = (list: DisplayList) => {
    const nextName = editingListName.trim();
    if (!nextName) {
      setMessage("買い物リスト名を入力してください。");
      return;
    }

    const nextList: LocalShoppingList = {
      id: list.id,
      name: nextName,
      event_id: list.event_id,
      quantities: list.quantities,
      created_at: list.created_at,
      updated_at: new Date().toISOString(),
      memo: list.memo,
    };
    const error = upsertShoppingList(nextList);
    if (error) {
      setMessage(error);
      return;
    }

    cancelEditingListName();
    void reloadLists();
  };

  const handleDeleteList = (list: DisplayList) => {
    const confirmed = window.confirm("この買い物リストを削除しますか？");
    if (!confirmed) return;

    const error = deleteShoppingList(list.id);
    if (error) {
      setMessage(error);
      return;
    }

    setSavedLists((currentLists) =>
      currentLists.filter((currentList) => currentList.id !== list.id)
    );
    setOpenListIds((current) => {
      const next = { ...current };
      delete next[list.id];
      return next;
    });
    setMessage("買い物リストを削除しました。");
  };

  const handleExportLists = () => {
    try {
      const { data: lists } = loadShoppingLists();
      const blob = new Blob(
        [JSON.stringify(createShoppingListsData(lists), null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `goods-shopping-lists-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[shopping-list] failed to export lists", error);
      setMessage("買い物リストのエクスポートに失敗しました。");
    }
  };

  const handleImportLists = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const rawLists =
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(
          (parsed as { lists?: unknown }).lists
        )
          ? (parsed as { lists: unknown[] }).lists
          : Array.isArray(parsed)
            ? parsed
            : null;

      if (!rawLists) {
        throw new Error("対応していない買い物リストの形式です。");
      }

      const lists = rawLists.filter(isLocalShoppingList);
      if (lists.length === 0 && rawLists.length > 0) {
        throw new Error("有効な買い物リストが含まれていません。");
      }

      const confirmed = window.confirm(
        "現在の保存済み買い物リストをインポートした内容で上書きします。よろしいですか？"
      );
      if (!confirmed) return;

      const error = saveShoppingLists(lists);
      if (error) throw new Error(error);

      await reloadLists();
      setMessage(
        lists.length === rawLists.length
          ? "買い物リストをインポートしました。"
          : "一部の不正なリストを除外してインポートしました。"
      );
    } catch (error) {
      console.error("[shopping-list] failed to import lists", error);
      setMessage(
        `買い物リストのインポートに失敗しました: ${getErrorMessage(error)}`
      );
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              買い物リスト
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              保存済み買い物リストを確認し、必要なリストを再編集できます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              買い物リストはこのブラウザ内に保存されます。別の端末やブラウザには同期されず、ブラウザのデータ削除で消える場合があります。
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

        <Card className="border-slate-200 bg-white">
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportLists}
              className="justify-start text-slate-600"
            >
              <FileDown className="h-4 w-4" />
              全リストをJSON出力
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="justify-start text-slate-600"
            >
              <FileUp className="h-4 w-4" />
              全リストをJSON読込
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportLists(file);
              }}
            />
          </CardContent>
        </Card>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                保存したリスト
              </h2>
              <p className="text-sm text-slate-600">
                リスト名、対象イベント、合計点数、合計金額を確認できます。
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : savedLists.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 p-6 text-sm text-slate-600">
                <div>
                  保存された買い物リストはありません。
                  <br />
                  グッズ計算画面からリストを作成できます。
                </div>
                <Button onClick={() => router.push("/goods-calculator")}>
                  <Plus className="h-4 w-4" />
                  グッズ計算画面へ
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedLists.map((list) => {
                const isOpen = Boolean(openListIds[list.id]);
                const isEditingName = editingListId === list.id;

                return (
                  <Card key={list.id} className="overflow-hidden bg-white">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex h-[72px] w-[112px] shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:h-[80px] sm:w-[120px]">
                          {list.event?.image_url ? (
                            <img
                              src={list.event.image_url}
                              alt={getEventTitle(list.event)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <ImageIcon className="h-7 w-7" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                                  onBlur={() => saveListName(list)}
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
                                  className="mt-1 h-9 max-w-lg text-lg font-semibold"
                                />
                              ) : (
                                <div className="mt-1 flex w-full items-center gap-2">
                                  <h3 className="min-w-0 flex-1 break-words text-lg font-semibold leading-tight text-slate-950">
                                    {list.name}
                                  </h3>
                                  <button
                                    type="button"
                                    onClick={() => startEditingListName(list)}
                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                    aria-label="買い物リスト名を編集"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </div>
                              )}

                              <div className="mt-2 text-sm text-slate-600">
                                更新日時: {formatDateTime(list.updated_at)}
                              </div>
                            </div>

                            <div className="grid min-w-[180px] grid-cols-2 gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                              <div>
                                <div className="text-[10px] font-medium uppercase text-slate-500">
                                  合計点数
                                </div>
                                <div className="text-base font-bold text-slate-950">
                                  {list.total_items}点
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-medium uppercase text-slate-500">
                                  合計金額
                                </div>
                                <div className="text-base font-bold text-slate-950">
                                  {formatYen(list.total_amount)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => toggleListOpen(list.id)}
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
                                onClick={() => handleEditList(list)}
                                className="w-full sm:w-auto"
                              >
                                <Pencil className="h-4 w-4" />
                                編集
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => handleDeleteList(list)}
                                className="w-full sm:w-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                削除
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
                                    <div className="break-words font-medium text-slate-900">
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
      </div>
    </main>
  );
}
