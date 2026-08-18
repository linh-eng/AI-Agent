"use client";
// =============================================================================
// HR-PH6 — Workspace Bảng lương (payroll.read xem; tạo/tính = payroll.write;
// duyệt/chi = payroll.approve). 2 tab: Kỳ lương · Cấu hình (lương cơ bản + phụ
// cấp/khấu trừ). KHÔNG hard-code PIT/BHXH — chủ DN tự khai qua Cấu hình.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

const PSTATUS_LABEL: Record<string, string> = { DRAFT: "Bản nháp", CALCULATED: "Đã tính", APPROVED: "Đã duyệt", PAID: "Đã chi", LOCKED: "Đã khóa" };
const PSTATUS_TONE: Record<string, string> = { DRAFT: "muted", CALCULATED: "warning", APPROVED: "success", PAID: "default", LOCKED: "default" };
const TABS = [{ k: "periods", label: "Kỳ lương" }, { k: "config", label: "Cấu hình lương" }];

export default function PayrollPage() {
  const canWrite = useCan(PERMISSIONS.PAYROLL_WRITE);
  const canApprove = useCan(PERMISSIONS.PAYROLL_APPROVE);
  const [tab, setTab] = useState("periods");
  return (
    <div className="space-y-4">
      <PageHeader title="Bảng lương" description="Gộp thu nhập (lương thưởng) + lương cơ bản + phụ cấp → lương gộp → trừ khấu trừ (chủ DN tự khai) → thực nhận. Phiếu lương BẤT BIẾN khi duyệt." />
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-2 text-sm ${tab === t.k ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>{t.label}</button>)}
      </div>
      {tab === "periods" && <PeriodsTab canWrite={canWrite} canApprove={canApprove} />}
      {tab === "config" && <ConfigTab canWrite={canWrite} />}
    </div>
  );
}

function PeriodsTab({ canWrite, canApprove }: { canWrite: boolean; canApprove: boolean }) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [slip, setSlip] = useState<any | null>(null);

  const load = useCallback(() => apiFetch<any[]>("/api/payroll-periods").then((ps) => { setPeriods(ps); if (!periodId && ps[0]) setPeriodId(ps[0].id); }).catch(() => {}), [periodId]);
  useEffect(() => { load(); }, [load]);
  const loadDetail = useCallback(() => { if (!periodId) { setDetail(null); return; } apiFetch<any>(`/api/payroll-periods/${periodId}`).then(setDetail).catch(() => setDetail(null)); }, [periodId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function act(kind: string) {
    setMsg("");
    try { const r = await apiFetch<any>(`/api/payroll-periods/${periodId}/${kind}`, { method: "POST" }); setMsg(kind === "calculate" ? `Đã tính ${r.employees} nhân sự` : "Xong"); await load(); loadDetail(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  async function create() {
    setMsg("");
    try { const p = await apiFetch<any>("/api/payroll-periods", { method: "POST", body: JSON.stringify({ name: form.name || `Kỳ ${form.startDate}`, startDate: form.startDate, endDate: form.endDate }) }); setCreating(false); setForm({ name: "", startDate: "", endDate: "" }); await load(); setPeriodId(p.id); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi tạo kỳ"); }
  }

  const period = detail?.period;
  const rows: any[] = detail?.lines ?? [];
  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1"><Label>Kỳ lương</Label>
          <Select className="w-72" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">— Chọn kỳ —</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} · {PSTATUS_LABEL[p.status]}</option>)}
          </Select>
        </div>
        {period && <div className="text-sm text-muted-foreground">{formatDate(period.startDate)} – {formatDate(period.endDate)} · <Badge tone={(PSTATUS_TONE[period.status] as any)}>{PSTATUS_LABEL[period.status]}</Badge></div>}
        <div className="ml-auto flex gap-2">
          {canWrite && <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>Tạo kỳ</Button>}
          {canWrite && <Button size="sm" disabled={!periodId || ["APPROVED", "PAID", "LOCKED"].includes(period?.status)} onClick={() => act("calculate")}>Tính lương</Button>}
          {canApprove && <Button variant="outline" size="sm" disabled={period?.status !== "CALCULATED"} onClick={() => act("approve")}>Duyệt</Button>}
          {canApprove && <Button variant="outline" size="sm" disabled={period?.status !== "APPROVED"} onClick={() => act("pay")}>Đánh dấu đã chi</Button>}
        </div>
      </CardContent></Card>

      {creating && canWrite && <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-2"><Label>Tên kỳ</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lương tháng 08/2026" /></div>
        <div className="space-y-1"><Label>Từ</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div className="space-y-1"><Label>Đến</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
        <div className="sm:col-span-4"><Button size="sm" disabled={!form.startDate || !form.endDate} onClick={create}>Lưu kỳ</Button></div>
      </CardContent></Card>}
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2 text-right">Lương CB</th><th className="px-3 py-2 text-right">Thưởng/HH</th><th className="px-3 py-2 text-right">Phụ cấp</th><th className="px-3 py-2 text-right">Gộp</th><th className="px-3 py-2 text-right">Khấu trừ</th><th className="px-3 py-2 text-right">Thực nhận</th><th className="px-3 py-2"></th>
        </tr></thead>
        <tbody>{rows.map((l) => <tr key={l.id} className="border-b last:border-0">
          <td className="px-3 py-2">{l.employee?.fullName} <span className="text-xs text-muted-foreground">({l.employee?.code})</span></td>
          <td className="px-3 py-2 text-right">{formatCurrency(Number(l.baseSalary))}</td>
          <td className="px-3 py-2 text-right">{formatCurrency(Number(l.earningsCommission) + Number(l.earningsIncentive) + Number(l.earningsBonus) + Number(l.earningsAdjustment))}</td>
          <td className="px-3 py-2 text-right">{formatCurrency(Number(l.allowanceTotal))}</td>
          <td className="px-3 py-2 text-right">{formatCurrency(Number(l.grossPay))}</td>
          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(Number(l.deductionTotal))}</td>
          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(l.netPay))}</td>
          <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => setSlip(l)}>Phiếu</Button></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Kỳ chưa có phiếu lương. {canWrite ? "Bấm \"Tính lương\"." : ""}</td></tr>}</tbody>
      </table></div></CardContent></Card>

      {slip && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSlip(null)}>
        <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between"><div className="font-medium">Phiếu lương · {slip.employee?.fullName}</div><Button variant="ghost" size="sm" onClick={() => setSlip(null)}>Đóng</Button></div>
          <Row label="Lương cơ bản" v={Number(slip.baseSalary)} />
          <Row label="Hoa hồng" v={Number(slip.earningsCommission)} />
          <Row label="Thưởng dịch vụ" v={Number(slip.earningsIncentive)} />
          <Row label="Thưởng KPI" v={Number(slip.earningsBonus)} />
          {(slip.breakdown?.allowances ?? []).map((a: any, i: number) => <Row key={i} label={`Phụ cấp: ${a.name}`} v={a.amount} />)}
          <div className="my-1 border-t" />
          <Row label="LƯƠNG GỘP" v={Number(slip.grossPay)} bold />
          {(slip.breakdown?.deductions ?? []).map((d: any, i: number) => <Row key={i} label={`Khấu trừ: ${d.name}${d.calcType !== "FIXED" ? ` (${d.value}%)` : ""}`} v={-d.amount} />)}
          <div className="my-1 border-t" />
          <Row label="THỰC NHẬN" v={Number(slip.netPay)} bold />
          <div className="mt-2 text-xs text-muted-foreground">Bằng chứng: {slip.breakdown?.eventIds?.length ?? 0} sự kiện thu nhập. {slip.lockedAt ? "Đã khóa (duyệt)." : "Chưa duyệt."}</div>
        </div>
      </div>}
    </div>
  );
}

function Row({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  return <div className={`flex justify-between py-0.5 text-sm ${bold ? "font-semibold" : ""}`}><span>{label}</span><span className={v < 0 ? "text-red-600" : ""}>{formatCurrency(v)}</span></div>;
}

function ConfigTab({ canWrite }: { canWrite: boolean }) {
  const [comps, setComps] = useState<any[]>([]);
  const [baseEmp, setBaseEmp] = useState("");
  const [bases, setBases] = useState<any[]>([]);
  const [cf, setCf] = useState({ code: "", name: "", kind: "EARNING", calcType: "FIXED", value: "", scope: "COMPANY", scopeRef: "" });
  const [bf, setBf] = useState({ employeeId: "", amount: "", effectiveFrom: "" });
  const [msg, setMsg] = useState("");
  const loadComps = useCallback(() => apiFetch<any[]>("/api/payroll-component-rules").then(setComps).catch(() => {}), []);
  useEffect(() => { loadComps(); }, [loadComps]);
  useEffect(() => { if (baseEmp) apiFetch<any[]>(`/api/employee-base-salaries?employeeId=${baseEmp}`).then(setBases).catch(() => setBases([])); }, [baseEmp]);

  async function addComp() {
    setMsg("");
    try { await apiFetch("/api/payroll-component-rules", { method: "POST", body: JSON.stringify({ ...cf, value: Number(cf.value) || 0, scopeRef: cf.scopeRef || null }) }); setCf({ ...cf, code: "", name: "", value: "" }); loadComps(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  async function addBase() {
    setMsg("");
    try { await apiFetch("/api/employee-base-salaries", { method: "POST", body: JSON.stringify({ employeeId: bf.employeeId, amount: Number(bf.amount) || 0, effectiveFrom: bf.effectiveFrom }) }); setBaseEmp(bf.employeeId); setBf({ ...bf, amount: "" }); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardContent className="space-y-3 p-4">
        <div className="text-sm font-medium">Phụ cấp / Khấu trừ (chủ DN tự khai — vd BHXH, PIT, tạm ứng)</div>
        {canWrite && <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Mã" value={cf.code} onChange={(e) => setCf({ ...cf, code: e.target.value })} />
          <Input placeholder="Tên" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} />
          <Select value={cf.kind} onChange={(e) => setCf({ ...cf, kind: e.target.value })}><option value="EARNING">Phụ cấp (cộng)</option><option value="DEDUCTION">Khấu trừ (trừ)</option></Select>
          <Select value={cf.calcType} onChange={(e) => setCf({ ...cf, calcType: e.target.value })}><option value="FIXED">Số tiền cố định</option><option value="PERCENT_BASE">% lương cơ bản</option><option value="PERCENT_GROSS">% lương gộp</option></Select>
          <Input placeholder={cf.calcType === "FIXED" ? "Số tiền" : "% (vd 10.5)"} value={cf.value} onChange={(e) => setCf({ ...cf, value: e.target.value })} />
          <Select value={cf.scope} onChange={(e) => setCf({ ...cf, scope: e.target.value })}><option value="COMPANY">Toàn công ty</option><option value="ROLE">Theo vai trò</option><option value="EMPLOYEE">Theo nhân sự</option></Select>
          {cf.scope !== "COMPANY" && <Input className="col-span-2" placeholder={cf.scope === "ROLE" ? "roleCode" : "employeeId"} value={cf.scopeRef} onChange={(e) => setCf({ ...cf, scopeRef: e.target.value })} />}
          <div className="col-span-2"><Button size="sm" disabled={!cf.code || !cf.name} onClick={addComp}>+ Thêm khoản</Button></div>
        </div>}
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-2 py-1">Khoản</th><th className="px-2 py-1">Loại</th><th className="px-2 py-1 text-right">Giá trị</th><th className="px-2 py-1">Phạm vi</th></tr></thead>
          <tbody>{comps.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="px-2 py-1">{c.name}</td><td className="px-2 py-1"><Badge tone={c.kind === "EARNING" ? "success" : "danger"}>{c.kind === "EARNING" ? "Cộng" : "Trừ"}</Badge></td><td className="px-2 py-1 text-right">{c.calcType === "FIXED" ? formatCurrency(Number(c.value)) : `${Number(c.value)}%`}</td><td className="px-2 py-1 text-xs">{c.scope}{c.scopeRef ? `: ${c.scopeRef}` : ""}</td></tr>)}
          {comps.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">Chưa khai khoản nào.</td></tr>}</tbody>
        </table></div>
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <div className="text-sm font-medium">Lương cơ bản (theo nhân sự, có hiệu lực ngày)</div>
        {canWrite && <div className="grid grid-cols-2 gap-2">
          <Input placeholder="employeeId" value={bf.employeeId} onChange={(e) => setBf({ ...bf, employeeId: e.target.value })} />
          <Input placeholder="Số tiền" value={bf.amount} onChange={(e) => setBf({ ...bf, amount: e.target.value })} />
          <div><Label className="text-xs">Hiệu lực từ</Label><Input type="date" value={bf.effectiveFrom} onChange={(e) => setBf({ ...bf, effectiveFrom: e.target.value })} /></div>
          <div className="flex items-end"><Button size="sm" disabled={!bf.employeeId || !bf.amount || !bf.effectiveFrom} onClick={addBase}>+ Đặt lương</Button></div>
        </div>}
        <div><Label className="text-xs">Xem lịch sử lương của nhân sự (employeeId)</Label><Input value={baseEmp} onChange={(e) => setBaseEmp(e.target.value)} placeholder="employeeId" /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-2 py-1 text-right">Lương</th><th className="px-2 py-1">Từ</th><th className="px-2 py-1">Đến</th></tr></thead>
          <tbody>{bases.map((b) => <tr key={b.id} className="border-b last:border-0"><td className="px-2 py-1 text-right">{formatCurrency(Number(b.amount))}</td><td className="px-2 py-1">{formatDate(b.effectiveFrom)}</td><td className="px-2 py-1">{b.effectiveTo ? formatDate(b.effectiveTo) : "—"}</td></tr>)}
          {bases.length === 0 && <tr><td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">Nhập employeeId để xem.</td></tr>}</tbody>
        </table></div>
      </CardContent></Card>
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm lg:col-span-2">{msg}</div>}
      <div className="text-xs text-muted-foreground lg:col-span-2">Hệ thống KHÔNG áp tỷ lệ thuế/BHXH mặc định — chủ doanh nghiệp khai khoản khấu trừ tại đây theo quy định hiện hành.</div>
    </div>
  );
}
