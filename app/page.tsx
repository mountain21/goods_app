"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ListChecks, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/client";

type EventRow = {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
  venue: string | null;
  image_url: string | null;
  show_flag: boolean;
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
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
  const end = new Date(endDate).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });

  return start === end ? start : `${start} - ${end}`;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("events")
        .select(
          "event_id, artist_name, event_name, event_start_date, event_end_date, venue, image_url, show_flag"
        )
        .eq("show_flag", true)
        .order("event_start_date", { ascending: true });

      if (error) throw error;
      setEvents((data ?? []) as EventRow[]);
    } catch (error) {
      logError("fetch events error", error);
      setMessage(`イベント一覧の取得に失敗しました: ${getErrorMessage(error)}`);
    } finally {
      setEventsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEvents();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadEvents]);

  const openEvent = (eventId: string) => {
    router.push(`/goods-calculator?event_id=${encodeURIComponent(eventId)}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">
            イベントグッズ計算
          </h1>
          <p className="text-sm text-slate-600">
            イベントを選んでグッズの購入金額を計算できます。入力内容と買い物リストはログインなしでこのブラウザ内に保存されます。
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/shopping-list")}
            className="mt-2"
          >
            <ListChecks className="h-4 w-4" />
            買い物リストを見る
          </Button>
        </header>

        {message ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4 text-sm text-rose-700">
              {message}
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              イベント一覧
            </h2>
            <p className="text-sm text-slate-600">
              参加予定のイベントを選択してください。
            </p>
          </div>

          {eventsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-slate-600">
                現在表示できるイベントはありません。
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <button
                  key={event.event_id}
                  type="button"
                  onClick={() => openEvent(event.event_id)}
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={`${event.artist_name} ${event.event_name}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center text-sm font-medium text-slate-500">
                        {event.artist_name}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <div className="text-sm font-medium text-slate-500">
                        {event.artist_name}
                      </div>
                      <CardTitle className="mt-1 line-clamp-2 text-base text-slate-950">
                        {event.event_name}
                      </CardTitle>
                    </div>

                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>
                          {formatDateRange(
                            event.event_start_date,
                            event.event_end_date
                          )}
                        </span>
                      </div>
                      {event.venue ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{event.venue}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
