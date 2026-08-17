"use client";
// =============================================================================
// PRICING / COSTING — PH5: Giá & Chi phí GÓI (Protocol SERVICES). Trang nội bộ
// trong Protocol (không sửa sidebar/nav). Giá vốn gói (Σ dịch vụ bắt buộc +
// chi phí riêng) → giá sàn gói → giá đề xuất gói; so sánh với giá bán lẻ. finance.read.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COSTING_STATUS_LABEL, COSTING_STATUS_TONE } from "@/lib/clinic-labels";

const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));

export default function ProtocolPricingPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [costForm, setCostForm] = useState({ pkgCost: "0", reason: "" });
  const [floorForm, setFloorForm] = useState({ costingId: "", margin: "30" });
  const [recForm, setRecForm] = useState({ costingId: "", margin: "40" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch<any>(`/api/protocol-pricing/${id}`)); setError(null); }
    catch (e: any) { setError(e?.message ?? "Không tải được"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setError(null); setWarnings([]);
    try { const r = await fn(); if (r?.warnings) setWarnings(r.warnings); await load(); }
    catch (e: any) { setError(e?.message ?? "Thao tác thất bại"); }
    finally { setBusy(false); }
  }
  const createCosting = () => run(() => apiFetch(`/api/protocol-costings`, { method: "POST", body: JSON.stringify({ protocolId: id, packageSpecificCost: Number(costForm.pkgCost) || 0, packageSpecificReason: Number(costForm.pkgCost) > 0 ? costForm.reason : undefined }) }));
  const publishCosting = (cid: string) => run(() => apiFetch(`/api/protocol-costings/${cid}/publish`, { method: "POST" }));
  const createFloor = () => run(() => apiFetch(`/api/protocol-floor-prices`, { method: "POST", body: JSON.stringify({ protocolId: id, protocolCostingVersionId: floorForm.costingId, minMarginPercent: Number(floorForm.margin) || 0 }) }));
  const publishFloor = (fid: string) => run(() => apiFetch(`/api/protocol-floor-prices/${fid}/publish`, { method: "POST" }));
  const createRec = () => run(() => apiFetch(`/api/protocol-recommended-prices`, { method: "POST", body: JSON.stringify({ protocolId: id, protocolCostingVersionId: recForm.costingId, targetMarginPercent: Number(recForm.margin) || 0 }) }));
  const publishRec = (rid: string) => run(() => apiFetch(`/api/protocol-recommended-prices/${rid}/publish`, { method: "POST" }));

  if (!canFinance) return (
    <div className="space-y-4"><PageHeader title="Giá & chi phí gói" description="Cần quyền tài chính (finance.read)." /><Card><CardContent className="py-8 text-center text-muted-foreground">Không đủ quyền.</CardContent></Card></div>
  );
  if (loading || !data) return <Card><CardContent className="py-8 text-center text-muted-foreground">Đang tải…</CardContent></Card>;

  const publishedCostings = (data.costings ?? []).filter((c: any) => c.status === "PUBLISHED");
  const isServices = data.protocol.compositionMode === "SERVICES";

  return (
    <div className="space-y-4">
      <PageHeader title={`Giá & chi phí gói · ${data.protocol.name}`} description="Giá vốn gói = Σ dịch vụ BẮT BUỘC + chi phí riêng. Giá sàn/đề xuất gói tách khỏi cấp dịch vụ."
        action={<Link href={`/protocols/${id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Về Protocol</Link>} />
      {!isServices && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Protocol này tổ chức theo BƯỚC (LEGACY) — giá gói chỉ áp cho protocol tổ chức theo Dịch vụ (SERVICES).</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {warnings.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><ul className="list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}

      {/* So sánh */}
      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
        <Cmp label="Tổng giá vốn gói" value={money(data.active.totalCost)} />
        <Cmp label="Giá sàn gói (ACTIVE)" value={money(data.active.floorPrice)} tone="amber" />
        <Cmp label="Giá đề xuất gói (ACTIVE)" value={money(data.active.recommendedPrice)} tone="primary" />
        <Cmp label="Giá bán gói (PriceBook)" value={money(data.comparison.packagePrice)} />
        <div className="sm:col-span-4 text-xs text-muted-foreground">Σ giá bán lẻ dịch vụ bắt buộc: <b>{money(data.comparison.sumRetail)}</b>{data.comparison.saving != null && <> · Tiết kiệm gói: <b>{money(data.comparison.saving)}</b></>} — chỉ so sánh thương mại, không sửa PriceRule.</div>
      </CardContent></Card>

      {isServices && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Giá vốn gói */}
          <Card><CardContent className="space-y-2 p-3">
            <div className="text-sm font-semibold">Giá vốn gói</div>
            {canWrite && <div className="space-y-2 rounded border p-2">
              <div><Label className="text-xs">Chi phí riêng của gói (đ)</Label><Input className="h-8" type="number" value={costForm.pkgCost} onChange={(e) => setCostForm({ ...costForm, pkgCost: e.target.value })} /></div>
              {Number(costForm.pkgCost) > 0 && <div><Label className="text-xs">Lý do <span className="text-red-500">*</span></Label><Input className="h-8" value={costForm.reason} onChange={(e) => setCostForm({ ...costForm, reason: e.target.value })} /></div>}
              <Button size="sm" onClick={createCosting} disabled={busy}><Plus className="mr-1 h-3.5 w-3.5" /> Tạo bản nháp</Button>
            </div>}
            {(data.costings ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>v{c.version} · {money(c.totalEstimatedCost)}</span>
                <span className="flex items-center gap-1">
                  <Badge tone={COSTING_STATUS_TONE[c.status] ?? "muted"}>{COSTING_STATUS_LABEL[c.status] ?? c.status}</Badge>
                  {canWrite && c.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => publishCosting(c.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                </span>
              </div>
            ))}
          </CardContent></Card>

          {/* Giá sàn gói */}
          <Card><CardContent className="space-y-2 p-3">
            <div className="text-sm font-semibold">Giá sàn gói</div>
            {canWrite && <div className="space-y-2 rounded border p-2">
              <div><Label className="text-xs">Từ giá vốn (đã phát hành)</Label><Select className="h-8" value={floorForm.costingId} onChange={(e) => setFloorForm({ ...floorForm, costingId: e.target.value })}><option value="">— Chọn —</option>{publishedCostings.map((c: any) => <option key={c.id} value={c.id}>v{c.version} · {money(c.totalEstimatedCost)}</option>)}</Select></div>
              <div><Label className="text-xs">Biên tối thiểu (%)</Label><Input className="h-8" type="number" value={floorForm.margin} onChange={(e) => setFloorForm({ ...floorForm, margin: e.target.value })} /></div>
              <Button size="sm" onClick={createFloor} disabled={busy || !floorForm.costingId}><Plus className="mr-1 h-3.5 w-3.5" /> Tạo</Button>
            </div>}
            {(data.floors ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>v{f.version} · {money(f.floorPrice)}{f.minMarginPercent != null ? ` (${f.minMarginPercent}%)` : ""}</span>
                <span className="flex items-center gap-1"><Badge tone={COSTING_STATUS_TONE[f.status] ?? "muted"}>{COSTING_STATUS_LABEL[f.status] ?? f.status}</Badge>{canWrite && f.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => publishFloor(f.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}</span>
              </div>
            ))}
          </CardContent></Card>

          {/* Giá đề xuất gói */}
          <Card><CardContent className="space-y-2 p-3">
            <div className="text-sm font-semibold">Giá đề xuất gói</div>
            {canWrite && <div className="space-y-2 rounded border p-2">
              <div><Label className="text-xs">Từ giá vốn (đã phát hành)</Label><Select className="h-8" value={recForm.costingId} onChange={(e) => setRecForm({ ...recForm, costingId: e.target.value })}><option value="">— Chọn —</option>{publishedCostings.map((c: any) => <option key={c.id} value={c.id}>v{c.version} · {money(c.totalEstimatedCost)}</option>)}</Select></div>
              <div><Label className="text-xs">Biên mục tiêu (%)</Label><Input className="h-8" type="number" value={recForm.margin} onChange={(e) => setRecForm({ ...recForm, margin: e.target.value })} /></div>
              <Button size="sm" onClick={createRec} disabled={busy || !recForm.costingId}><Plus className="mr-1 h-3.5 w-3.5" /> Tạo</Button>
            </div>}
            {(data.recommendeds ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>v{r.version} · {money(r.calculatedRecommendedPrice)}{r.targetMarginPercent != null ? ` (${r.targetMarginPercent}%)` : ""}</span>
                <span className="flex items-center gap-1"><Badge tone={COSTING_STATUS_TONE[r.status] ?? "muted"}>{COSTING_STATUS_LABEL[r.status] ?? r.status}</Badge>{canWrite && r.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => publishRec(r.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}</span>
              </div>
            ))}
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

function Cmp({ label, value, tone }: { label: string; value: string; tone?: "amber" | "primary" }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className={`text-base font-semibold ${tone === "amber" ? "text-amber-600" : tone === "primary" ? "text-primary" : ""}`}>{value}</div></div>;
}
