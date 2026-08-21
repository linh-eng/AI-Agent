"use client";
// =============================================================================
// HR-PH2 — Workspace Chấm công (quản lý, attendance.read). 4 tab:
//   Hôm nay (self check-in/out nếu tài khoản liên kết nhân sự) · Ca làm việc ·
//   Chấm công · Nghỉ phép. Sửa/duyệt cần attendance.write (nút ẩn nếu thiếu quyền).
// Self-service check-in cho nhân viên KHÔNG có attendance.read: DEFER (xem báo cáo).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatVnTime } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  WORK_SHIFT_STATUS_LABEL, WORK_SHIFT_STATUS_TONE, ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_TONE,
  LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE, ATTENDANCE_FLAG_LABEL, LEAVE_TYPE_LABEL,
} from "@/lib/clinic-labels";

const TABS = [["today", "Hôm nay"], ["shifts", "Ca làm việc"], ["attendance", "Chấm công"], ["leave", "Nghỉ phép"]] as const;
const mins = (m: number | null | undefined) => (m == null ? "—" : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);

export default function AttendancePage() {
  const canWrite = useCan(PERMISSIONS.ATTENDANCE_WRITE);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("today");
  const [employees, setEmployees] = useState<any[]>([]);
  const [empId, setEmpId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { apiFetch<any[]>("/api/employees?active=1").then(setEmployees).catch(() => setEmployees([])); }, []);
  const qs = () => `${empId ? `&employeeId=${empId}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  const wrap = async (p: Promise<any>) => { try { setErr(null); return await p; } catch (e: any) { setErr(e?.message ?? "Lỗi"); throw e; } };

  return (
    <div>
      <PageHeader title="Chấm công" description="Ca làm việc · Chấm công thực tế · Nghỉ phép. Sửa/duyệt cần quyền chấm công." />
      {err && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}>{l}</button>
        ))}
      </div>

      {tab === "today" && <TodayTab canWrite={canWrite} wrap={wrap} />}
      {tab !== "today" && (
        <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1"><Label>Nhân sự</Label>
            <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">— Tất cả —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.code})</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label>Từ ngày</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>Đến ngày</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent></Card>
      )}

      {tab === "shifts" && <ShiftsTab canWrite={canWrite} employees={employees} qs={qs} empId={empId} from={from} to={to} wrap={wrap} />}
      {tab === "attendance" && <AttendanceTab canWrite={canWrite} employees={employees} qs={qs} wrap={wrap} setFilterEmp={setEmpId} />}
      {tab === "leave" && <LeaveTab canWrite={canWrite} employees={employees} empId={empId} wrap={wrap} />}
    </div>
  );
}

function TodayTab({ canWrite, wrap }: { canWrite: boolean; wrap: (p: Promise<any>) => Promise<any> }) {
  const [me, setMe] = useState<any>(null);
  const load = useCallback(() => { apiFetch<any>("/api/attendance/me").then(setMe).catch(() => setMe({ linked: false })); }, []);
  useEffect(() => { load(); }, [load]);
  if (!me) return <div className="text-sm text-muted-foreground">Đang tải…</div>;
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="mb-2 text-sm font-semibold">Chấm công của tôi</div>
        {!me.linked ? (
          <p className="text-sm text-muted-foreground">Tài khoản của bạn chưa liên kết hồ sơ nhân sự — không có chấm công cá nhân. (Quản lý có thể liên kết ở hồ sơ nhân sự.)</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Nhân sự: <b>{me.employee.fullName}</b> ({me.employee.code})</span>
            {me.openAttendance ? (
              <>
                <Badge tone="warning">Đang mở từ {formatVnTime(me.openAttendance.checkInAt)}</Badge>
                <Button size="sm" onClick={async () => { await wrap(apiFetch("/api/attendance/check-out", { method: "POST", body: JSON.stringify({}) })); load(); }}>Check-out</Button>
              </>
            ) : (
              <Button size="sm" onClick={async () => { await wrap(apiFetch("/api/attendance/check-in", { method: "POST", body: JSON.stringify({}) })); load(); }}>Check-in</Button>
            )}
          </div>
        )}
      </CardContent></Card>
      {me.linked && (
        <Card><CardContent className="p-0">
          <div className="border-b px-4 py-2 text-sm font-semibold">Lịch sử chấm công của tôi</div>
          <RecTable rows={me.history} canWrite={false} />
        </CardContent></Card>
      )}
    </div>
  );
}

function RecTable({ rows, canWrite, onVoid }: { rows: any[]; canWrite: boolean; onVoid?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Vào</th><th className="px-3 py-2">Ra</th>
          <th className="px-3 py-2 text-right">Công</th><th className="px-3 py-2 text-right">Trễ</th><th className="px-3 py-2 text-right">OT*</th>
          <th className="px-3 py-2">Cờ</th><th className="px-3 py-2">Trạng thái</th>{canWrite && <th />}
        </tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={canWrite ? 10 : 9} className="px-3 py-6 text-center text-muted-foreground">Chưa có dữ liệu.</td></tr> :
            rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">{formatDate(r.workDate)}</td>
                <td className="px-3 py-2">{r.employee?.fullName ?? "—"}</td>
                <td className="px-3 py-2">{r.checkInAt ? formatVnTime(r.checkInAt) : "—"}</td>
                <td className="px-3 py-2">{r.checkOutAt ? formatVnTime(r.checkOutAt) : "—"}</td>
                <td className="px-3 py-2 text-right">{mins(r.workedMinutes)}</td>
                <td className="px-3 py-2 text-right">{r.lateMinutes ? `${r.lateMinutes}'` : "—"}</td>
                <td className="px-3 py-2 text-right">{r.overtimeMinutes ? `${r.overtimeMinutes}'` : "—"}</td>
                <td className="px-3 py-2">{(r.flags ?? []).map((f: string) => ATTENDANCE_FLAG_LABEL[f] ?? f).join(", ") || "—"}</td>
                <td className="px-3 py-2"><Badge tone={ATTENDANCE_STATUS_TONE[r.status] as any}>{ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                {canWrite && <td className="px-3 py-2 text-right">{r.status !== "VOIDED" && onVoid && <Button size="sm" variant="ghost" onClick={() => onVoid(r.id)}>Hủy</Button>}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function ShiftsTab({ canWrite, employees, qs, empId, from, to, wrap }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [genEmp, setGenEmp] = useState("");
  const [genFrom, setGenFrom] = useState("");
  const [genTo, setGenTo] = useState("");
  const load = useCallback(() => { apiFetch<any[]>(`/api/work-shifts?x=1${qs()}`).then(setRows).catch(() => setRows([])); }, [qs]);
  useEffect(() => { load(); }, [empId, from, to]); // eslint-disable-line
  return (
    <div className="space-y-4">
      {canWrite && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="text-sm font-semibold">Sinh ca từ mẫu tuần</div>
          <Select value={genEmp} onChange={(e) => setGenEmp(e.target.value)}><option value="">— Nhân sự —</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</Select>
          <Input type="date" value={genFrom} onChange={(e) => setGenFrom(e.target.value)} />
          <Input type="date" value={genTo} onChange={(e) => setGenTo(e.target.value)} />
          <Button size="sm" disabled={!genEmp || !genFrom || !genTo} onClick={async () => { const r = await wrap(apiFetch<any>("/api/work-shifts/generate", { method: "POST", body: JSON.stringify({ employeeId: genEmp, from: genFrom, to: genTo }) })); alert(`Đã sinh ${r.created} ca (bỏ qua ${r.skipped} trùng).`); load(); }}>Sinh ca</Button>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Bắt đầu</th><th className="px-3 py-2">Kết thúc</th><th className="px-3 py-2">Ca</th><th className="px-3 py-2">Trạng thái</th>{canWrite && <th />}
          </tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Chưa có ca.</td></tr> :
            rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-3 py-2">{formatDate(s.workDate)}</td>
                <td className="px-3 py-2">{s.employee?.fullName ?? "—"}</td>
                <td className="px-3 py-2">{formatVnTime(s.scheduledStartAt)}</td>
                <td className="px-3 py-2">{formatVnTime(s.scheduledEndAt)}</td>
                <td className="px-3 py-2">{s.shiftLabel ?? "—"}</td>
                <td className="px-3 py-2"><Badge tone={WORK_SHIFT_STATUS_TONE[s.status] as any}>{WORK_SHIFT_STATUS_LABEL[s.status] ?? s.status}</Badge></td>
                {canWrite && <td className="px-3 py-2 text-right">{s.status !== "CANCELLED" && <Button size="sm" variant="ghost" onClick={async () => { await wrap(apiFetch(`/api/work-shifts/${s.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) })); load(); }}>Hủy ca</Button>}</td>}
              </tr>
            ))}</tbody>
        </table></div>
      </CardContent></Card>
    </div>
  );
}

function AttendanceTab({ canWrite, employees, qs, wrap, setFilterEmp }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [mEmp, setMEmp] = useState(""); const [mIn, setMIn] = useState(""); const [mOut, setMOut] = useState("");
  const load = useCallback(() => { apiFetch<any[]>(`/api/attendance?x=1${qs()}`).then(setRows).catch(() => setRows([])); }, [qs]);
  useEffect(() => { load(); }, [qs]); // eslint-disable-line
  const onVoid = async (id: string) => { const reason = prompt("Lý do hủy bản chấm công?"); if (!reason) return; await wrap(apiFetch(`/api/attendance/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) })); load(); };
  // FLOW-002 — nút Tạo mờ khi thiếu Nhân sự/Giờ vào (ô "Nhân sự" của form KHÁC ô lọc phía trên).
  const canCreate = !!mEmp && !!mIn;
  return (
    <div className="space-y-4">
      {canWrite && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="text-sm font-semibold">Chấm công thủ công</div>
          <div className="space-y-1"><Label>Nhân sự *</Label>
            <Select value={mEmp} onChange={(e) => setMEmp(e.target.value)}><option value="">— Chọn nhân sự —</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</Select>
          </div>
          <div className="space-y-1"><Label>Giờ vào *</Label><Input type="datetime-local" value={mIn} onChange={(e) => setMIn(e.target.value)} /></div>
          <div className="space-y-1"><Label>Giờ ra</Label><Input type="datetime-local" value={mOut} onChange={(e) => setMOut(e.target.value)} /></div>
          <Button size="sm" disabled={!canCreate} onClick={async () => {
            await wrap(apiFetch("/api/attendance/manual", { method: "POST", body: JSON.stringify({ employeeId: mEmp, checkInAt: mIn, checkOutAt: mOut || null }) }));
            setMIn(""); setMOut("");
            // Tự lọc danh sách theo nhân sự vừa chấm để record chắc chắn hiển thị (tránh "tạo xong không thấy").
            if (setFilterEmp) setFilterEmp(mEmp); else load();
          }}>Tạo</Button>
          {!canCreate && <span className="text-xs text-muted-foreground">Chọn <b>Nhân sự</b> và nhập <b>Giờ vào</b> để tạo.</span>}
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0"><RecTable rows={rows} canWrite={canWrite} onVoid={onVoid} /></CardContent></Card>
      <p className="text-xs text-muted-foreground">* OT = ứng viên giờ làm thêm (tính toán) — chưa phải OT được duyệt/trả lương (thuộc HR-PH6).</p>
    </div>
  );
}

function LeaveTab({ canWrite, employees, empId, wrap }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [lEmp, setLEmp] = useState(""); const [lType, setLType] = useState("ANNUAL"); const [lFrom, setLFrom] = useState(""); const [lTo, setLTo] = useState(""); const [lPaid, setLPaid] = useState(true);
  const load = useCallback(() => { apiFetch<any[]>(`/api/leave-requests?x=1${empId ? `&employeeId=${empId}` : ""}`).then(setRows).catch(() => setRows([])); }, [empId]);
  useEffect(() => { load(); }, [empId]); // eslint-disable-line
  return (
    <div className="space-y-4">
      {canWrite && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="text-sm font-semibold">Tạo đơn nghỉ</div>
          <Select value={lEmp} onChange={(e) => setLEmp(e.target.value)}><option value="">— Nhân sự —</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</Select>
          <Select value={lType} onChange={(e) => setLType(e.target.value)}>{Object.entries(LEAVE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l as string}</option>)}</Select>
          <Input type="date" value={lFrom} onChange={(e) => setLFrom(e.target.value)} />
          <Input type="date" value={lTo} onChange={(e) => setLTo(e.target.value)} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={lPaid} onChange={(e) => setLPaid(e.target.checked)} /> Có lương</label>
          <Button size="sm" disabled={!lEmp || !lFrom || !lTo} onClick={async () => { await wrap(apiFetch("/api/leave-requests", { method: "POST", body: JSON.stringify({ employeeId: lEmp, type: lType, fromAt: lFrom, toAt: lTo, isPaid: lPaid, autoApprove: true }) })); setLFrom(""); setLTo(""); load(); }}>Tạo &amp; duyệt</Button>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Loại</th><th className="px-3 py-2">Từ</th><th className="px-3 py-2">Đến</th><th className="px-3 py-2">Lương</th><th className="px-3 py-2">Trạng thái</th>{canWrite && <th />}
        </tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Chưa có đơn nghỉ.</td></tr> :
          rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="px-3 py-2">{r.employee?.fullName ?? "—"}</td>
              <td className="px-3 py-2">{LEAVE_TYPE_LABEL[r.type] ?? r.type}</td>
              <td className="px-3 py-2">{formatDate(r.fromAt)}</td>
              <td className="px-3 py-2">{formatDate(r.toAt)}</td>
              <td className="px-3 py-2">{r.isPaid ? "Có" : "Không"}</td>
              <td className="px-3 py-2"><Badge tone={LEAVE_STATUS_TONE[r.status] as any}>{LEAVE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
              {canWrite && <td className="px-3 py-2 text-right">{r.status === "PENDING" && (
                <span className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={async () => { await wrap(apiFetch(`/api/leave-requests/${r.id}/approve`, { method: "POST", body: "{}" })); load(); }}>Duyệt</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { const reason = prompt("Lý do từ chối?") ?? ""; await wrap(apiFetch(`/api/leave-requests/${r.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) })); load(); }}>Từ chối</Button>
                </span>
              )}</td>}
            </tr>
          ))}</tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
