"use client";
// =============================================================================
// PRICING / COSTING — PH1: Giá vốn dịch vụ (Service Costing). Trang nội bộ trong
// Dịch vụ (không sửa sidebar/nav). Hiển thị breakdown A–H, tạo/sửa/tính lại/
// phát hành version. Chỉ người có finance.read thấy số liệu (server đã mask).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COSTING_STATUS_LABEL, COSTING_STATUS_TONE, OVERHEAD_METHOD_LABEL } from "@/lib/clinic-labels";

const OVERHEAD_METHODS = ["MANUAL", "FIXED_PER_SERVICE", "PER_MINUTE"];
const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));

export default function ServiceCostingPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [service, setService] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ overheadMethod: "MANUAL", overheadValue: 0, equipmentCost: 0, facilityCost: 0, otherCost: 0, materialOverride: "", materialOverrideReason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svc, vs] = await Promise.all([
        apiFetch<any>(`/api/services/${id}`),
        apiFetch<any[]>(`/api/service-costings?serviceId=${id}`),
      ]);
      setService(svc);
      setVersions(vs);
      setSelId((prev) => prev ?? vs.find((v) => v.status === "PUBLISHED")?.id ?? vs[0]?.id ?? null);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const sel = versions.find((v) => v.id === selId) ?? null;

  async function createDraft() {
    setBusy(true); setError(null); setWarnings([]);
    try {
      const body: any = {
        serviceId: id,
        equipmentCost: Number(form.equipmentCost) || 0,
        facilityCost: Number(form.facilityCost) || 0,
        otherCost: Number(form.otherCost) || 0,
        overheadMethod: form.overheadMethod,
        overheadValue: Number(form.overheadValue) || 0,
      };
      if (form.materialOverride !== "" && form.materialOverride != null) {
        body.materialOverride = Number(form.materialOverride);
        body.materialOverrideReason = form.materialOverrideReason;
      }
      const res = await apiFetch<any>(`/api/service-costings`, { method: "POST", body });
      setWarnings(res.warnings ?? []);
      setShowForm(false);
      setSelId(res.id);
      await load();
    } catch (e: any) { setError(e?.message ?? "Không tạo được version"); }
    finally { setBusy(false); }
  }

  async function act(path: string) {
    if (!sel) return;
    setBusy(true); setError(null); setWarnings([]);
    try {
      const res = await apiFetch<any>(`/api/service-costings/${sel.id}${path}`, { method: "POST" });
      setWarnings(res.warnings ?? []);
      await load();
    } catch (e: any) { setError(e?.message ?? "Thao tác thất bại"); }
    finally { setBusy(false); }
  }

  if (!canFinance) {
    return (
      <div className="space-y-4">
        <PageHeader title="Giá vốn dịch vụ" description="Cần quyền xem dữ liệu tài chính (finance.read)." />
        <Card><CardContent className="py-8 text-center text-muted-foreground">Bạn không có quyền xem chi phí/giá vốn.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Giá vốn dịch vụ${service ? " · " + service.name : ""}`}
        description="Nền tảng giá vốn có version — tách khỏi Giá sàn. Vật tư từ SOP, nhân sự từ phí vai trò; thiết bị/cơ sở/overhead nhập tay."
        action={<Link href="/services" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Về Dịch vụ</Link>}
      />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <div className="font-medium">Cảnh báo dữ liệu nguồn:</div>
          <ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {loading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Đang tải…</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* Cột trái: danh sách version */}
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Phiên bản</div>
                {canWrite && <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}><Plus className="mr-1 h-3.5 w-3.5" /> Mới</Button>}
              </div>
              <div className="space-y-1">
                {versions.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Chưa có version giá vốn.</div>}
                {versions.map((v) => (
                  <button key={v.id} onClick={() => setSelId(v.id)} className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm ${selId === v.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
                    <span>v{v.version}</span>
                    <Badge tone={COSTING_STATUS_TONE[v.status] ?? "muted"}>{COSTING_STATUS_LABEL[v.status] ?? v.status}</Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cột phải: form tạo hoặc breakdown */}
          <div className="space-y-4">
            {showForm && canWrite && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold">Tạo version giá vốn (Bản nháp)</div>
                  <p className="text-xs text-muted-foreground">Vật tư &amp; nhân sự tự tính từ SOP + phí vai trò. Nhập thủ công phần còn lại.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Thiết bị (đ)</Label><Input type="number" value={form.equipmentCost} onChange={(e) => setForm({ ...form, equipmentCost: e.target.value })} /></div>
                    <div><Label>Phòng / cơ sở (đ)</Label><Input type="number" value={form.facilityCost} onChange={(e) => setForm({ ...form, facilityCost: e.target.value })} /></div>
                    <div><Label>Chi phí khác (đ)</Label><Input type="number" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} /></div>
                    <div>
                      <Label>Overhead — phương pháp</Label>
                      <Select value={form.overheadMethod} onChange={(e) => setForm({ ...form, overheadMethod: e.target.value })}>
                        {OVERHEAD_METHODS.map((m) => <option key={m} value={m}>{OVERHEAD_METHOD_LABEL[m]}</option>)}
                      </Select>
                    </div>
                    <div><Label>{form.overheadMethod === "PER_MINUTE" ? "Overhead (đ/phút)" : "Overhead (đ)"}</Label><Input type="number" value={form.overheadValue} onChange={(e) => setForm({ ...form, overheadValue: e.target.value })} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Ghi đè vật tư (đ, tùy chọn)</Label><Input type="number" placeholder="để trống = dùng số tự tính" value={form.materialOverride} onChange={(e) => setForm({ ...form, materialOverride: e.target.value })} /></div>
                    <div><Label>Lý do ghi đè {form.materialOverride !== "" && <span className="text-red-500">*</span>}</Label><Input value={form.materialOverrideReason} onChange={(e) => setForm({ ...form, materialOverrideReason: e.target.value })} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createDraft} disabled={busy}><Save className="mr-1 h-3.5 w-3.5" /> Tạo bản nháp</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {sel && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Chi phí cấu thành — v{sel.version}</div>
                    <Badge tone={COSTING_STATUS_TONE[sel.status] ?? "muted"}>{COSTING_STATUS_LABEL[sel.status] ?? sel.status}</Badge>
                  </div>

                  <table className="w-full text-sm">
                    <tbody>
                      <BR letter="A" label="Vật tư (tính từ SOP)" value={money(sel.computedMaterialCost)} />
                      {sel.materialOverride != null && <BR letter="" label="↳ Ghi đè vật tư" value={money(sel.materialOverride)} note={sel.materialOverrideReason} />}
                      <BR letter="" label="Vật tư chốt" value={money(sel.finalMaterialCost)} bold />
                      <BR letter="B" label="Nhân sự (phí vai trò × số lượng)" value={money(sel.laborCost)} />
                      <BR letter="C" label="Thiết bị (nhập tay)" value={money(sel.equipmentCost)} />
                      <BR letter="D" label="Phòng / cơ sở (nhập tay)" value={money(sel.facilityCost)} />
                      <BR letter="" label="Chi phí trực tiếp" value={money(sel.directCost)} bold />
                      <BR letter="E" label={`Overhead (${OVERHEAD_METHOD_LABEL[sel.overheadMethod] ?? sel.overheadMethod})`} value={money(sel.overheadCost)} />
                      <BR letter="F" label="Chi phí khác" value={money(sel.otherCost)} />
                      <BR letter="G" label="TỔNG GIÁ VỐN DỰ KIẾN" value={money(sel.totalEstimatedCost)} bold highlight />
                    </tbody>
                  </table>

                  {/* H: version/status/effective */}
                  <div className="grid gap-x-6 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>Phiên bản: <b>v{sel.version}</b> · {COSTING_STATUS_LABEL[sel.status]}</div>
                    <div>SOP tại thời điểm: <b>v{sel.serviceVersionSnapshot ?? "—"}</b></div>
                    <div>Tạo: {sel.createdBy ?? "—"} · {formatDateTime(sel.createdAt)}</div>
                    {sel.publishedAt && <div>Phát hành: {sel.publishedBy ?? "—"} · {formatDateTime(sel.publishedAt)}</div>}
                  </div>

                  {canWrite && sel.status === "DRAFT" && (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button size="sm" variant="outline" onClick={() => act("/recalculate")} disabled={busy}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Tính lại từ nguồn</Button>
                      <Button size="sm" onClick={() => act("/publish")} disabled={busy}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Phát hành (đông cứng)</Button>
                    </div>
                  )}
                  {sel.status !== "DRAFT" && <p className="border-t pt-2 text-xs text-muted-foreground">Version đã phát hành là bất biến (snapshot). Tạo version mới để cập nhật.</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BR({ letter, label, value, bold, highlight, note }: { letter: string; label: string; value: string; bold?: boolean; highlight?: boolean; note?: string | null }) {
  return (
    <tr className={highlight ? "bg-primary/5" : ""}>
      <td className="w-6 py-1 text-xs font-semibold text-muted-foreground">{letter}</td>
      <td className={`py-1 ${bold ? "font-semibold" : ""}`}>{label}{note ? <span className="ml-1 text-xs text-muted-foreground">({note})</span> : null}</td>
      <td className={`py-1 text-right ${bold ? "font-semibold" : ""} ${highlight ? "text-primary" : ""}`}>{value}</td>
    </tr>
  );
}
