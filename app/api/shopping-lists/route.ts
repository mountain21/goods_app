import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CartItemPayload {
  goods_id: string;
  quantity: number;
  selected_variant_id: string | null;
}

interface ShoppingListPostBody {
  event_id: string;
  total_amount: number;
  total_items: number;
  cart_data: CartItemPayload[];
}

interface ShoppingListRow {
  id?: string;
  list_id?: string;
  shopping_list_id?: string;
  event_id: string;
  total_amount: number;
  total_items: number;
  created_at: string;
}

interface ListItemRow {
  item_id: string;
  list_id: string;
  goods_id?: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price?: number | null;
}

interface GoodsRow {
  goods_id: string;
  item_name: string;
  image_url?: string;
}

interface VariantRow {
  variant_id: string;
  variant_name: string;
  image_url?: string;
}

interface EventRow {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
}

export async function GET() {
  const supabase = await createClient();

  const { data: shoppingLists, error: shoppingListError } = await supabase
    .from("shopping_list")
    .select("*")
    .order("created_at", { ascending: false });

  if (shoppingListError) {
    return NextResponse.json(
      { error: shoppingListError.message },
      { status: 500 }
    );
  }

  const lists = (shoppingLists as ShoppingListRow[]) || [];
  const getShoppingListId = (list: ShoppingListRow) =>
    list.shopping_list_id ?? list.list_id ?? list.id;
  const listIds = lists.map(getShoppingListId).filter((id): id is string => Boolean(id));
  const eventIds = Array.from(new Set(lists.map((list) => list.event_id)));

  let listItems: ListItemRow[] = [];
  if (listIds.length > 0) {
    const { data: listItemsData, error: listItemsError } = await supabase
      .from("list_item")
      .select("*")
      .in("list_id", listIds);

    if (listItemsError) {
      return NextResponse.json(
        { error: listItemsError.message },
        { status: 500 }
      );
    }

    listItems = (listItemsData as ListItemRow[]) || [];
  }
  const goodsIds = Array.from(
    new Set(listItems.map((item) => item.goods_id ?? item.item_id))
  );
  const variantIds = Array.from(new Set(listItems.filter((item) => item.variant_id).map((item) => item.variant_id as string)));

  let goodsData: GoodsRow[] = [];
  if (goodsIds.length > 0) {
    const { data, error: goodsError } = await supabase
      .from("goods")
      .select("*")
      .in("goods_id", goodsIds);

    if (goodsError) {
      return NextResponse.json(
        { error: goodsError.message },
        { status: 500 }
      );
    }

    goodsData = (data as GoodsRow[]) || [];
  }

  let variantData: VariantRow[] = [];
  if (variantIds.length > 0) {
    const { data, error: variantError } = await supabase
      .from("goods_variant")
      .select("*")
      .in("variant_id", variantIds);

    if (variantError) {
      return NextResponse.json(
        { error: variantError.message },
        { status: 500 }
      );
    }

    variantData = (data as VariantRow[]) || [];
  }

  let eventData: EventRow[] = [];
  if (eventIds.length > 0) {
    const { data, error: eventError } = await supabase
      .from("events")
      .select("*")
      .in("event_id", eventIds);

    if (eventError) {
      return NextResponse.json(
        { error: eventError.message },
        { status: 500 }
      );
    }

    eventData = (data as EventRow[]) || [];
  }

  const goodsMap = new Map<string, GoodsRow>();
  goodsData.forEach((goods) => goodsMap.set(goods.goods_id, goods));

  const variantMap = new Map<string, VariantRow>();
  variantData.forEach((variant) => variantMap.set(variant.variant_id, variant));

  const eventMap = new Map<string, EventRow>();
  eventData.forEach((event) => eventMap.set(event.event_id, event));

  const response = lists.map((list) => ({
    ...list,
    event: eventMap.get(list.event_id) ?? null,
    items: listItems
      .filter((item) => item.list_id === getShoppingListId(list))
      .map((item) => ({
        ...item,
        goods_name: goodsMap.get(item.goods_id ?? item.item_id)?.item_name || "不明な商品",
        image_url: goodsMap.get(item.goods_id ?? item.item_id)?.image_url || null,
        variant_name: item.variant_id ? variantMap.get(item.variant_id)?.variant_name ?? "" : null,
      })),
  }));

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const body = (await request.json()) as ShoppingListPostBody;
  const { event_id, total_amount, total_items, cart_data } = body;

  if (!event_id || !cart_data || !Array.isArray(cart_data)) {
    return NextResponse.json(
      { error: "event_id と cart_data を含むリクエストを送信してください。" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: shoppingList, error: shoppingListError } = await supabase
    .from("shopping_list")
    .insert({
      event_id,
      total_amount,
      total_items,
    })
    .select("*")
    .single();

  if (shoppingListError || !shoppingList) {
    return NextResponse.json(
      { error: shoppingListError?.message || "ショッピングリストの作成に失敗しました。" },
      { status: 500 }
    );
  }

  const items = cart_data.map((item) => ({
    list_id: shoppingList.shopping_list_id ?? shoppingList.list_id ?? shoppingList.id,
    goods_id: item.goods_id,
    variant_id: item.selected_variant_id,
    quantity: item.quantity,
  }));

  const { error: listItemError } = await supabase.from("list_item").insert(items);

  if (listItemError) {
    return NextResponse.json(
      { error: listItemError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    list_id: shoppingList.shopping_list_id ?? shoppingList.list_id ?? shoppingList.id,
    total_amount,
    total_items,
  });
}
