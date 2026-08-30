"use client";
// =============================================================================
// IA-PH2 — Workspace "Giá bán đề xuất" (toàn cục, read-only). Tổng hợp giá bán
// đề xuất theo dịch vụ (version PUBLISHED / mới nhất) + link sang trang chi tiết
// (/services/[id]/recommended-price) để tạo/phát hành.
// KHÔNG thêm entity/logic: chỉ COMPOSE/ĐỌC qua API sẵn có. targetMargin/costSnapshot
// server đã mask theo finance.read (BLOCKER). Giá đề xuất hiển thị như guardrail.
// =============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Calculator } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COSTING_STATUS_LABEL, COSTING_STATUS_TONE } from "@/lib/clinic-labels";

const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));

interface Row {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  standardPrice: number | null;
  versionCount: number;
  publishedVersion: any | null;
  latestVersion: any | null;
}

// -----------------------------------------------------------------------------
// Máy tính giá theo LỢI NHUẬN (client-side, decision-support). Nhập chi phí +
// biên/markup → ra giá bán + lãi. KHÔNG lưu DB, KHÔNG đụng engine giá vốn/giá sàn.
// -----------------------------------------------------------------------------
function ProfitCalculator() {
  const [cost, setCost] = useState("");
  const [pct, setPct] = useState("");
  const [mode, setMode] = useState<"MARGIN" | "MARKUP">("MARGIN");
  const [round, setRound] = useState(true);

  const r = useMemo(() => {
    const c = Number(cost) || 0;
    const p = Number(pct) || 0;
    if (c <= 0 || p < 0) return null;
    let price: number;
    if (mode === "MARGIN") {
      if (p >= 100) return { err: "Biên lợi nhuận phải nhỏ hơn 100%." } as any;
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

  return (
    <Card className="mb-4 border-primary/30">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Máy tính giá theo lợi nhuận</h3>
          <span className="text-xs text-muted-foreground">Nhập giá vốn + % lợi nhuận → ra giá bán (công cụ tính nhanh, không lưu).</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Chi phí / giá vốn (đ) *</Label>
            <Input type="number" inputMode="numeric" placeholder="VD 913000" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cách tính</Label>
            <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value as any)}>
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
          <p className="mt-3 text-sm text-destructive">{(r as any).err}</p>
        ) : r ? (
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
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Nhập giá vốn và % để xem kết quả. Công thức: Biên → Giá bán = Giá vốn ÷ (1 − biên%); Cộng lãi → Giá bán = Giá vốn × (1 + %).</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Đây là công cụ tính nhanh. Để lưu giá vốn có version + phát hành giá đề xuất chính thức, bấm <b>Chi tiết</b> ở dịch vụ bên dưới.</p>
      </CardContent>
    </Card>
  );
}

export default function RecommendedPriceWorkspacePage() {
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Row[]>("/api/recommended-prices");
      setRows(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const kw = q.trim().toLowerCase();
  const filtered = kw
    ? rows.filter((r) => r.serviceName.toLowerCase().includes(kw) || r.serviceCode.toLowerCase().includes(kw))
    : rows;

  return (
    <div>
      <PageHeader
        title="Giá bán đề xuất"
        description="Tổng hợp giá bán đề xuất theo biên mục tiêu (decision-support). Bấm dịch vụ để xem/tạo/phát hành chi tiết."
      />

      <ProfitCalculator />

      {!canFinance && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bạn không có quyền xem dữ liệu tài chính (<code>finance.read</code>). Biên mục tiêu & giá vốn nền
          được ẩn; chỉ hiển thị mức giá đề xuất.
        </div>
      )}

      <div className="mb-4 max-w-sm">
        <Input placeholder="Tìm theo tên / mã dịch vụ…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Dịch vụ</th>
                  <th className="px-4 py-3 text-right">Giá chuẩn</th>
                  <th className="px-4 py-3 text-right">Giá đề xuất (phát hành)</th>
                  <th className="px-4 py-3 text-center">Version</th>
                  <th className="px-4 py-3 text-center">Trạng thái mới nhất</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Đang tải…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chưa có dịch vụ nào khai báo giá bán đề xuất.</td></tr>
                ) : (
                  filtered.map((r) => {
                    const pub = r.publishedVersion;
                    const latest = r.latestVersion;
                    return (
                      <tr key={r.serviceId} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3 font-mono text-xs">{r.serviceCode}</td>
                        <td className="px-4 py-3 font-medium">{r.serviceName}</td>
                        <td className="px-4 py-3 text-right">{money(r.standardPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          {pub ? money(pub.calculatedRecommendedPrice) : <span className="text-muted-foreground">Chưa phát hành</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pub ? `v${pub.version}` : latest ? `v${latest.version}` : "—"}
                          <span className="ml-1 text-xs text-muted-foreground">/{r.versionCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {latest ? (
                            <Badge tone={COSTING_STATUS_TONE[latest.status] as any}>{COSTING_STATUS_LABEL[latest.status] ?? latest.status}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/services/${r.serviceId}/recommended-price`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Chi tiết <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
