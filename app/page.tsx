"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  ListChecks,
  LogOut,
  MapPin,
} from "lucide-react";
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

function getUsername(session: Session | null) {
  const username = session?.user.user_metadata?.username;
  return typeof username === "string" && username.trim()
    ? username.trim()
    : "ゲスト";
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

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
          "event_id, artist_name, event_name, event_start_date, event_end_date, venue, image_url"
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
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          setMessage(`ログイン状態の確認に失敗しました: ${getErrorMessage(error)}`);
        }

        setSession(data.session);
        setAuthLoading(false);
      });

      void loadEvents();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadEvents, supabase]);


  const openEvent = (eventId: string) => {
    router.push(`/goods-calculator?event_id=${encodeURIComponent(eventId)}`);
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">
            イベントグッズ計算
          </h1>
          <p className="text-sm text-slate-600">
            イベントを選んでグッズを計算し、ログインして買い物リストを保存できます。
          </p>
        </header>

        {authLoading ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-600">ログイン状態を確認中...</div>
            </CardContent>
          </Card>
        ) : session?.user ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-950">
                    ようこそ、{getUsername(session)}さん！
                  </div>
                  <div className="text-sm text-slate-600">
                    保存した買い物リストを確認できます。
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/shopping-list")}
                    className="w-full sm:w-auto"
                  >
                    <ListChecks />
                    買い物リスト
                  </Button>
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

              {message ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {message}
                </div>
              ) : null}
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
