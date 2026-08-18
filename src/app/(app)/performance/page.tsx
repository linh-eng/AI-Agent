"use client";
// =============================================================================
// HR-PH4 — Workspace Hiệu suất (KPI). Managerial (attendance.read xem; tạo/tính/
// khóa cần attendance.write). Chọn kỳ → bảng KPI theo nhân sự + xếp hạng theo 1
// chỉ số so sánh được + drill-down bằng chứng. KPI = đo lường hiệu suất, KHÔNG
// hiển thị lương/thưởng. Chất lượng nguồn (VERIFIED/…) đánh dấu rõ.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

const QUALITY_LABEL: Record<string, string> = { VERIFIED: "Đã xác minh", PARTIAL: "Một phần", LEGACY_NAME_MATCH: "Khớp theo tên (cũ)", INSUFFICIENT: "Chưa đủ dữ liệu" };
const QUALITY_TONE: Record<string, string> = { VERIFIED: "success", PARTIAL: "warning", LEGACY_NAME_MATCH: "warning", INSUFFICIENT: "muted" };
const PERIOD_STATUS_LABEL: Record<string, string> = { DRAFT: "Bản nháp", CALCULATED: "Đã tính", REVIEWED: "Đã rà soát", LOCKED: "Đã khóa" };
// Chỉ số so sánh được (ranking) — cùng đơn vị, cùng bản chất.
const RANKABLE = ["treatment_minutes", "sessions_contributed", "services_performed", "worked_minutes", "review_count", "avg_technician_score", "avg_satisfaction"];

export default function PerformancePage() {
  const canWrite = useCan(PERMISSIONS.ATTENDANCE_WRITE);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [defs, setDefs] = useState<any[]>([]);
  const [kpiCode, setKpiCode] = useState("treatment_minutes");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  const [evid, setEvid] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  const loadPeriods = useCallback(() => apiFetch<any[]>("/api/kpi-periods").then((ps) => { setPeriods(ps); if (!periodId && ps[0]) setPeriodId(ps[0].id); }).catch(() => {}), [periodId]);
  useEffect(() => { loadPeriods(); apiFetch<any[]>("/api/kpi-definitions").then(setDefs).catch(() => {}); }, [loadPeriods]);
  const loadDetail = useCallback(() => { if (!periodId) { setDetail(null); return; } apiFetch<any>(`/api/kpi-periods/${periodId}`).then(setDetail).catch(() => setDetail(null)); }, [periodId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function doCreate() {
    setBusy(true); setMsg("");
    try {
      const p = await apiFetch<any>("/api/kpi-periods", { method: "POST", body: JSON.stringify({ name: form.name || `Kỳ ${form.startDate}`, startDate: form.startDate, endDate: form.endDate }) });
      setCreating(false); setForm({ name: "", startDate: "", endDate: "" });
      await loadPeriods(); setPeriodId(p.id); setMsg(`Đã tạo kỳ ${p.code}`);
    } catch (e: any) { setMsg(e?.message ?? "Lỗi tạo kỳ"); } finally { setBusy(false); }
  }
  async function doCalc() {
    setBusy(true); setMsg("");
    try { const r = await apiFetch<any>(`/api/kpi-periods/${periodId}/calculate`, { method: "POST" }); setMsg(`Đã tính: ${r.snapshots} snapshot / ${r.employees} nhân sự (v${r.version})`); await loadPeriods(); loadDetail(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi tính KPI"); } finally { setBusy(false); }
  }
  async function doLock() {
    if (!confirm("Khóa kỳ? Snapshot sẽ BẤT BIẾN (không thể tính lại).")) return;
    setBusy(true); setMsg("");
    try { await apiFetch(`/api/kpi-periods/${periodId}/lock`, { method: "POST" }); setMsg("Đã khóa kỳ"); await loadPeriods(); loadDetail(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi khóa"); } finally { setBusy(false); }
  }

  const period = detail?.period;
  const snapshots: any[] = detail?.snapshots ?? [];
  // Bảng xếp hạng theo kpiCode (chỉ số so sánh được).
  const ranking = snapshots
    .filter((s) => s.definition?.code === kpiCode)
    .map((s) => ({ employee: s.employee, value: Number(s.value), quality: s.sourceQuality, id: s.id }))
    .sort((a, b) => b.value - a.value);
  // Ma trận nhân sự × KPI.
  const byEmp = new Map<string, { name: string; code: string; cells: Record<string, any> }>();
  for (const s of snapshots) {
    const key = s.employeeId;
    if (!byEmp.has(key)) byEmp.set(key, { name: s.employee?.fullName ?? "—", code: s.employee?.code ?? "", cells: {} });
    byEmp.get(key)!.cells[s.definition.code] = s;
  }
  const empRows = Array.from(byEmp.values());
  const shownDefs = defs.filter((d) => d.isActive);

  return (
    <div className="space-y-4">
      <PageHeader title="Hiệu suất (KPI)" description="Đo lường hiệu suất theo kỳ (snapshot). KPI KHÔNG phải lương/thưởng; chất lượng nguồn được đánh dấu rõ." />

      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label>Kỳ KPI</Label>
          <Select className="w-72" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">— Chọn kỳ —</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} · {PERIOD_STATUS_LABEL[p.status] ?? p.status}</option>)}
          </Select>
        </div>
        {period && (
          <div className="text-sm text-muted-foreground">
            {formatDate(period.startDate)} – {formatDate(period.endDate)} · <Badge tone={period.status === "LOCKED" ? "default" : period.status === "CALCULATED" ? "success" : "muted"}>{PERIOD_STATUS_LABEL[period.status] ?? period.status}</Badge>
          </div>
        )}
        {canWrite && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>Tạo kỳ</Button>
            <Button size="sm" disabled={!periodId || busy || period?.status === "LOCKED"} onClick={doCalc}>Tính KPI</Button>
            <Button variant="outline" size="sm" disabled={!periodId || busy || period?.status === "LOCKED" || period?.status === "DRAFT"} onClick={doLock}>Khóa kỳ</Button>
          </div>
        )}
      </CardContent></Card>

      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}

      {creating && canWrite && (
        <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2"><Label>Tên kỳ</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kỳ 08/2026" /></div>
          <div className="space-y-1"><Label>Từ ngày</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Đến ngày</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          <div className="sm:col-span-4"><Button size="sm" disabled={busy || !form.startDate || !form.endDate} onClick={doCreate}>Lưu kỳ</Button></div>
        </CardContent></Card>
      )}

      {/* Xếp hạng theo 1 chỉ số so sánh được */}
      {snapshots.length > 0 && (
        <Card><CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-medium">Xếp hạng theo chỉ số</div>
            <Select className="ml-auto w-64" value={kpiCode} onChange={(e) => setKpiCode(e.target.value)}>
              {shownDefs.filter((d) => RANKABLE.includes(d.code)).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </Select>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">#</th><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2 text-right">Giá trị</th><th className="px-3 py-2">Chất lượng</th></tr></thead>
            <tbody>{ranking.map((r, i) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">{r.employee?.fullName} <span className="text-xs text-muted-foreground">({r.employee?.code})</span></td>
                <td className="px-3 py-2 text-right font-medium">{r.value}</td>
                <td className="px-3 py-2"><Badge tone={(QUALITY_TONE[r.quality] as any) ?? "muted"}>{QUALITY_LABEL[r.quality] ?? r.quality}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="mt-2 text-xs text-muted-foreground">Chỉ xếp hạng các chỉ số so sánh được (cùng đơn vị/bản chất) — KHÔNG xếp hạng chéo vai trò không tương đương.</div>
        </CardContent></Card>
      )}

      {/* Ma trận nhân sự × KPI */}
      {empRows.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="sticky left-0 bg-muted/40 px-3 py-2">Nhân sự</th>
              {shownDefs.map((d) => <th key={d.code} className="px-3 py-2 text-right">{d.name}</th>)}
            </tr></thead>
            <tbody>{empRows.map((r) => (
              <tr key={r.code} className="border-b last:border-0">
                <td className="sticky left-0 bg-background px-3 py-2 font-medium">{r.name}<div className="text-xs text-muted-foreground">{r.code}</div></td>
                {shownDefs.map((d) => {
                  const cell = r.cells[d.code];
                  return <td key={d.code} className="px-3 py-2 text-right">{cell ? (
                    <button className="underline-offset-2 hover:underline" onClick={() => apiFetch<any>(`/api/employee-kpi-snapshots/${cell.id}/evidence`).then(setEvid).catch(() => {})}>{Number(cell.value)}</button>
                  ) : <span className="text-muted-foreground">—</span>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table></div>
          <div className="px-3 py-2 text-xs text-muted-foreground">Bấm giá trị để xem bằng chứng (drill-down). Không có snapshot → chưa tính kỳ hoặc chưa có dữ liệu.</div>
        </CardContent></Card>
      )}

      {snapshots.length === 0 && period && <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">Kỳ chưa có snapshot. {canWrite ? "Bấm \"Tính KPI\" để tạo." : "Chờ quản lý tính KPI."}</div>}

      {evid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEvid(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><div className="font-medium">Bằng chứng: {evid.snapshot?.definition?.name} = {Number(evid.snapshot?.value)} · {evid.snapshot?.employee?.fullName}</div><Button variant="ghost" size="sm" onClick={() => setEvid(null)}>Đóng</Button></div>
            {evid.note && <div className="mb-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">{evid.note}</div>}
            <pre className="overflow-auto rounded bg-muted/40 p-3 text-xs">{JSON.stringify(evid.records, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
