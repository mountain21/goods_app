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
    title: "第2条（個人情報の利用目的）",
    body: [
      "取得した情報は、当アプリの提供、ユーザー認証、買い物リストの保存・表示・編集、サービス改善、不具合調査、利用状況の分析、お問い合わせへの回答、規約違反や不正利用の防止のために利用します。",
      "また、広告配信やアクセス解析を行う場合、Cookie等を用いて利用状況に関する情報を取得することがあります。",
    ],
  },
  {
    title: "第3条（ユーザーIDおよびパスワードの管理）",
    body: [
      "ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。",
      "ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、もしくは第三者と共用することはできません。当社は、ユーザーIDとパスワードの組み合わせが登録情報と一致してログインされた場合には、そのユーザーIDを登録しているユーザー自身による利用とみなします。",
      "ユーザーID及びパスワードが第三者によって使用されたことによって生じた損害は、当社に故意又は重大な過失がある場合を除き、当社は一切の責任を負わないものとします。"
    ],
  },
  {
    title: "第4条（利用目的の変更）",
    body: [
      "当社は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。",
      "利用目的の変更を行った場合には、変更後の目的について、当社所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。",
    ],
  },
  {
    title: "第5条（広告について）",
    body: [
      "当アプリでは、第三者配信の広告サービスであるGoogle AdSenseを利用する場合があります。Googleを含む第三者配信事業者は、Cookieを使用して、ユーザーが当アプリや他のウェブサイトに過去にアクセスした情報に基づいて広告を配信することがあります。",
      "Googleの広告Cookieの使用により、Googleおよびそのパートナーは、当アプリや他のサイトへのアクセス情報に基づいてユーザーに適した広告を表示できます。",
      "ユーザーは、Googleの広告設定ページでパーソナライズ広告を無効にできます。また、第三者配信事業者によるCookieの使用を無効にする方法については、各事業者の案内をご確認ください。",
    ],
  },
  {
    title: "第6条（データ保持ポリシー）",
    body: [
      "サービス提供者は、ユーザー提供データを、お客様が本アプリケーションを使用している間、およびその後妥当な期間保持します。本アプリケーションを通じて提供したデータの削除を希望される場合は、app.contact.ayumi@gmail.comまでご連絡ください。妥当な期間内に対応いたします。",
    ],
  },
  {
    title: "第7条（サービス内容の変更等）",
    body: [
      "当社は、ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれを承諾するものとします。",
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

const contactFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfVamafuasqJXObWZw8th9wNh92XsoOHTn0wenYH8ieFU-PFg/viewform?usp=publish-editor";

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
            <p className="text-sm text-slate-500">最終更新日: 2026年5月21日</p>
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
                  本プライバシーポリシーに関するお問い合わせは、以下のフォームからお願いいたします。
                </p>
                <p>
                  お問い合わせ先:{" "}
                  <a
                    href={contactFormUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-slate-900"
                  >
                    Googleフォーム
                  </a>
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
