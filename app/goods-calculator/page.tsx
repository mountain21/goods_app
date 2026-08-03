/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  max_quantity: string | null;
  limit_label?: string | null;
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

interface EventSummary {
  event_id: string;
  artist_name: string | null;
  event_name: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  image_url: string | null;
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

function normalizeSearchParam(value?: string) {
  const normalized = value?.trim();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }

  return normalized;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const isValidStart = start ? !Number.isNaN(start.getTime()) : false;
  const isValidEnd = end ? !Number.isNaN(end.getTime()) : false;

  if (!isValidStart && !isValidEnd) return "開催日未定";

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const formattedStart =
    start && isValidStart ? formatter.format(start) : null;
  const formattedEnd = end && isValidEnd ? formatter.format(end) : null;

  if (formattedStart && formattedEnd) {
    return formattedStart === formattedEnd
      ? formattedStart
      : `${formattedStart} - ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd ?? "開催日未定";
}

async function loadSelectableEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_id, artist_name, event_name, event_start_date, event_end_date, image_url")
    .eq("show_flag", true)
    .order("event_start_date", { ascending: false });

  if (error) {
    throw new Error(`イベント一覧の取得に失敗しました: ${error.message}`);
  }

  return (data ?? []) as EventSummary[];
}

async function loadCalculatorData(eventId: string) {
  const supabase = await createClient();

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .eq("show_flag", true)
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

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-10">
      <main className="mx-auto max-w-6xl space-y-8">{children}</main>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <PageShell>
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-red-600">{message}</p>
          <Button asChild variant="outline">
            <Link href="/goods-calculator">イベント選択に戻る</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function EventSelectionView({ events }: { events: EventSummary[] }) {
  return (
    <PageShell>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">
          イベントを選択
        </h1>

        <p className="text-sm text-slate-600">
          グッズ計算を行うイベントを選択してください。
        </p>
      </header>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            現在選択できるイベントはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card
              key={event.event_id}
              className="flex h-full overflow-hidden bg-white"
            >
              <div className="flex w-full flex-col">
                <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={`${event.artist_name || "アーティスト"} ${
                        event.event_name || "イベント"
                      }`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center text-sm font-medium text-slate-500">
                      {event.artist_name || "画像未設定"}
                    </div>
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex-1 space-y-2">
                    <div className="truncate text-sm font-medium text-slate-500">
                      {event.artist_name || "アーティスト未設定"}
                    </div>

                    <CardTitle className="line-clamp-2 min-h-[3rem] text-base leading-6 text-slate-950">
                      {event.event_name || "イベント名未設定"}
                    </CardTitle>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays className="h-4 w-4 shrink-0" />

                      <span>
                        {formatDateRange(
                          event.event_start_date,
                          event.event_end_date
                        )}
                      </span>
                    </div>
                  </div>

                  <Button asChild className="mt-6 w-full">
                    <Link
                      href={`/goods-calculator?event_id=${encodeURIComponent(
                        event.event_id
                      )}`}
                    >
                      このイベントを選択
                    </Link>
                  </Button>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export default async function GoodsCalculator({
  searchParams,
}: {
  searchParams?: Promise<{ event_id?: string; list_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const eventId = normalizeSearchParam(resolvedSearchParams?.event_id);
  const listId = normalizeSearchParam(resolvedSearchParams?.list_id);

  if (!eventId) {
    let events: EventSummary[];

    try {
      events = await loadSelectableEvents();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return <ErrorView message={errorMessage} />;
    }

    return <EventSelectionView events={events} />;
  }

  let data: Awaited<ReturnType<typeof loadCalculatorData>>;

  try {
    data = await loadCalculatorData(eventId);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return <ErrorView message={errorMessage} />;
  }

  return (
    <PageShell>
      <GoodsCalculatorClient
        goods={data.goods}
        event={data.event}
        initialListId={listId}
      />
    </PageShell>
  );
}
