export const GOODS_CALCULATOR_STORAGE_KEY = "goods-calculator-data-v1";
export const SHOPPING_LISTS_STORAGE_KEY = "goods-shopping-lists-v1";

export type GoodsCalculatorDraft = {
  version: 1;
  event_id: string;
  quantities: Record<string, number>;
  updated_at: string;
};

export type LocalShoppingList = {
  id: string;
  name: string;
  event_id: string;
  quantities: Record<string, number>;
  created_at: string;
  updated_at: string;
  memo?: string;
};

export type LocalShoppingListsData = {
  version: 1;
  lists: LocalShoppingList[];
  updated_at: string;
};

type StorageResult<T> = {
  data: T;
  error: string | null;
};

export function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isQuantitiesRecord(value: unknown): value is Record<string, number> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.entries(value as Record<string, unknown>).every(
      ([key, quantity]) =>
        typeof key === "string" &&
        typeof quantity === "number" &&
        Number.isFinite(quantity) &&
        quantity >= 0
    )
  );
}

export function createDraftData(
  eventId: string,
  quantities: Record<string, number>
): GoodsCalculatorDraft {
  return {
    version: 1,
    event_id: eventId,
    quantities,
    updated_at: new Date().toISOString(),
  };
}

export function isGoodsCalculatorDraft(
  value: unknown
): value is GoodsCalculatorDraft {
  if (!value || typeof value !== "object") return false;

  const data = value as Partial<GoodsCalculatorDraft>;
  return (
    data.version === 1 &&
    typeof data.event_id === "string" &&
    isQuantitiesRecord(data.quantities) &&
    typeof data.updated_at === "string"
  );
}

export function loadGoodsDraft(eventId: string): StorageResult<Record<string, number>> {
  try {
    const rawValue = window.localStorage.getItem(GOODS_CALCULATOR_STORAGE_KEY);
    if (!rawValue) {
      return { data: {}, error: null };
    }

    const parsed: unknown = JSON.parse(rawValue);
    if (!isGoodsCalculatorDraft(parsed)) {
      return {
        data: {},
        error: "保存データの形式が古いか、不正です。初期状態で表示しました。",
      };
    }

    if (parsed.event_id !== eventId) {
      return { data: {}, error: null };
    }

    return { data: parsed.quantities, error: null };
  } catch (error) {
    console.error("[goods-storage] failed to load draft", error);
    return {
      data: {},
      error: "保存データの読み込みに失敗しました。初期状態で表示しました。",
    };
  }
}

export function saveGoodsDraft(
  eventId: string,
  quantities: Record<string, number>
) {
  try {
    window.localStorage.setItem(
      GOODS_CALCULATOR_STORAGE_KEY,
      JSON.stringify(createDraftData(eventId, quantities))
    );
    return null;
  } catch (error) {
    console.error("[goods-storage] failed to save draft", error);
    return "保存に失敗しました。ブラウザの空き容量や設定を確認してください。";
  }
}

export function clearGoodsDraft() {
  try {
    window.localStorage.removeItem(GOODS_CALCULATOR_STORAGE_KEY);
    return null;
  } catch (error) {
    console.error("[goods-storage] failed to clear draft", error);
    return "保存データの削除に失敗しました。";
  }
}

export function isLocalShoppingList(value: unknown): value is LocalShoppingList {
  if (!value || typeof value !== "object") return false;

  const list = value as Partial<LocalShoppingList>;
  return (
    typeof list.id === "string" &&
    typeof list.name === "string" &&
    typeof list.event_id === "string" &&
    isQuantitiesRecord(list.quantities) &&
    typeof list.created_at === "string" &&
    typeof list.updated_at === "string"
  );
}

export function createShoppingListsData(
  lists: LocalShoppingList[]
): LocalShoppingListsData {
  return {
    version: 1,
    lists,
    updated_at: new Date().toISOString(),
  };
}

export function loadShoppingLists(): StorageResult<LocalShoppingList[]> {
  try {
    const rawValue = window.localStorage.getItem(SHOPPING_LISTS_STORAGE_KEY);
    if (!rawValue) {
      return { data: [], error: null };
    }

    const parsed: unknown = JSON.parse(rawValue);
    const rawLists =
      parsed &&
      typeof parsed === "object" &&
      (parsed as Partial<LocalShoppingListsData>).version === 1 &&
      Array.isArray((parsed as Partial<LocalShoppingListsData>).lists)
        ? (parsed as LocalShoppingListsData).lists
        : Array.isArray(parsed)
          ? parsed
          : null;

    if (!rawLists) {
      return {
        data: [],
        error: "保存済みリストの形式が古いか、不正です。",
      };
    }

    const lists = rawLists.filter(isLocalShoppingList);
    const error =
      lists.length === rawLists.length
        ? null
        : "一部の保存済みリストは形式が不正だったため除外しました。";

    return { data: lists, error };
  } catch (error) {
    console.error("[goods-storage] failed to load shopping lists", error);
    return {
      data: [],
      error: "保存済みリストの読み込みに失敗しました。",
    };
  }
}

export function saveShoppingLists(lists: LocalShoppingList[]) {
  try {
    window.localStorage.setItem(
      SHOPPING_LISTS_STORAGE_KEY,
      JSON.stringify(createShoppingListsData(lists))
    );
    return null;
  } catch (error) {
    console.error("[goods-storage] failed to save shopping lists", error);
    return "買い物リストの保存に失敗しました。";
  }
}

export function upsertShoppingList(list: LocalShoppingList) {
  const { data: lists, error } = loadShoppingLists();
  if (error) {
    console.error("[goods-storage] load warning before upsert", error);
  }

  const index = lists.findIndex((current) => current.id === list.id);
  const nextLists =
    index >= 0
      ? lists.map((current) => (current.id === list.id ? list : current))
      : [list, ...lists];

  return saveShoppingLists(nextLists);
}

export function deleteShoppingList(listId: string) {
  const { data: lists, error } = loadShoppingLists();
  if (error) {
    console.error("[goods-storage] load warning before delete", error);
  }

  return saveShoppingLists(lists.filter((list) => list.id !== listId));
}
