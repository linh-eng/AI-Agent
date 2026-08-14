"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { EMPLOYEE_ROLE_OPTIONS, EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_TONE, LEAVE_TYPE_LABEL, COMPETENCE_KIND_LABEL, DOW_LABEL } from "@/lib/clinic-labels";

const TABS = [
  { k: "basic", label: "A. Thông tin cơ bản" }, { k: "roles", label: "B. Vai trò & Phí" },
  { k: "comp", label: "C. Năng lực" }, { k: "cert", label: "D. Chứng nhận" },
  { k: "sched", label: "E. Lịch làm việc" }, { k: "leave", label: "F. Nghỉ phép" },
  { k: "kpi", label: "G. Hoạt động & Đánh giá" },
];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.STAFF_WRITE);
  const canRole = useCan(PERMISSIONS.STAFF_ROLE_MANAGE);
  const canSched = useCan(PERMISSIONS.STAFF_SCHEDULE_MANAGE);
  const canFee = useCan(PERMISSIONS.STAFF_FEE_WRITE);
  const [e, setE] = useState<any>(null);
  const [tab, setTab] = useState("basic");
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState<{ tech: any[]; svc: any[]; proto: any[] }>({ tech: [], svc: [], proto: [] });

  const load = useCallback(async () => { setE(await apiFetch<any>(`/api/employees/${id}`)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([apiFetch<any[]>("/api/technologies").catch(() => []), apiFetch<any[]>("/api/services").catch(() => []), apiFetch<any[]>("/api/brand-protocols").catch(() => [])])
      .then(([tech, svc, proto]) => setOpts({ tech, svc, proto }));
  }, []);

  async function post(url: string, body: any, method = "POST") {
    setError(null);
    try { await apiFetch(url, { method, body: body ? JSON.stringify(body) : undefined }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  if (!e) return <p className="text-muted-foreground">Đang tải...</p>;
  const now = new Date();

  return (
    <div>
      <Link href="/employees" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Danh sách nhân sự</Link>
      <PageHeader title={e.fullName} description={`${e.code}${e.title ? " · " + e.title : ""}${e.branch ? " · " + e.branch : ""}`}
        action={<div className="flex items-center gap-2">
          <Badge tone={EMPLOYEE_STATUS_TONE[e.status] ?? "muted"}>{EMPLOYEE_STATUS_LABEL[e.status] ?? e.status}</Badge>
          {canWrite && <Select className="h-9 w-36" value={e.status} onChange={(ev) => post(`/api/employees/${id}`, { status: ev.target.value }, "PATCH")}>{Object.keys(EMPLOYEE_STATUS_LABEL).map((s) => <option key={s} value={s}>{EMPLOYEE_STATUS_LABEL[s]}</option>)}</Select>}
        </div>} />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`border-b-2 px-3 py-2 text-sm ${tab === t.k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}>{t.label}</button>)}
      </div>

      {tab === "basic" && <BasicTab e={e} canWrite={canWrite} onSave={(b: any) => post(`/api/employees/${id}`, b, "PATCH")} />}

      {tab === "roles" && (
        <div className="space-y-3">
          <Card><CardContent className="p-0">
            <div className="border-b px-4 py-2 text-sm font-medium">Vai trò &amp; Phí theo vai trò (có hiệu lực)</div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-muted-foreground"><tr className="border-b"><th className="p-2 text-left">Vai trò</th><th className="p-2 text-right">Phí/buổi</th><th className="p-2">Hiệu lực từ</th><th className="p-2">Đến</th><th className="p-2">Trạng thái</th>{canFee && <th></th>}</tr></thead>
              <tbody>
                {e.roleFees.length === 0 ? <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Chưa khai báo phí vai trò</td></tr> : e.roleFees.map((r: any) => {
                  const started = !r.effectiveFrom || new Date(r.effectiveFrom) <= now;
                  const ended = r.effectiveTo && new Date(r.effectiveTo) <= now; // effectiveTo EXCLUSIVE
                  const active = r.isActive && started && !ended;
                  const upcoming = r.isActive && !started;
                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${r.isActive ? "" : "opacity-50"}`}>
                      <td className="p-2 font-medium">{r.role}</td>
                      <td className="p-2 text-right">{r.fee != null ? formatCurrency(Number(r.fee)) : "•••"}</td>
                      <td className="p-2">{r.effectiveFrom ? formatDate(r.effectiveFrom) : "—"}</td>
                      {/* `effectiveTo` là mốc EXCLUSIVE (bản kế tiếp áp dụng từ ngày này) → hiển thị NGÀY CUỐI còn hiệu lực = effectiveTo − 1 ngày, tránh trùng ngày với "Hiệu lực từ" của bản sau. */}
                      <td className="p-2">{r.effectiveTo ? formatDate(new Date(new Date(r.effectiveTo).getTime() - 86_400_000)) : "—"}</td>
                      <td className="p-2">{active ? <Badge tone="success">Hiện hành</Badge> : upcoming ? <Badge tone="default">Sắp áp dụng</Badge> : r.isActive ? <Badge tone="muted">Lịch sử</Badge> : <Badge tone="muted">Ngừng</Badge>}</td>
                      {canFee && <td className="p-2 text-right">{r.isActive && <Button size="icon" variant="ghost" onClick={() => post(`/api/employees/${id}/role-fees?feeId=${r.id}`, null, "DELETE")}><Trash2 className="h-3.5 w-3.5" /></Button>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">Cột <b>Đến</b> = ngày CUỐI còn hiệu lực. Bản kế tiếp áp dụng từ <b>ngày hôm sau</b> → không có ngày nào áp 2 mức phí (không chồng lấn).</p>
          </CardContent></Card>
          {canFee ? <AddRoleFee onAdd={(b) => post(`/api/employees/${id}/role-fees`, b)} /> : <p className="text-xs text-muted-foreground">Bạn không có quyền xem/sửa phí nhân sự.</p>}
        </div>
      )}

      {tab === "comp" && (
        <div className="space-y-3">
          <Card><CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              {e.competences.length === 0 ? <span className="text-sm text-muted-foreground">Chưa gán năng lực</span> : e.competences.map((c: any) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                  <span className="text-xs text-muted-foreground">{COMPETENCE_KIND_LABEL[c.kind]}</span> {c.name}
                  {canRole && <button onClick={() => post(`/api/employees/${id}/competences?cid=${c.id}`, null, "DELETE")} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                </span>
              ))}
            </div>
          </CardContent></Card>
          {canRole && <AddCompetence opts={opts} onAdd={(b) => post(`/api/employees/${id}/competences`, b)} />}
        </div>
      )}

      {tab === "cert" && (
        <div className="space-y-3">
          {e.certifications.length === 0 && <p className="text-sm text-muted-foreground">Chưa có chứng nhận</p>}
          {e.certifications.map((c: any) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < now;
            return (
              <Card key={c.id}><CardContent className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{c.name} {expired && <Badge tone="danger"><AlertTriangle className="mr-1 inline h-3 w-3" />Hết hạn</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{c.issuer ?? "—"}{c.issuedAt ? ` · cấp ${formatDate(c.issuedAt)}` : ""}{c.expiresAt ? ` · hết hạn ${formatDate(c.expiresAt)}` : ""}</div>
                </div>
                {canRole && <Button size="icon" variant="ghost" onClick={() => post(`/api/employees/${id}/certifications?certId=${c.id}`, null, "DELETE")}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </CardContent></Card>
            );
          })}
          {canRole && <AddCert onAdd={(b) => post(`/api/employees/${id}/certifications`, b)} />}
        </div>
      )}

      {tab === "sched" && (
        <div className="space-y-3">
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="p-2 text-left">Thứ</th><th className="p-2">Giờ</th><th className="p-2">Ca</th><th className="p-2">Hiệu lực</th>{canSched && <th></th>}</tr></thead>
            <tbody>
              {e.schedules.length === 0 ? <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Chưa có lịch làm việc</td></tr> : e.schedules.map((s: any) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{DOW_LABEL[s.dayOfWeek]}</td>
                  <td className="p-2 text-center">{s.startTime}–{s.endTime}</td>
                  <td className="p-2 text-center text-muted-foreground">{s.shift ?? "—"}</td>
                  <td className="p-2 text-center text-muted-foreground">{s.effectiveFrom ? formatDate(s.effectiveFrom) : "—"}{s.effectiveTo ? ` → ${formatDate(s.effectiveTo)}` : ""}</td>
                  {canSched && <td className="p-2 text-right"><Button size="icon" variant="ghost" onClick={() => post(`/api/employees/${id}/schedules?sid=${s.id}`, null, "DELETE")}><Trash2 className="h-3.5 w-3.5" /></Button></td>}
                </tr>
              ))}
            </tbody>
          </table></div></CardContent></Card>
          {canSched && <AddSchedule onAdd={(b) => post(`/api/employees/${id}/schedules`, b)} />}
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-3">
          {e.leaves.length === 0 && <p className="text-sm text-muted-foreground">Chưa có đơn nghỉ</p>}
          {e.leaves.map((l: any) => (
            <Card key={l.id}><CardContent className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium"><Badge tone="warning">{LEAVE_TYPE_LABEL[l.type]}</Badge> {formatDateTime(l.fromAt)} → {formatDateTime(l.toAt)}</div>
                {l.reason && <div className="text-xs text-muted-foreground">Lý do: {l.reason}{l.createdBy ? ` · ${l.createdBy}` : ""}</div>}
              </div>
              {canSched && <Button size="icon" variant="ghost" onClick={() => post(`/api/employees/${id}/leaves?lid=${l.id}`, null, "DELETE")}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </CardContent></Card>
          ))}
          {canSched && <AddLeave onAdd={(b) => post(`/api/employees/${id}/leaves`, b)} />}
        </div>
      )}

      {tab === "kpi" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Tổng buổi đã thực hiện" value={e.kpi.totalSessions} />
          <Kpi label="Điểm KTV trung bình" value={e.kpi.avgTechScore != null ? `${e.kpi.avgTechScore}/5` : "—"} />
          <Kpi label="Số lượt đánh giá" value={e.kpi.reviewCount} />
          <Kpi label="Điểm hài lòng TB" value={e.kpi.avgSatisfaction != null ? `${e.kpi.avgSatisfaction}/5` : "—"} />
          <Kpi label="Số sự cố/bất thường" value={e.kpi.incidents} tone={e.kpi.incidents > 0 ? "amber" : undefined} />
          <div className="sm:col-span-3 text-xs text-muted-foreground">Số liệu suy từ Buổi thực hiện + Đánh giá (read-only, không nhập tay).</div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-semibold ${tone === "amber" ? "text-amber-600" : ""}`}>{value}</div></CardContent></Card>;
}

function BasicTab({ e, canWrite, onSave }: { e: any; canWrite: boolean; onSave: (b: any) => void }) {
  const [f, setF] = useState({ fullName: e.fullName, phone: e.phone ?? "", email: e.email ?? "", title: e.title ?? "", branch: e.branch ?? "", dob: e.dob ? e.dob.slice(0, 10) : "", startDate: e.startDate ? e.startDate.slice(0, 10) : "", note: e.note ?? "" });
  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Họ tên</Label><Input value={f.fullName} disabled={!canWrite} onChange={(ev) => setF({ ...f, fullName: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Chức danh chính</Label><Input value={f.title} disabled={!canWrite} onChange={(ev) => setF({ ...f, title: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Điện thoại</Label><Input value={f.phone} disabled={!canWrite} onChange={(ev) => setF({ ...f, phone: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Email</Label><Input value={f.email} disabled={!canWrite} onChange={(ev) => setF({ ...f, email: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Ngày sinh</Label><Input type="date" value={f.dob} disabled={!canWrite} onChange={(ev) => setF({ ...f, dob: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Ngày bắt đầu làm việc</Label><Input type="date" value={f.startDate} disabled={!canWrite} onChange={(ev) => setF({ ...f, startDate: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Chi nhánh</Label><Input value={f.branch} disabled={!canWrite} onChange={(ev) => setF({ ...f, branch: ev.target.value })} /></div>
        <div className="space-y-1"><Label>Ghi chú</Label><Input value={f.note} disabled={!canWrite} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></div>
      </div>
      {canWrite && <div className="flex justify-end"><Button onClick={() => onSave({ ...f, dob: f.dob || null, startDate: f.startDate || null, phone: f.phone || null, email: f.email || null, title: f.title || null, branch: f.branch || null, note: f.note || null })}>Lưu</Button></div>}
    </CardContent></Card>
  );
}

function AddRoleFee({ onAdd }: { onAdd: (b: any) => void }) {
  const [role, setRole] = useState(""); const [fee, setFee] = useState(""); const [from, setFrom] = useState(""); const [note, setNote] = useState("");
  return (
    <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <div className="space-y-1"><Label className="text-xs">Vai trò</Label><Input list="role-opts" className="h-8 w-44" value={role} onChange={(e) => setRole(e.target.value)} placeholder="VD: KTV chính" /><datalist id="role-opts">{EMPLOYEE_ROLE_OPTIONS.map((r) => <option key={r} value={r} />)}<option value="KTV chính" /><option value="Hỗ trợ" /><option value="Kiểm tra" /></datalist></div>
      <div className="space-y-1"><Label className="text-xs">Phí/buổi</Label><Input className="h-8 w-32" type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Hiệu lực từ</Label><Input className="h-8" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="flex-1 space-y-1"><Label className="text-xs">Ghi chú</Label><Input className="h-8" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button size="sm" disabled={!role || !fee} onClick={() => { onAdd({ role, fee: Number(fee), effectiveFrom: from || undefined, note: note || undefined }); setRole(""); setFee(""); setFrom(""); setNote(""); }}><Plus className="h-3.5 w-3.5" /> Thêm/đổi phí</Button>
    </CardContent></Card>
  );
}

function AddCompetence({ opts, onAdd }: { opts: any; onAdd: (b: any) => void }) {
  const [kind, setKind] = useState("TECHNOLOGY"); const [refId, setRefId] = useState(""); const [name, setName] = useState("");
  const list = kind === "TECHNOLOGY" ? opts.tech : kind === "SERVICE" ? opts.svc : kind === "PROTOCOL" ? opts.proto : [];
  return (
    <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <div className="space-y-1"><Label className="text-xs">Loại</Label><Select className="h-8 w-32" value={kind} onChange={(e) => { setKind(e.target.value); setRefId(""); setName(""); }}>{Object.keys(COMPETENCE_KIND_LABEL).map((k) => <option key={k} value={k}>{COMPETENCE_KIND_LABEL[k]}</option>)}</Select></div>
      {kind !== "ROLE" ? (
        <div className="flex-1 space-y-1"><Label className="text-xs">Chọn {COMPETENCE_KIND_LABEL[kind]}</Label><Select className="h-8" value={refId} onChange={(e) => { setRefId(e.target.value); const it = list.find((x: any) => x.id === e.target.value); setName(it?.name ?? ""); }}><option value="">— chọn —</option>{list.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}</Select></div>
      ) : (
        <div className="flex-1 space-y-1"><Label className="text-xs">Vai trò</Label><Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} /></div>
      )}
      <Button size="sm" disabled={!name} onClick={() => { onAdd({ kind, refId: refId || undefined, name }); setRefId(""); setName(""); }}><Plus className="h-3.5 w-3.5" /> Thêm năng lực</Button>
    </CardContent></Card>
  );
}

function AddCert({ onAdd }: { onAdd: (b: any) => void }) {
  const [f, setF] = useState({ name: "", issuer: "", issuedAt: "", expiresAt: "" });
  return (
    <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <div className="flex-1 space-y-1"><Label className="text-xs">Tên chứng nhận</Label><Input className="h-8" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Đơn vị cấp</Label><Input className="h-8" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Ngày cấp</Label><Input className="h-8" type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Hết hạn</Label><Input className="h-8" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></div>
      <Button size="sm" disabled={!f.name} onClick={() => { onAdd({ name: f.name, issuer: f.issuer || undefined, issuedAt: f.issuedAt || undefined, expiresAt: f.expiresAt || undefined }); setF({ name: "", issuer: "", issuedAt: "", expiresAt: "" }); }}><Plus className="h-3.5 w-3.5" /> Thêm</Button>
    </CardContent></Card>
  );
}

function AddSchedule({ onAdd }: { onAdd: (b: any) => void }) {
  const [dow, setDow] = useState("1"); const [start, setStart] = useState("08:00"); const [end, setEnd] = useState("17:00"); const [shift, setShift] = useState("");
  return (
    <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <div className="space-y-1"><Label className="text-xs">Thứ</Label><Select className="h-8 w-28" value={dow} onChange={(e) => setDow(e.target.value)}>{DOW_LABEL.map((d, i) => <option key={i} value={i}>{d}</option>)}</Select></div>
      <div className="space-y-1"><Label className="text-xs">Từ</Label><Input className="h-8 w-24" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Đến</Label><Input className="h-8 w-24" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Ca</Label><Input className="h-8 w-24" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Sáng/Chiều" /></div>
      <Button size="sm" onClick={() => onAdd({ dayOfWeek: Number(dow), startTime: start, endTime: end, shift: shift || undefined })}><Plus className="h-3.5 w-3.5" /> Thêm ca</Button>
    </CardContent></Card>
  );
}

function AddLeave({ onAdd }: { onAdd: (b: any) => void }) {
  const [type, setType] = useState("ANNUAL"); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [reason, setReason] = useState("");
  return (
    <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <div className="space-y-1"><Label className="text-xs">Loại</Label><Select className="h-8 w-32" value={type} onChange={(e) => setType(e.target.value)}>{Object.keys(LEAVE_TYPE_LABEL).map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>)}</Select></div>
      <div className="space-y-1"><Label className="text-xs">Từ</Label><Input className="h-8" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Đến</Label><Input className="h-8" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="flex-1 space-y-1"><Label className="text-xs">Lý do</Label><Input className="h-8" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button size="sm" disabled={!from || !to} onClick={() => { onAdd({ type, fromAt: from, toAt: to, reason: reason || undefined }); setFrom(""); setTo(""); setReason(""); }}><Plus className="h-3.5 w-3.5" /> Thêm nghỉ</Button>
    </CardContent></Card>
  );
}
