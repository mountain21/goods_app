"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// 💡 Supabaseのテーブル構造を想定した型定義
interface Event {
  id: number;
  name: string;
  event_date: string;
}

interface Item {
  id: number;
  event_id: number;
  name: string;
  price: number;
  max_per_person: number;
  category: string;
}

export default function GoodsCalculator() {
  // 1. Supabaseから取得する予定の「イベント一覧」のモックデータ
  const [events] = useState<Event[]>([
    { id: 1, name: "春のファンミーティング 2026", event_date: "2026-05-20" },
    { id: 2, name: "夏のスタジアムツアー 2026", event_date: "2026-08-15" },
  ]);

  // 2. Supabaseから取得する予定の「グッズマスター」のモックデータ
  const [allLines] = useState<Item[]>([
    // イベント1のグッズ
    { id: 101, event_id: 1, name: "缶バッジ（ランダム）", price: 500, max_per_person: 10, category: "ランダム" },
    { id: 102, event_id: 1, name: "アクリルスタンド", price: 1500, max_per_person: 3, category: "オープン" },
    { id: 103, event_id: 1, name: "公式マフラータオル", price: 2500, max_per_person: 2, category: "アパレル" },
    { id: 104, event_id: 1, name: "イベントTシャツ", price: 3500, max_per_person: 1, category: "アパレル" },
    // イベント2のグッズ
    { id: 201, event_id: 2, name: "クリアファイル", price: 400, max_per_person: 5, category: "オープン" },
    { id: 202, event_id: 2, name: "ツアー限定ペンライト", price: 3000, max_per_person: 2, category: "グッズ" },
    { id: 203, event_id: 2, name: "ランダムフォトカード", price: 300, max_per_person: 20, category: "ランダム" },
  ]);

  // 選択中のイベントID管理（初期値は1つ目のイベント）
  const [selectedEventId, setSelectedEventId] = useState<string>("1");
  // 選択中の数量管理
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  // 特典金額のボーダー
  const [bonusBorder, setBonusBorder] = useState<number>(3000);

  // 現在選択されているイベントに紐づくグッズだけをフィルタリング
  const currentItems = useMemo(() => {
    return allLines.filter(item => item.event_id === Number(selectedEventId));
  }, [selectedEventId, allLines]);

  // 数量の変更
  const updateQuantity = (id: number, delta: number, max: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next < 0 || next > max) return prev;
      return { ...prev, [id]: next };
    });
  };

  const resetCart = () => setQuantities({});

  // 計算処理
  const { totalAmount, totalItems, bonusCount } = useMemo(() => {
    let totalAmount = 0;
    let totalItems = 0;

    Object.entries(quantities).forEach(([itemIdStr, qty]) => {
      const itemId = Number(itemIdStr);
      const item = currentItems.find((i) => i.id === itemId);
      if (item) {
        totalAmount += item.price * qty;
        totalItems += qty;
      }
    });

    const bonusCount = bonusBorder > 0 ? Math.floor(totalAmount / bonusBorder) : 0;
    return { totalAmount, totalItems, bonusCount };
  }, [quantities, currentItems, bonusBorder]);

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* 上部：イベントセレクター */}
        <Card className="border-indigo-100 bg-white shadow-sm">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-indigo-950">
                推し活物販計算シミュレーター
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                CodeX (shadcn/ui) コンポーネント実装版
              </p>
            </div>
            <div className="w-full sm:w-72 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">イベント選択:</span>
              <Select value={selectedEventId} onValueChange={(val) => { setSelectedEventId(val); resetCart(); }}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                  <SelectValue placeholder="イベントを選択" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id.toString()}>
                      {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* 左側：商品ラインナップ（テーブル表示） */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  📦 商品ラインナップ
                </CardTitle>
                <CardDescription>
                  数量を調整してください。購入上限を超えないようガードされます。
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/40">
                    <TableRow>
                      <TableHead className="w-[45%]">商品名</TableHead>
                      <TableHead className="w-[25%]">価格</TableHead>
                      <TableHead className="w-[30%] text-center">数量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((item) => {
                      const currentQty = quantities[item.id] || 0;
                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="align-middle py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{item.name}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none font-medium">
                                  {item.category}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-red-500 font-medium">一人最大 {item.max_per_person} 点まで</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-middle font-medium text-slate-600">
                            ¥{item.price.toLocaleString()}
                          </TableCell>
                          <TableCell className="align-middle text-center">
                            <div className="flex items-center justify-center gap-3">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full border-slate-300"
                                onClick={() => updateQuantity(item.id, -1, item.max_per_person)}
                                disabled={currentQty === 0}
                              >
                                ─
                              </Button>
                              <span className={`w-6 text-center font-bold text-sm ${currentQty > 0 ? "text-indigo-600 font-extrabold" : "text-slate-400"}`}>
                                {currentQty}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full border-slate-300"
                                onClick={() => updateQuantity(item.id, 1, item.max_per_person)}
                                disabled={currentQty >= item.max_per_person}
                              >
                                ＋
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* 右側：計算結果（サイドバー） */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <Card className="border-indigo-950 bg-indigo-950 text-white shadow-md overflow-hidden">
              <CardHeader className="border-b border-indigo-900/60 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    🛒 計算結果
                  </CardTitle>
                  {totalItems > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetCart}
                      className="text-xs text-indigo-200 hover:text-white hover:bg-indigo-900/50 h-8 px-2.5"
                    >
                      クリア
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-6 space-y-6">
                <div className="flex justify-between items-center text-sm text-indigo-200">
                  <span>合計選択点数</span>
                  <span className="font-bold text-white text-base">{totalItems} 点</span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-indigo-200 font-medium">合計金額</span>
                  <div className="text-3xl font-black tracking-tight text-white">
                    ¥{totalAmount.toLocaleString()}
                  </div>
                </div>

                {/* 特典計算ブロック */}
                <div className="pt-4 border-t border-indigo-900/60 space-y-4">
                  <div className="flex items-center justify-between gap-4 bg-indigo-900/40 p-3 rounded-lg border border-indigo-900/40">
                    <span className="text-xs text-indigo-200 font-medium whitespace-nowrap">特典条件 (円)</span>
                    <Input
                      type="number"
                      value={bonusBorder}
                      onChange={(e) => setBonusBorder(Number(e.target.value))}
                      className="w-24 bg-indigo-900 border-indigo-800 text-white text-right font-bold text-sm h-8 focus-visible:ring-indigo-400"
                    />
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm text-indigo-200">もらえる特典</span>
                    <span className="text-xl font-bold text-amber-300">✨ {bonusCount} 枚</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="bg-indigo-900/30 border-t border-indigo-900/40 py-4">
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition-all text-xs h-10"
                  disabled={totalItems === 0}
                >
                  💾 この計算結果を保存する（準備中）
                </Button>
              </CardFooter>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}