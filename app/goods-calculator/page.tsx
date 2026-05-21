import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { GoodsCalculatorClient } from "../goods-calculator-client";

interface Variant {
  variant_id: string;
  goods_id: string;
  variant_name: string;
}

interface Good {
  goods_id: string;
  event_id: string;
  item_name: string;
  price: number;
  image_url?: string | null;
  max_quantity: number;
  has_variants: boolean;
  variants?: Variant[];
}

interface Event {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
}

interface GoodsRow {
  goods_id: string;
  event_id: string;
  item_name: string;
  price: number;
  image_url?: string | null;
  max_quantity: number;
  has_variants: boolean;
}

interface VariantRow {
  variant_id: string;
  goods_id: string;
  variant_name: string;
}

const FALLBACK_EVENT_ID = "00000000-1111-2222-3333-444444444444";

async function loadCalculatorData(eventId: string) {
  const supabase = await createClient();

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`イベント情報の取得に失敗しました: ${eventError.message}`);
  }

  if (!eventData) {
    throw new Error(`指定されたイベント（${eventId}）が見つかりません`);
  }

  const { data: goodsDataRaw, error: goodsError } = await supabase
    .from("goods")
    .select("*")
    .eq("event_id", eventId)
    .order("goods_id");

  if (goodsError) {
    throw new Error(`グッズ一覧の取得に失敗しました: ${goodsError.message}`);
  }

  const { data: allVariantsRaw, error: variantsError } = await supabase
    .from("goods_variant")
    .select("*");

  if (variantsError) {
    throw new Error(`バリエーション情報の取得に失敗しました: ${variantsError.message}`);
  }

  const goodsArray = (goodsDataRaw as GoodsRow[] | null) || [];
  const allVariants = (allVariantsRaw as VariantRow[] | null) || [];

  const goodsWithVariants: Good[] = goodsArray.map((good) => ({
    ...good,
    variants: good.has_variants
      ? allVariants.filter((variant) => variant.goods_id === good.goods_id)
      : undefined,
  }));

  return {
    event: eventData as Event,
    goods: goodsWithVariants,
  };
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">エラーが発生しました</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{message}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function GoodsCalculator({
  searchParams,
}: {
  searchParams?: Promise<{ event_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const eventId = resolvedSearchParams?.event_id ?? FALLBACK_EVENT_ID;
  let data: Awaited<ReturnType<typeof loadCalculatorData>>;

  try {
    data = await loadCalculatorData(eventId);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return <ErrorView message={errorMessage} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-10">
      <main className="mx-auto max-w-6xl space-y-8">
        <GoodsCalculatorClient goods={data.goods} event={data.event} />
      </main>
    </div>
  );
}
