import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    title: "第1条（個人情報）",
    body: [
      "「個人情報」とは，個人情報保護法にいう「個人情報」を指すものとし，生存する個人に関する情報であって，当該情報に含まれる氏名，生年月日，住所，電話番号，連絡先その他の記述等により特定の個人を識別できる情報及び容貌，指紋，声紋にかかるデータ，及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。"
    ],
  },
  {
  title: "第2条（情報の取得および利用目的）",
  body: [
    "当アプリでは、アカウント登録やログイン機能を提供しておらず、ユーザーの氏名、住所、電話番号、メールアドレスなどを、通常のサービス利用時に直接取得することはありません。",
    "ユーザーが入力した商品の数量や作成した買い物リスト等の情報は、原則としてユーザーの端末内のブラウザストレージに保存され、当アプリの運営者がこれらの内容を収集または閲覧することはありません。",
    "お問い合わせされた場合は、回答およびお問い合わせ対応のため、氏名、メールアドレス、その他の情報を利用することがあります。",
    "また、サービス改善、不具合調査、利用状況の分析、広告配信および不正利用の防止のため、Cookie、アクセス日時、閲覧ページ、端末やブラウザに関する情報などを取得することがあります。",
  ],
  },
  {
    title: "第3条（利用目的の変更）",
    body: [
      "当社は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。",
      "利用目的の変更を行った場合には、変更後の目的について、当社所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。",
    ],
  },
  {
    title: "第4条（広告について）",
    body: [
      "当アプリでは、第三者配信の広告サービスであるGoogle AdSenseを利用する場合があります。Googleを含む第三者配信事業者は、Cookieを使用して、ユーザーが当アプリや他のウェブサイトに過去にアクセスした情報に基づいて広告を配信することがあります。",
      "Googleの広告Cookieの使用により、Googleおよびそのパートナーは、当アプリや他のサイトへのアクセス情報に基づいてユーザーに適した広告を表示できます。",
      "ユーザーは、Googleの広告設定ページでパーソナライズ広告を無効にできます。また、第三者配信事業者によるCookieの使用を無効にする方法については、各事業者の案内をご確認ください。",
    ],
  },
  {
  title: "第5条（データの保存および削除）",
  body: [
    "ユーザーが当アプリ上で入力した商品の数量や作成した買い物リスト等の情報は、原則としてユーザーの端末内のブラウザストレージに保存されます。",
    "これらの情報は、ブラウザの設定、閲覧データの削除、端末の変更、ブラウザのアンインストール等により消失する場合があります。当アプリ運営者は、保存されたデータの復元または継続的な保存を保証するものではありません。",
    "ユーザーは、当アプリ上の削除機能またはブラウザの閲覧データ削除機能を利用することで、端末内に保存されたデータを削除できます。",
    "お問い合わせを通じて取得した情報は、お問い合わせへの対応に必要な期間保持した後、合理的な期間内に削除します。",
  ],
  },
  {
    title: "第6条（サービス内容の変更等）",
    body: [
      "当社は、ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれを承諾するものとします。",
    ],
  },
  {
  title: "第7条（非公式サービスであることおよび利用上の注意）",
  body: [
    "当アプリは、個人が提供する非公式のグッズ購入金額計算・購入計画支援サービスです。",
    "当アプリは、株式会社BMSG、BMSG所属アーティスト、各アーティストの所属事務所、レコード会社、イベント主催者、グッズ販売事業者その他の関係者とは一切関係がなく、これらの団体または関係者から公認、提携、協賛、監修または運営を受けたものではありません。",
    "当アプリは、特定の商品またはグッズの購入を推奨または強制するものではありません。商品の購入については、ユーザー自身の判断と責任において行ってください。",
    "当アプリは、ユーザーご自身の個人的かつ非営利の購入計画および金額計算を目的として利用するものとし、転売、営利目的その他第三者の権利を侵害する目的で利用しないでください。",
    "アーティスト名、イベント名、商品名、画像その他の名称および権利は、それぞれの権利者に帰属します。",
  ],
  },
  {
    title: "第8条（免責事項）",
    body: [
      "当アプリに掲載する情報や計算結果については、正確性や最新性の確保に努めますが、その内容を保証するものではありません。",
      "当アプリの利用により発生した損害、または当アプリからリンクされた外部サイトの利用により発生した損害について、当アプリ運営者は責任を負いかねます。",
    ],
  },
  {
    title: "第9条（プライバシーポリシーの変更）",
    body: [
      "当アプリは、法令の変更、サービス内容の変更、広告配信サービスの変更などに応じて、本プライバシーポリシーを改定することがあります。",
      "重要な変更がある場合は、当アプリ上で分かりやすい方法により告知します。",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-4">
          <Button asChild variant="outline" className="w-full justify-start sm:w-auto">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ホームに戻る
            </Link>
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-950">
              プライバシーポリシー
            </h1>
            <p className="text-sm text-slate-600">
              グッズ計算アプリにおける個人情報、Cookie、広告配信に関する取扱いを定めます。
            </p>
            <p className="text-sm text-slate-500">最終更新日: 2026年8月3日</p>
          </div>
        </header>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-8 p-5 sm:p-8">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-950">
                はじめに
              </h2>
              <p className="text-sm leading-7 text-slate-700">
                本ウェブサイト上で提供するサービス（以下「本サービス」といいます。）における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
              </p>
            </section>

            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-950">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-7 text-slate-700"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-950">
                第10条（お問い合わせ先）
              </h2>
              <div className="space-y-2 text-sm leading-7 text-slate-700">
                <p>
                  本プライバシーポリシーに関するお問い合わせは、以下のメールアドレスまでお願いいたします。
                </p>
                <p>
                  info@merchmemo.com
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-base font-semibold text-slate-950">
                参考リンク
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <a
                    href="https://policies.google.com/technologies/ads"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-slate-900 underline-offset-4 hover:underline"
                  >
                    Google 広告におけるCookieの利用について
                  </a>
                </li>
                <li>
                  <a
                    href="https://adssettings.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-slate-900 underline-offset-4 hover:underline"
                  >
                    Google 広告設定
                  </a>
                </li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
