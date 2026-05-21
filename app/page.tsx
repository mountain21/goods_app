"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  ListChecks,
  LogIn,
  LogOut,
  MapPin,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/client";

const DUMMY_AUTH_DOMAIN = "mountainorg.exampledummy.com";

type EventRow = {
  event_id: string;
  artist_name: string;
  event_name: string;
  event_start_date: string;
  event_end_date: string;
  venue: string | null;
  image_url: string | null;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
};

function createDummyEmail(userName: string) {
  return `${userName.trim()}@${DUMMY_AUTH_DOMAIN}`;
}

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
  const [authBusy, setAuthBusy] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("events")
        .select(
          "event_id, artist_name, event_name, event_start_date, event_end_date, venue, image_url"
        )
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
          logError("getSession error", error);
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

  const handleAuth = async (mode: "signin" | "signup") => {
    setAuthBusy(true);
    setMessage(null);

    try {
      const trimmedUserName = userName.trim();
      if (!trimmedUserName || !password) {
        throw new Error("ユーザー名とパスワードを入力してください");
      }

      const dummyEmail = createDummyEmail(trimmedUserName);
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({
              email: dummyEmail,
              password,
            })
          : await supabase.auth.signUp({
              email: dummyEmail,
              password,
              options: {
                data: {
                  username: trimmedUserName,
                },
              },
            });

      if (error) throw error;
      setMessage(mode === "signin" ? "ログインしました" : "登録しました");
    } catch (error) {
      logError(`${mode} error`, error);
      setMessage(getErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessage("ログアウトしました");
    } catch (error) {
      logError("signOut error", error);
      setMessage(getErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

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
            イベントを選んでグッズを計算し、ログインして買い物リストを保存できます。
          </p>
        </header>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            {authLoading ? (
              <div className="text-sm text-slate-600">ログイン状態を確認中...</div>
            ) : session?.user ? (
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
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={authBusy}
                    className="w-full sm:w-auto"
                  >
                    <LogOut />
                    ログアウト
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-base font-semibold text-slate-950">
                    ユーザー名でログインしてマイリストを保存しよう！
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    メールアドレスは不要です。ユーザー名とパスワードで利用できます。
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                  <Input
                    value={userName}
                    onChange={(event) => setUserName(event.target.value)}
                    placeholder="ユーザー名"
                    autoComplete="username"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="パスワード"
                    autoComplete="current-password"
                  />
                  <Button
                    onClick={() => void handleAuth("signin")}
                    disabled={authBusy}
                    className="w-full sm:w-auto"
                  >
                    <LogIn />
                    ログイン
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleAuth("signup")}
                    disabled={authBusy}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus />
                    アカウント登録
                  </Button>
                </div>
              </div>
            )}

            {message ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {message}
              </div>
            ) : null}
          </CardContent>
        </Card>

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
