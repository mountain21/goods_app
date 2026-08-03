"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileDown,
  FileUp,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/utils/blobDownload";
import { renderElementAsImageBlob } from "@/utils/imageExport";
import {
  clearGoodsDraft,
  createDraftData,
  createLocalId,
  isGoodsCalculatorDraft,
  loadGoodsDraft,
  loadShoppingLists,
  saveGoodsDraft,
  upsertShoppingList,
  type LocalShoppingList,
} from "@/lib/goods-storage";

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
  limit_label: string;
  variants?: GoodsVariant[];
};

type Event = {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
};

type Props = {
  goods: Good[];
  event: Event;
  initialListId?: string | null;
};

const IMAGE_RENDER_TIMEOUT_MS = 15000;
const TOAST_DURATION_MS = 2500;

function formatYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function qKey(goodsId: string, variantId: string | null) {
  return `${goodsId}::${variantId ?? "null"}`;
}

function getDefaultListName(eventName: string) {
  return `${eventName || "イベント"} 買い物リスト`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function createListPayload({
  id,
  name,
  eventId,
  quantities,
  existing,
}: {
  id: string;
  name: string;
  eventId: string;
  quantities: Record<string, number>;
  existing?: LocalShoppingList | null;
}): LocalShoppingList {
  const now = new Date().toISOString();

  return {
    id,
    name,
    event_id: eventId,
    quantities,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    memo: existing?.memo,
  };
}

export function GoodsCalculatorClient({
  goods,
  event,
  initialListId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [currentListId, setCurrentListId] = useState<string | null>(
    initialListId ?? null
  );
  const [currentListName, setCurrentListName] = useState(
    getDefaultListName(event.event_name)
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isListNameDialogOpen, setIsListNameDialogOpen] = useState(false);
  const [listNameInput, setListNameInput] = useState("");
  const [listNameError, setListNameError] = useState<string | null>(null);

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
      title: currentListName || event.event_name || "買い物リスト",
      totalItems: totals.totalItems,
      totalAmount: totals.totalAmount,
      items,
    };
  }, [
    currentListName,
    event.event_name,
    goodsById,
    quantities,
    totals.totalAmount,
    totals.totalItems,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (initialListId) {
        const { data: lists, error } = loadShoppingLists();
        const list = lists.find(
          (current) =>
            current.id === initialListId && current.event_id === event.event_id
        );

        if (list) {
          setCurrentListId(list.id);
          setCurrentListName(list.name);
          setQuantities(list.quantities);
          setStorageError(error);
        } else {
          setStorageError(
            error ??
              "指定された買い物リストが見つかりませんでした。初期状態で表示しました。"
          );
          setCurrentListId(null);
          setCurrentListName(getDefaultListName(event.event_name));
          setQuantities({});
        }

        setHasLoadedStorage(true);
        return;
      }

      const result = loadGoodsDraft(event.event_id);
      setCurrentListId(null);
      setCurrentListName(getDefaultListName(event.event_name));
      setQuantities(result.data);
      setStorageError(result.error);
      setHasLoadedStorage(true);

      if (result.error) {
        toast({
          title: "保存データを読み込めませんでした",
          description: result.error,
          variant: "destructive",
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [event.event_id, event.event_name, initialListId, toast]);

  useEffect(() => {
    if (!hasLoadedStorage) return;

    const timeoutId = window.setTimeout(() => {
      const error = saveGoodsDraft(event.event_id, quantities);
      setStorageError(error);

      if (error) {
        toast({
          title: "自動保存に失敗しました",
          description: error,
          variant: "destructive",
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [event.event_id, hasLoadedStorage, quantities, toast]);

  const persistShoppingList = (
    listName: string,
    existing: LocalShoppingList | null
  ) => {
    const nextId = existing?.id ?? createLocalId();
    const nextList = createListPayload({
      id: nextId,
      name: listName,
      eventId: event.event_id,
      quantities,
      existing,
    });
    const error = upsertShoppingList(nextList);
    setStorageError(error);

    if (error) {
      toast({
        title: "保存に失敗しました",
        description: error,
        variant: "destructive",
      });
      return false;
    }

    setCurrentListId(nextId);
    setCurrentListName(listName);
    saveGoodsDraft(event.event_id, quantities);
    router.replace(
      `/goods-calculator?event_id=${encodeURIComponent(
        event.event_id
      )}&list_id=${encodeURIComponent(nextId)}`
    );
    toast({
      title: existing ? "更新しました！" : "保存しました！",
      duration: TOAST_DURATION_MS,
    });
    return true;
  };

  const openListNameDialog = (defaultName: string) => {
    setListNameInput(defaultName);
    setListNameError(null);
    setIsListNameDialogOpen(true);
  };

  const saveShoppingList = (forceNew: boolean) => {
    const { data: lists } = loadShoppingLists();
    const existing =
      !forceNew && currentListId
        ? lists.find((list) => list.id === currentListId) ?? null
        : null;
    const defaultName = existing?.name ?? currentListName;

    if (existing) {
      persistShoppingList(currentListName, existing);
      return;
    }

    openListNameDialog(defaultName);
  };

  const handleListNameDialogOpenChange = (open: boolean) => {
    setIsListNameDialogOpen(open);

    if (!open) {
      setListNameError(null);
    }
  };

  const handleListNameDialogSave = () => {
    const trimmedName = listNameInput.trim();

    if (!trimmedName) {
      setListNameError("買い物リスト名を入力してください。");
      return;
    }

    const saved = persistShoppingList(trimmedName, null);

    if (saved) {
      setIsListNameDialogOpen(false);
      setListNameError(null);
    }
  };

  const handleResetData = () => {
    const confirmed = window.confirm(
      "編集中の数量をすべて削除します。保存済み買い物リストは削除されません。よろしいですか？"
    );
    if (!confirmed) return;

    const error = clearGoodsDraft();
    setQuantities({});
    setStorageError(error);

    if (error) {
      toast({
        title: "初期化に失敗しました",
        description: error,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "編集中の数量を初期化しました" });
  };

  const handleExportJson = () => {
    try {
      const data = createDraftData(event.event_id, quantities);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `goods-calculator-draft-${date}.json`);
    } catch (error) {
      console.error("[goods-storage] failed to export draft", error);
      toast({
        title: "エクスポートに失敗しました",
        description: "JSONファイルを作成できませんでした。",
        variant: "destructive",
      });
    }
  };

  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isGoodsCalculatorDraft(parsed)) {
        throw new Error("対応していない編集中データの形式です。");
      }

      if (parsed.event_id !== event.event_id) {
        throw new Error("別イベントの編集中データは読み込めません。");
      }

      const confirmed = window.confirm(
        "現在の入力内容をインポートしたデータで上書きします。よろしいですか？"
      );
      if (!confirmed) return;

      const error = saveGoodsDraft(event.event_id, parsed.quantities);
      if (error) throw new Error(error);

      setQuantities(parsed.quantities);
      setStorageError(null);
      toast({ title: "編集中データを読み込みました" });
    } catch (error) {
      console.error("[goods-storage] failed to import draft", error);
      toast({
        title: "インポートに失敗しました",
        description:
          error instanceof Error
            ? error.message
            : "JSONファイルを読み込めませんでした。",
        variant: "destructive",
      });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const handleImageSaveClick = async () => {
    if (isSavingImage) return;

    setIsSavingImage(true);

    try {
      const { blob, fileName } = await withTimeout(
        renderElementAsImageBlob(
          exportImageData,
          <ExportListImage data={exportImageData} />,
          {
            excludeExternalImages: true,
            pixelRatio: 1,
          }
        ),
        IMAGE_RENDER_TIMEOUT_MS,
        "画像生成がタイムアウトしました。"
      );

      downloadBlob(blob, fileName);
    } catch (error) {
      console.error("保存失敗:", error);
      const isTimeout =
        error instanceof Error &&
        error.message === "画像生成がタイムアウトしました。";

      toast({
        title: "画像保存に失敗しました",
        description: isTimeout
          ? "画像の生成に時間がかかっています。もう一度お試しください。"
          : "通信環境やブラウザ設定を確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsSavingImage(false);
    }
  };

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
            variant="outline"
            onClick={() => router.push("/shopping-list")}
            className="w-full justify-start sm:w-auto"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            買い物リストを見る
          </Button>
        </div>
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
            {currentListId ? (
              <div className="font-medium text-slate-700">
                編集中: {currentListName}
              </div>
            ) : null}
            <div className="text-xs text-slate-500">
              買い物リストはこのブラウザ内に保存されます。別の端末やブラウザには同期されず、ブラウザのデータ削除で消える場合があります。
            </div>
          </div>
        </div>
      </header>

      {storageError ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-700">
            {storageError}
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
                  {good.max_quantity != null && (
                    <div className="text-sm text-slate-600">
                      各{good.limit_label? `${good.limit_label} ${good.max_quantity}点まで`: `${good.max_quantity}点まで`}
                    </div>
                  )}
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
                onClick={() => void handleImageSaveClick()}
                disabled={isSavingImage}
              >
                <Download className="h-4 w-4" />
                {isSavingImage ? "画像保存中..." : "画像を保存"}
              </Button>
              {currentListId ? (
                <Button
                  variant="outline"
                  data-html2canvas-ignore="true"
                  className="h-11 w-full text-base font-semibold sm:w-auto"
                  onClick={() => saveShoppingList(true)}
                >
                  新規リストとして保存
                </Button>
              ) : null}
              <Button
                data-html2canvas-ignore="true"
                className="h-11 w-full text-base font-semibold sm:w-auto"
                onClick={() => saveShoppingList(false)}
              >
                {currentListId ? "リストを更新" : "リストを保存"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportJson}
            className="justify-start text-slate-600"
          >
            <FileDown className="h-4 w-4" />
            編集中データをJSON出力
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            className="justify-start text-slate-600"
          >
            <FileUp className="h-4 w-4" />
            編集中データをJSON読込
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetData}
            className="justify-start text-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            編集中データを初期化
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportJson(file);
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isListNameDialogOpen}
        onOpenChange={handleListNameDialogOpenChange}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleListNameDialogSave();
            }}
          >
            <DialogHeader>
              <DialogTitle>買い物リストを保存</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="shopping-list-name"
                className="text-sm font-medium text-slate-700"
              >
                リスト名
              </label>
              <Input
                id="shopping-list-name"
                value={listNameInput}
                aria-invalid={Boolean(listNameError)}
                onChange={(event) => {
                  setListNameInput(event.target.value);
                  if (listNameError) setListNameError(null);
                }}
              />
              {listNameError ? (
                <div className="text-sm text-rose-600">{listNameError}</div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleListNameDialogOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button type="submit">保存する</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
