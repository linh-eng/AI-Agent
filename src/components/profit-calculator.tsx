"use client";
// =============================================================================
// Máy tính giá theo LỢI NHUẬN (client-side, decision-support). Nhập chi phí +
// biên/markup → ra giá bán + lãi. KHÔNG lưu DB, KHÔNG đụng engine giá vốn/giá sàn.
// Dùng chung: trang Giá bán đề xuất + form tạo Dịch vụ (có nút "Dùng giá này").
// =============================================================================
import { useMemo, useState } from "react";
import { Calculator, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export function ProfitCalculator({
  defaultCost = "", defaultPct = "", onApply, applyLabel = "Dùng giá này", embedded = false,
}: {
  defaultCost?: string;
  defaultPct?: string;
  /** Nếu truyền, hiện nút áp giá bán tính được ra ngoài (vd điền vào Giá chuẩn). */
  onApply?: (price: number) => void;
  applyLabel?: string;
  /** embedded = bỏ khung Card (nhúng trong form khác). */
  embedded?: boolean;
}) {
  const [cost, setCost] = useState(defaultCost);
  const [pct, setPct] = useState(defaultPct);
  const [mode, setMode] = useState<"MARGIN" | "MARKUP">("MARGIN");
  const [round, setRound] = useState(true);

  const r = useMemo(() => {
    const c = Number(cost) || 0;
    const p = Number(pct) || 0;
    if (c <= 0 || p < 0) return null;
    let price: number;
    if (mode === "MARGIN") {
      if (p >= 100) return { err: "Biên lợi nhuận phải nhỏ hơn 100%." } as const;
      price = c / (1 - p / 100);
    } else {
      price = c * (1 + p / 100);
    }
    if (round) price = Math.ceil(price / 1000) * 1000;
    const profit = price - c;
    const realMargin = price > 0 ? (profit / price) * 100 : 0;
    const realMarkup = c > 0 ? (profit / c) * 100 : 0;
    return { price, profit, realMargin, realMarkup };
  }, [cost, pct, mode, round]);

  const body = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Máy tính giá theo lợi nhuận</h3>
        <span className="text-xs text-muted-foreground">Nhập giá vốn + % lợi nhuận → ra giá bán (tính nhanh, không lưu).</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Chi phí / giá vốn (đ) *</Label>
          <Input type="number" inputMode="numeric" placeholder="VD 913000" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cách tính</Label>
          <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value as "MARGIN" | "MARKUP")}>
            <option value="MARGIN">Biên lợi nhuận (% trên giá bán)</option>
            <option value="MARKUP">Cộng lãi (% trên giá vốn)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{mode === "MARGIN" ? "Biên lợi nhuận (%) *" : "Cộng lãi (%) *"}</Label>
          <Input type="number" inputMode="numeric" placeholder="VD 40" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} /> Làm tròn 1.000đ
          </label>
        </div>
      </div>

      {r && "err" in r ? (
        <p className="mt-3 text-sm text-destructive">{r.err}</p>
      ) : r ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-primary/5 p-3">
              <div className="text-xs text-muted-foreground">Giá bán đề xuất</div>
              <div className="text-xl font-bold text-primary">{formatCurrency(r.price)}</div>
            </div>
            <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <div className="text-xs text-muted-foreground">Lãi / đơn</div>
              <div className="text-xl font-bold text-emerald-600">{formatCurrency(r.profit)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Biên thực · Markup thực</div>
              <div className="text-lg font-semibold">{r.realMargin.toFixed(1)}% · {r.realMarkup.toFixed(1)}%</div>
            </div>
          </div>
          {onApply && (
            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => onApply(r.price)}>
                <Check className="mr-1 h-3.5 w-3.5" /> {applyLabel} ({formatCurrency(r.price)})
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Nhập giá vốn và % để xem kết quả. Công thức: Biên → Giá bán = Giá vốn ÷ (1 − biên%); Cộng lãi → Giá bán = Giá vốn × (1 + %).</p>
      )}
    </>
  );

  if (embedded) return <div className="rounded-lg border border-primary/30 bg-muted/20 p-4">{body}</div>;
  return <Card className="mb-4 border-primary/30"><CardContent className="p-4">{body}</CardContent></Card>;
}
