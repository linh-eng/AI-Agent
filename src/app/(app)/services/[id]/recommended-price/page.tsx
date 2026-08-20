"use client";
// =============================================================================
// PRICING / COSTING — PH3: Giá đề xuất (Recommended Price). Trang nội bộ trong
// Dịch vụ (không sửa sidebar/nav). Decision-support: giá vốn + biên MỤC TIÊU →
// giá bán gợi ý; so sánh Floor / Recommended / Standard. Chỉ finance.read.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COSTING_STATUS_LABEL, COSTING_STATUS_TONE } from "@/lib/clinic-labels";

const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));

export default function RecommendedPricePage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [floorData, setFloorData] = useState<any>(null); // /api/price-floors/[id]
  const [versions, setVersions] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [adjPrice, setAdjPrice] = useState<string>(""); // giá điều chỉnh (nhập tay để thử)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ costingId: string; margin: string }>({ costingId: "", margin: "40" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fd, vs] = await Promise.all([
        apiFetch<any>(`/api/price-floors/${id}`),
        apiFetch<any[]>(`/api/recommended-prices?serviceId=${id}`),
      ]);
      setFloorData(fd);
      setVersions(vs);
      setSelId((prev) => prev ?? vs.find((v) => v.status === "PUBLISHED")?.id ?? vs[0]?.id ?? null);
      setError(null);
    } catch (e: any) { setError(e?.message ?? "Không tải được dữ liệu"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const sel = versions.find((v) => v.id === selId) ?? null;
  const activeFloor = (floorData?.versions ?? []).find((v: any) => v.status === "ACTIVE") ?? null;
  const standardPrice = floorData ? Number(floorData.standardPrice) : null;

  async function createDraft() {
    if (!form.costingId) { setError("Chọn version giá vốn đã phát hành"); return; }
    setBusy(true); setError(null);
    try {
      const v = await apiFetch<any>(`/api/recommended-prices`, { method: "POST", body: JSON.stringify({ serviceId: id, serviceCostingVersionId: form.costingId, targetMarginPercent: Number(form.margin || 0) }) });
      setShowForm(false); setSelId(v.id); await load();
    } catch (e: any) { setError(e?.message ?? "Không tạo được version"); }
    finally { setBusy(false); }
  }
  async function act(path: string) {
    if (!sel) return;
    setBusy(true); setError(null);
    try { const v = await apiFetch<any>(`/api/recommended-prices/${sel.id}${path}`, { method: "POST" }); setSelId(v.id); await load(); }
    catch (e: any) { setError(e?.message ?? "Thao tác thất bại"); }
    finally { setBusy(false); }
  }

  if (!canFinance) {
    return (
      <div className="space-y-4">
        <PageHeader title="Giá đề xuất" description="Cần quyền xem dữ liệu tài chính (finance.read)." />
        <Card><CardContent className="py-8 text-center text-muted-foreground">Bạn không có quyền xem giá vốn/biên.</CardContent></Card>
      </div>
    );
  }

  const recPrice = sel ? Number(sel.calculatedRecommendedPrice) : null;
  const floorPrice = activeFloor ? Number(activeFloor.floorPrice) : null;
  // Vị trí giá chuẩn so với Floor/Recommended (derived display §13)
  let band: string | null = null;
  if (standardPrice != null) {
    if (floorPrice != null && standardPrice + 1e-6 < floorPrice) band = "Giá chuẩn DƯỚI giá sàn";
    else if (recPrice != null && standardPrice + 1e-6 < recPrice) band = "Giá chuẩn nằm giữa Giá sàn và Giá đề xuất";
    else if (recPrice != null) band = "Giá chuẩn ĐẠT/VƯỢT giá đề xuất";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Giá đề xuất${floorData ? " · " + floorData.serviceName : ""}`}
        description="Giá vốn + biên MỤC TIÊU → giá bán gợi ý. KHÁC giá sàn (tối thiểu) & bảng giá (segment); không tự sửa giá chuẩn."
        action={<Link href="/services" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Về Dịch vụ</Link>}
      />
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* So sánh Floor / Recommended / Standard */}
      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
        <Cmp label="Tổng giá vốn (Costing)" value={sel ? money(sel.costSnapshot) : "—"} />
        <Cmp label="Giá sàn (Floor ACTIVE)" value={money(floorPrice)} tone="amber" />
        <Cmp label="Giá đề xuất (Recommended)" value={money(recPrice)} tone="primary" />
        <Cmp label="Giá chuẩn (Standard)" value={money(standardPrice)} />
        {band && <div className="sm:col-span-4 text-xs text-muted-foreground">→ {band} <span className="ml-1">(hệ thống KHÔNG tự sửa giá chuẩn).</span></div>}
        <div className="sm:col-span-4 flex gap-4">
          <Link href={`/services/${id}/costing`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Xem Giá vốn</Link>
          <Link href={`/price-floor/${id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Xem Giá sàn</Link>
        </div>
      </CardContent></Card>

      {/* ① Giá điều chỉnh + % giảm tối đa (so với giá chuẩn, không được dưới giá sàn) */}
      {(() => {
        const maxDiscountPct = (standardPrice != null && floorPrice != null && floorPrice <= standardPrice && standardPrice > 0)
          ? ((standardPrice - floorPrice) / standardPrice) * 100 : null;
        const adj = adjPrice === "" ? null : Number(adjPrice);
        const adjDiscountPct = (adj != null && standardPrice != null && standardPrice > 0) ? ((standardPrice - adj) / standardPrice) * 100 : null;
        const belowFloor = adj != null && floorPrice != null && adj + 1e-6 < floorPrice;
        return (
          <Card><CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div className="font-semibold">Giá điều chỉnh &amp; mức giảm</div>
              {maxDiscountPct != null ? (
                <div className="text-muted-foreground">Giá có thể <b className="text-foreground">giảm tối đa {maxDiscountPct.toFixed(1)}%</b> (từ giá chuẩn {money(standardPrice)} về giá sàn {money(floorPrice)}).</div>
              ) : (
                <div className="text-xs text-muted-foreground">Chưa đủ dữ liệu (cần Giá chuẩn + Giá sàn ACTIVE) để tính % giảm tối đa.</div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[240px_1fr] sm:items-end">
              <div>
                <Label>Giá điều chỉnh (đ)</Label>
                <Input type="number" placeholder="Nhập giá muốn bán" value={adjPrice} onChange={(e) => setAdjPrice(e.target.value)} />
              </div>
              <div className="text-sm">
                {adj == null ? (
                  <span className="text-muted-foreground">Nhập giá điều chỉnh để xem mức giảm &amp; kiểm tra so với giá sàn.</span>
                ) : (
                  <div className="space-y-1">
                    <div>Mức giảm so với giá chuẩn: <b>{adjDiscountPct != null ? `${adjDiscountPct.toFixed(1)}%` : "—"}</b>{adjDiscountPct != null && adjDiscountPct < 0 ? " (cao hơn giá chuẩn)" : ""}</div>
                    {belowFloor
                      ? <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">⚠ Giá điều chỉnh <b>DƯỚI giá sàn</b> ({money(floorPrice)}) — cần người có quyền duyệt bán dưới sàn.</div>
                      : floorPrice != null && <div className="text-emerald-600">✓ Trong khung cho phép (≥ giá sàn {money(floorPrice)}).</div>}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Công cụ tính nhanh — KHÔNG tự sửa giá chuẩn/giá bán. Bán dưới giá sàn phải qua duyệt (Giá sàn / Báo giá).</p>
          </CardContent></Card>
        );
      })()}

      {loading ? <Card><CardContent className="py-8 text-center text-muted-foreground">Đang tải…</CardContent></Card> : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <Card><CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Phiên bản</div>
              {canWrite && <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}><Plus className="mr-1 h-3.5 w-3.5" /> Mới</Button>}
            </div>
            <div className="space-y-1">
              {versions.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Chưa có giá đề xuất.</div>}
              {versions.map((v) => (
                <button key={v.id} onClick={() => setSelId(v.id)} className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm ${selId === v.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
                  <span>v{v.version} · {money(v.calculatedRecommendedPrice)}</span>
                  <Badge tone={COSTING_STATUS_TONE[v.status] ?? "muted"}>{COSTING_STATUS_LABEL[v.status] ?? v.status}</Badge>
                </button>
              ))}
            </div>
          </CardContent></Card>

          <div className="space-y-4">
            {showForm && canWrite && (
              <Card><CardContent className="space-y-3 p-4">
                <div className="text-sm font-semibold">Tạo giá đề xuất (Bản nháp)</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Version giá vốn (đã phát hành)</Label>
                    <Select value={form.costingId} onChange={(e) => setForm({ ...form, costingId: e.target.value })}>
                      <option value="">— Chọn —</option>
                      {(floorData?.publishedCostings ?? []).map((c: any) => <option key={c.id} value={c.id}>Giá vốn v{c.version}{c.totalEstimatedCost != null ? ` · ${formatCurrency(c.totalEstimatedCost)}` : ""}</option>)}
                    </Select>
                  </div>
                  <div><Label>Biên mục tiêu (%)</Label><Input type="number" value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })} /></div>
                </div>
                {(floorData?.publishedCostings ?? []).length === 0 && <p className="text-xs text-amber-600">Dịch vụ chưa có Giá vốn phát hành. <Link href={`/services/${id}/costing`} className="text-primary hover:underline">Thiết lập Giá vốn</Link></p>}
                {activeFloor && <p className="text-xs text-muted-foreground">Ràng buộc: biên mục tiêu ≥ biên tối thiểu giá sàn ({canFinance && activeFloor.minMarginPercent != null ? `${Number(activeFloor.minMarginPercent)}%` : "•••"}) và giá đề xuất ≥ giá sàn ({money(floorPrice)}).</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={createDraft} disabled={busy || !form.costingId}>Tạo bản nháp</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
                </div>
              </CardContent></Card>
            )}

            {sel && (
              <Card><CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Giá đề xuất — v{sel.version}</div>
                  <Badge tone={COSTING_STATUS_TONE[sel.status] ?? "muted"}>{COSTING_STATUS_LABEL[sel.status] ?? sel.status}</Badge>
                </div>
                <table className="w-full text-sm"><tbody>
                  <Row k="Tổng giá vốn (snapshot)" v={money(sel.costSnapshot)} />
                  <Row k="Biên mục tiêu" v={sel.targetMarginPercent != null ? `${Number(sel.targetMarginPercent)}%` : "•••"} />
                  <Row k="Công thức" v={`giá vốn / (1 − ${sel.targetMarginPercent != null ? Number(sel.targetMarginPercent) : "•••"}%)`} muted />
                  <Row k="Giá sàn tham chiếu" v={money(sel.floorPriceSnapshot)} />
                  <Row k="GIÁ ĐỀ XUẤT" v={money(sel.calculatedRecommendedPrice)} bold highlight />
                </tbody></table>
                <div className="grid gap-x-6 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>Tạo: {sel.createdBy ?? "—"} · {formatDateTime(sel.createdAt)}</div>
                  {sel.publishedAt && <div>Phát hành: {sel.publishedBy ?? "—"} · {formatDateTime(sel.publishedAt)}</div>}
                </div>
                {canWrite && sel.status === "DRAFT" && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => act("/recalculate")} disabled={busy}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Tính lại</Button>
                    <Button size="sm" onClick={() => act("/publish")} disabled={busy}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Phát hành</Button>
                  </div>
                )}
                {sel.status !== "DRAFT" && <p className="border-t pt-2 text-xs text-muted-foreground">Version đã phát hành là bất biến. Tạo version mới để cập nhật.</p>}
              </CardContent></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Cmp({ label, value, tone }: { label: string; value: string; tone?: "amber" | "primary" }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className={`text-base font-semibold ${tone === "amber" ? "text-amber-600" : tone === "primary" ? "text-primary" : ""}`}>{value}</div></div>;
}
function Row({ k, v, bold, highlight, muted }: { k: string; v: string; bold?: boolean; highlight?: boolean; muted?: boolean }) {
  return <tr className={highlight ? "bg-primary/5" : ""}><td className={`py-1 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>{k}</td><td className={`py-1 text-right ${bold ? "font-semibold" : ""} ${highlight ? "text-primary" : ""} ${muted ? "text-xs text-muted-foreground" : ""}`}>{v}</td></tr>;
}
