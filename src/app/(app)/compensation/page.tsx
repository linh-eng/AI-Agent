"use client";
// =============================================================================
// HR-PH5 — Workspace Lương thưởng (managerial: compensationPolicy.read xem; tạo/
// publish/sinh event cần compensationPolicy.write). 3 tab: Chính sách · Attribution
// · Sự kiện thu nhập. KHÔNG tính lương/payslip (HR-PH6). Chỉ PUBLISHED sinh tiền.
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

const SCOPE_LABEL: Record<string, string> = { COMPANY: "Toàn công ty", BRANCH: "Chi nhánh", ROLE: "Vai trò", EMPLOYEE: "Nhân sự (override)" };
const VSTATUS_LABEL: Record<string, string> = { DRAFT: "Bản nháp", PUBLISHED: "Đã phát hành", SUPERSEDED: "Đã thay thế" };
const EVTYPE_LABEL: Record<string, string> = { SALES_COMMISSION: "Hoa hồng bán", TREATMENT_INCENTIVE: "Thưởng dịch vụ", KPI_BONUS: "Thưởng KPI", REVERSAL: "Hoàn tác", ADJUSTMENT: "Điều chỉnh" };
const EVSTATUS_LABEL: Record<string, string> = { PENDING: "Chờ", ELIGIBLE: "Đủ điều kiện", REVERSED: "Đã hoàn tác", EXCLUDED: "Loại trừ" };
const TABS = [{ k: "policies", label: "Chính sách" }, { k: "attribution", label: "Attribution bán hàng" }, { k: "events", label: "Sự kiện thu nhập" }];

export default function CompensationPage() {
  const canWrite = useCan(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const [tab, setTab] = useState("policies");
  return (
    <div className="space-y-4">
      <PageHeader title="Lương thưởng" description="Chính sách (có version) → Attribution FK → Sự kiện thu nhập (append-only). Chỉ bản PHÁT HÀNH mới sinh tiền. KHÔNG hiển thị bảng lương/payslip (HR-PH6)." />
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-2 text-sm ${tab === t.k ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>{t.label}</button>)}
      </div>
      {tab === "policies" && <PoliciesTab canWrite={canWrite} />}
      {tab === "attribution" && <AttributionTab canWrite={canWrite} />}
      {tab === "events" && <EventsTab canWrite={canWrite} />}
    </div>
  );
}

function PoliciesTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", scopeType: "COMPANY", branchId: "", roleCode: "", employeeId: "" });
  const load = useCallback(() => apiFetch<any[]>("/api/compensation-policies").then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const openDetail = (id: string) => apiFetch<any>(`/api/compensation-policies/${id}`).then(setSel).catch(() => {});

  async function create() {
    setMsg("");
    try { const p = await apiFetch<any>("/api/compensation-policies", { method: "POST", body: JSON.stringify({ name: form.name, scopeType: form.scopeType, branchId: form.branchId || null, roleCode: form.roleCode || null, employeeId: form.employeeId || null }) }); setForm({ name: "", scopeType: "COMPANY", branchId: "", roleCode: "", employeeId: "" }); await load(); openDetail(p.id); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  async function publish(vId: string) {
    setMsg("");
    try { await apiFetch(`/api/compensation-policy-versions/${vId}/publish`, { method: "POST" }); setMsg("Đã phát hành"); await load(); if (sel) openDetail(sel.id); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi phát hành"); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {canWrite && (
          <Card><CardContent className="space-y-2 p-4">
            <div className="text-sm font-medium">Tạo chính sách</div>
            <Input placeholder="Tên chính sách" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })}>
              {Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            {form.scopeType === "BRANCH" && <Input placeholder="branchId" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} />}
            {form.scopeType === "ROLE" && <Input placeholder="roleCode (vd KTV)" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} />}
            {form.scopeType === "EMPLOYEE" && <Input placeholder="employeeId" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />}
            <Button size="sm" disabled={!form.name} onClick={create}>Tạo (DRAFT)</Button>
          </CardContent></Card>
        )}
        {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th><th className="px-3 py-2">Phạm vi</th><th className="px-3 py-2">Version</th></tr></thead>
            <tbody>{rows.map((p) => {
              const cur = p.versions?.find((v: any) => v.status === "PUBLISHED");
              return <tr key={p.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => openDetail(p.id)}>
                <td className="px-3 py-2">{p.code}</td><td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{SCOPE_LABEL[p.scopeType]}</td>
                <td className="px-3 py-2">{cur ? <Badge tone="success">v{cur.version} · phát hành</Badge> : <Badge tone="muted">nháp</Badge>}</td>
              </tr>;
            })}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Chưa có chính sách.</td></tr>}
            </tbody>
          </table></div>
        </CardContent></Card>
      </div>
      <div>{sel && <PolicyDetail policy={sel} canWrite={canWrite} onPublish={publish} onReload={() => openDetail(sel.id)} />}</div>
    </div>
  );
}

function PolicyDetail({ policy, canWrite, onPublish, onReload }: { policy: any; canWrite: boolean; onPublish: (v: string) => void; onReload: () => void }) {
  const draft = policy.versions?.find((v: any) => v.status === "DRAFT");
  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between"><div className="font-medium">{policy.code} · {policy.name}</div><Badge tone="muted">{SCOPE_LABEL[policy.scopeType]}</Badge></div>
      {policy.versions?.map((v: any) => (
        <div key={v.id} className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Phiên bản v{v.version} · <Badge tone={v.status === "PUBLISHED" ? "success" : v.status === "DRAFT" ? "warning" : "muted"}>{VSTATUS_LABEL[v.status]}</Badge></div>
            {canWrite && v.status === "DRAFT" && <Button size="sm" onClick={() => onPublish(v.id)}>Phát hành</Button>}
          </div>
          <div className="text-xs text-muted-foreground">Hiệu lực từ {formatDate(v.effectiveFrom)}{v.effectiveTo ? ` đến ${formatDate(v.effectiveTo)}` : ""}</div>
          <RuleList title="Hoa hồng bán" items={v.commissionRules} render={(r: any) => `${r.code} · ${r.basisType} · ${r.ratePercent ?? 0}%${r.attributionRole ? ` · ${r.attributionRole}` : ""}`} />
          <RuleList title="Thưởng dịch vụ" items={v.incentiveRules} render={(r: any) => `${r.code} · ${r.basisType} · ${r.fixedAmount ? formatCurrency(Number(r.fixedAmount)) : ""}${r.perMinuteAmount ? `${Number(r.perMinuteAmount)}/phút` : ""} · ${r.weightMode}`} />
          <RuleList title="Thưởng KPI" items={v.kpiBonusRules} render={(r: any) => `${r.code} · ${r.comparator} ${Number(r.threshold)} → ${r.fixedAmount ? formatCurrency(Number(r.fixedAmount)) : `${Number(r.rate)}×`}`} />
          {canWrite && v.status === "DRAFT" && <DraftRuleForms versionId={v.id} onDone={onReload} />}
        </div>
      ))}
    </CardContent></Card>
  );
}

function RuleList({ title, items, render }: { title: string; items: any[]; render: (r: any) => string }) {
  if (!items?.length) return null;
  return <div className="mt-2"><div className="text-xs font-medium text-muted-foreground">{title}</div><ul className="ml-4 list-disc text-xs">{items.map((r) => <li key={r.id}>{render(r)}</li>)}</ul></div>;
}

function DraftRuleForms({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const [kind, setKind] = useState("incentive");
  const [f, setF] = useState<any>({ code: "", ratePercent: "", fixedAmount: "", perMinuteAmount: "", contributionTypeCode: "", threshold: "", kpiDefinitionId: "", basisType: "FIXED_PER_CONTRIBUTION", weightMode: "IGNORE_WEIGHT", attributionRole: "" });
  const [defs, setDefs] = useState<any[]>([]);
  useEffect(() => { apiFetch<any[]>("/api/kpi-definitions").then(setDefs).catch(() => {}); }, []);
  async function add() {
    try {
      if (kind === "commission") await apiFetch("/api/commission-rules", { method: "POST", body: JSON.stringify({ policyVersionId: versionId, code: f.code, basisType: "COLLECTED_CASH", targetType: "ALL", ratePercent: Number(f.ratePercent) || 0, attributionRole: f.attributionRole || null }) });
      else if (kind === "incentive") await apiFetch("/api/treatment-incentive-rules", { method: "POST", body: JSON.stringify({ policyVersionId: versionId, code: f.code, basisType: f.basisType, contributionTypeCode: f.contributionTypeCode || null, fixedAmount: Number(f.fixedAmount) || null, perMinuteAmount: Number(f.perMinuteAmount) || null, weightMode: f.weightMode }) });
      else await apiFetch("/api/kpi-bonus-rules", { method: "POST", body: JSON.stringify({ policyVersionId: versionId, code: f.code, kpiDefinitionId: f.kpiDefinitionId, comparator: "GTE", threshold: Number(f.threshold) || 0, bonusType: "FIXED", fixedAmount: Number(f.fixedAmount) || 0 }) });
      setF({ ...f, code: "" }); onDone();
    } catch { /* noop */ }
  }
  return (
    <div className="mt-2 space-y-2 rounded bg-muted/30 p-2">
      <div className="flex gap-2">
        <Select className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}><option value="incentive">Thưởng dịch vụ</option><option value="commission">Hoa hồng bán</option><option value="kpi">Thưởng KPI</option></Select>
        <Input className="w-28" placeholder="Mã rule" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
      </div>
      {kind === "commission" && <div className="flex gap-2"><Input className="w-24" placeholder="% " value={f.ratePercent} onChange={(e) => setF({ ...f, ratePercent: e.target.value })} /><Input className="w-40" placeholder="Vai trò (CLOSER…)" value={f.attributionRole} onChange={(e) => setF({ ...f, attributionRole: e.target.value })} /></div>}
      {kind === "incentive" && <div className="flex flex-wrap gap-2">
        <Select className="w-52" value={f.basisType} onChange={(e) => setF({ ...f, basisType: e.target.value })}><option value="FIXED_PER_CONTRIBUTION">Cố định/đóng góp</option><option value="FIXED_PER_SERVICE">Cố định/dịch vụ</option><option value="PER_MINUTE">Theo phút</option></Select>
        <Input className="w-40" placeholder="Loại đóng góp" value={f.contributionTypeCode} onChange={(e) => setF({ ...f, contributionTypeCode: e.target.value })} />
        <Input className="w-28" placeholder="Số tiền" value={f.fixedAmount} onChange={(e) => setF({ ...f, fixedAmount: e.target.value })} />
        <Input className="w-28" placeholder="/phút" value={f.perMinuteAmount} onChange={(e) => setF({ ...f, perMinuteAmount: e.target.value })} />
        <Select className="w-48" value={f.weightMode} onChange={(e) => setF({ ...f, weightMode: e.target.value })}><option value="IGNORE_WEIGHT">Bỏ qua weight</option><option value="APPLY_CONTRIBUTION_WEIGHT">Áp dụng weight</option></Select>
      </div>}
      {kind === "kpi" && <div className="flex flex-wrap gap-2">
        <Select className="w-52" value={f.kpiDefinitionId} onChange={(e) => setF({ ...f, kpiDefinitionId: e.target.value })}><option value="">— KPI —</option>{defs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Input className="w-24" placeholder="Ngưỡng ≥" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} />
        <Input className="w-28" placeholder="Thưởng" value={f.fixedAmount} onChange={(e) => setF({ ...f, fixedAmount: e.target.value })} />
      </div>}
      <Button size="sm" variant="outline" disabled={!f.code} onClick={add}>+ Thêm rule</Button>
    </div>
  );
}

function AttributionTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ employeeId: "", sourceType: "CUSTOMER", sourceId: "", attributionRole: "CLOSER", weight: "1" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { if (!f.sourceId) { setRows([]); return; } apiFetch<any[]>(`/api/sales-attributions?sourceType=${f.sourceType}&sourceId=${f.sourceId}`).then(setRows).catch(() => {}); }, [f.sourceType, f.sourceId]);
  useEffect(() => { load(); }, [load]);
  async function add() {
    setMsg("");
    try { await apiFetch("/api/sales-attributions", { method: "POST", body: JSON.stringify({ employeeId: f.employeeId, sourceType: f.sourceType, sourceId: f.sourceId, attributionRole: f.attributionRole, weight: Number(f.weight) || 1 }) }); load(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  return (
    <div className="space-y-3">
      {canWrite && <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
        <div><Label>employeeId</Label><Input className="w-56" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} /></div>
        <div><Label>Nguồn</Label><Select value={f.sourceType} onChange={(e) => setF({ ...f, sourceType: e.target.value })}>{["CUSTOMER", "INVOICE", "BOOKING", "PROPOSAL", "PAYMENT"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div><Label>sourceId</Label><Input className="w-56" value={f.sourceId} onChange={(e) => setF({ ...f, sourceId: e.target.value })} /></div>
        <div><Label>Vai trò</Label><Select value={f.attributionRole} onChange={(e) => setF({ ...f, attributionRole: e.target.value })}>{["ORIGINATOR", "BOOKER", "CONSULTANT", "CLOSER", "ACCOUNT_OWNER", "COLLECTOR"].map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
        <div><Label>Weight</Label><Input className="w-20" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></div>
        <Button size="sm" disabled={!f.employeeId || !f.sourceId} onClick={add}>Gán</Button>
      </CardContent></Card>}
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Vai trò</th><th className="px-3 py-2 text-right">Weight</th><th className="px-3 py-2">Trạng thái</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="px-3 py-2">{r.employee?.fullName} <span className="text-xs text-muted-foreground">({r.employee?.code})</span></td><td className="px-3 py-2">{r.attributionRole}</td><td className="px-3 py-2 text-right">{Number(r.weight)}</td><td className="px-3 py-2"><Badge tone={r.status === "ACTIVE" ? "success" : "muted"}>{r.status}</Badge></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nhập sourceId để xem/gán attribution.</td></tr>}</tbody>
      </table></div></CardContent></Card>
    </div>
  );
}

function EventsTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [gen, setGen] = useState({ type: "incentive", sessionId: "", paymentId: "", periodId: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => apiFetch<any[]>(`/api/compensation-events${filter ? `?eventType=${filter}` : ""}`).then(setRows).catch(() => {}), [filter]);
  useEffect(() => { load(); }, [load]);
  async function doGen() {
    setMsg("");
    try {
      const body: any = { type: gen.type };
      if (gen.type === "incentive") body.sessionId = gen.sessionId;
      else if (gen.type === "commission") body.paymentId = gen.paymentId;
      else body.periodId = gen.periodId;
      const r = await apiFetch<any>("/api/compensation/generate", { method: "POST", body: JSON.stringify(body) });
      setMsg(`Đã sinh: ${JSON.stringify(r)}`); load();
    } catch (e: any) { setMsg(e?.message ?? "Lỗi sinh event"); }
  }
  async function reverse(id: string) {
    const reason = prompt("Lý do hoàn tác?"); if (!reason) return;
    try { await apiFetch(`/api/compensation-events/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }); load(); } catch { /* noop */ }
  }
  return (
    <div className="space-y-3">
      {canWrite && <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
        <div><Label>Sinh event</Label><Select value={gen.type} onChange={(e) => setGen({ ...gen, type: e.target.value })}><option value="incentive">Thưởng dịch vụ (buổi)</option><option value="commission">Hoa hồng (phiếu thu)</option><option value="kpi">Thưởng KPI (kỳ đã khóa)</option></Select></div>
        {gen.type === "incentive" && <Input className="w-56" placeholder="sessionId" value={gen.sessionId} onChange={(e) => setGen({ ...gen, sessionId: e.target.value })} />}
        {gen.type === "commission" && <Input className="w-56" placeholder="paymentId" value={gen.paymentId} onChange={(e) => setGen({ ...gen, paymentId: e.target.value })} />}
        {gen.type === "kpi" && <Input className="w-56" placeholder="periodId (KPI đã khóa)" value={gen.periodId} onChange={(e) => setGen({ ...gen, periodId: e.target.value })} />}
        <Button size="sm" onClick={doGen}>Sinh</Button>
      </CardContent></Card>}
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-xs">{msg}</div>}
      <div className="flex items-center gap-2">
        <Select className="w-56" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">— Tất cả loại —</option>{Object.entries(EVTYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Loại</th><th className="px-3 py-2 text-right">Số tiền</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Vì sao</th><th className="px-3 py-2"></th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className={`border-b last:border-0 ${r.status === "REVERSED" || r.eventType === "REVERSAL" ? "text-muted-foreground" : ""}`}>
          <td className="px-3 py-2">{formatDate(r.eventDate)}</td>
          <td className="px-3 py-2">{r.employee?.fullName}</td>
          <td className="px-3 py-2">{EVTYPE_LABEL[r.eventType]}</td>
          <td className={`px-3 py-2 text-right font-medium ${Number(r.amount) < 0 ? "text-red-600" : ""}`}>{formatCurrency(Number(r.amount))}</td>
          <td className="px-3 py-2"><Badge tone={r.status === "ELIGIBLE" ? "success" : r.status === "REVERSED" ? "muted" : "warning"}>{EVSTATUS_LABEL[r.status]}</Badge></td>
          <td className="px-3 py-2 text-xs text-muted-foreground">{r.calculationSnapshot?.why ?? ""}</td>
          <td className="px-3 py-2 text-right">{canWrite && r.status === "ELIGIBLE" && r.eventType !== "REVERSAL" && <Button variant="ghost" size="sm" onClick={() => reverse(r.id)}>Hoàn tác</Button>}</td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Chưa có sự kiện thu nhập.</td></tr>}</tbody>
      </table></div></CardContent></Card>
      <div className="text-xs text-muted-foreground">Sự kiện là bằng chứng thu nhập (append-only). Sửa = hoàn tác + tạo mới. Chưa gộp vào kỳ lương (HR-PH6).</div>
    </div>
  );
}
