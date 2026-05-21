import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "グッズ計算アプリ",
  description: "イベントグッズの購入金額を計算し、買い物リストを保存できるアプリです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
