import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {

  metadataBase: new URL("https://merchmemo.com"),

  title: "グッズ計算機",
  description: "イベントグッズの購入金額を計算し、買い物リストを保存できるアプリです。",

   openGraph: {
    title: "グッズ計算機",
    description:
      "ライブやイベントのグッズ購入金額をかんたんに計算できるグッズ計算アプリです。",
    url: "https://merchmemo.com",
    siteName: "MerchMemo",
    locale: "ja_JP",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "グッズ計算機",
    description:
      "ライブやイベントのグッズ購入金額をかんたんに計算できるグッズ計算アプリです。",
  },
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
