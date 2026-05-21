import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>© 2026 グッズ計算アプリ</div>
        <nav aria-label="フッターナビゲーション">
          <Link
            href="/privacy-policy"
            className="font-medium text-slate-700 transition hover:text-slate-950 hover:underline"
          >
            プライバシーポリシー
          </Link>
        </nav>
      </div>
    </footer>
  );
}
