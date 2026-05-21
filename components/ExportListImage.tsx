export type ExportListImageItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ExportListImageData = {
  title?: string;
  totalItems: number;
  totalAmount: number;
  items: ExportListImageItem[];
};

function formatYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function ExportListImage({ data }: { data: ExportListImageData }) {
  return (
    <div
      className="w-[720px] bg-white p-8 text-slate-950"
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily:
          'Arial, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
      }}
    >
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#ffffff" }}
      >
        <div className="border-b pb-5" style={{ borderColor: "#e2e8f0" }}>
          <div
            className="text-sm font-semibold"
            style={{ color: "#475569" }}
          >
            {data.title || "買い物リスト"}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "#f8fafc" }}
            >
              <div className="text-xs font-medium" style={{ color: "#64748b" }}>
                合計点数
              </div>
              <div className="mt-1 text-3xl font-bold">{data.totalItems}点</div>
            </div>
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "#f8fafc" }}
            >
              <div className="text-xs font-medium" style={{ color: "#64748b" }}>
                合計金額
              </div>
              <div className="mt-1 text-3xl font-bold">
                {formatYen(data.totalAmount)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div
            className="grid grid-cols-[1fr_88px_120px] gap-3 rounded-t-lg px-4 py-3 text-sm font-semibold"
            style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
          >
            <div>商品名</div>
            <div className="text-right">点数</div>
            <div className="text-right">価格</div>
          </div>

          <div className="divide-y" style={{ borderColor: "#e2e8f0" }}>
            {data.items.length > 0 ? (
              data.items.map((item) => (
                <div
                  key={`${item.name}-${item.quantity}-${item.unitPrice}`}
                  className="grid grid-cols-[1fr_88px_120px] gap-3 px-4 py-3 text-base"
                  style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-right">{item.quantity}点</div>
                  <div className="text-right">{formatYen(item.unitPrice)}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center" style={{ color: "#64748b" }}>
                選択中の商品はありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
