"use client";
// =============================================================================
// FLOW-010 (D7) — Self-service: nhân viên TỰ chấm công của MÌNH (không cần quyền
// quản trị attendance.write). Chỉ xem ca/lịch sử của mình + check-in/out của mình.
// API self (/api/attendance/me|check-in|check-out) ủy quyền theo FK userId (chống
// mạo nhận). KHÔNG có thao tác sửa người khác/duyệt nghỉ/quản trị.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatVnTime } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_TONE, ATTENDANCE_FLAG_LABEL } from "@/lib/clinic-labels";

const mins = (m: number | null | undefined) => (m == null ? "—" : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);

export default function MyAttendancePage() {
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { apiFetch<any>("/api/attendance/me").then(setMe).catch(() => setMe({ linked: false })); }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string) => {
    if (busy) return; setBusy(true); setErr(null);
    try { await apiFetch(path, { method: "POST", body: "{}" }); load(); }
    catch (e: any) { setErr(e?.message ?? "Lỗi"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Chấm công của tôi" description="Tự check-in / check-out ca làm việc của bạn." />
      {err && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {!me ? <div className="text-sm text-muted-foreground">Đang tải…</div> : (
        <div className="space-y-4">
          <Card><CardContent className="p-4">
            {!me.linked ? (
              <p className="text-sm text-muted-foreground">Tài khoản của bạn chưa liên kết hồ sơ nhân sự — chưa thể chấm công cá nhân. Vui lòng liên hệ quản lý để liên kết.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">Nhân sự: <b>{me.employee.fullName}</b> ({me.employee.code})</span>
                {me.openAttendance ? (
                  <>
                    <Badge tone="warning">Đang mở từ {formatVnTime(me.openAttendance.checkInAt)}</Badge>
                    <Button size="sm" disabled={busy} onClick={() => act("/api/attendance/check-out")}>Check-out</Button>
                  </>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => act("/api/attendance/check-in")}>Check-in</Button>
                )}
              </div>
            )}
          </CardContent></Card>

          {me.linked && (
            <Card><CardContent className="p-0">
              <div className="border-b px-4 py-2 text-sm font-semibold">Lịch sử chấm công của tôi</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Vào</th><th className="px-3 py-2">Ra</th>
                    <th className="px-3 py-2 text-right">Công</th><th className="px-3 py-2 text-right">Trễ</th><th className="px-3 py-2 text-right">OT*</th>
                    <th className="px-3 py-2">Cờ</th><th className="px-3 py-2">Trạng thái</th>
                  </tr></thead>
                  <tbody>
                    {(me.history ?? []).length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Chưa có dữ liệu.</td></tr> :
                      me.history.map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-3 py-2">{formatDate(r.workDate)}</td>
                          <td className="px-3 py-2">{r.checkInAt ? formatVnTime(r.checkInAt) : "—"}</td>
                          <td className="px-3 py-2">{r.checkOutAt ? formatVnTime(r.checkOutAt) : "—"}</td>
                          <td className="px-3 py-2 text-right">{mins(r.workedMinutes)}</td>
                          <td className="px-3 py-2 text-right">{r.lateMinutes ? `${r.lateMinutes}'` : "—"}</td>
                          <td className="px-3 py-2 text-right">{r.overtimeMinutes ? `${r.overtimeMinutes}'` : "—"}</td>
                          <td className="px-3 py-2">{(r.flags ?? []).map((f: string) => ATTENDANCE_FLAG_LABEL[f] ?? f).join(", ") || "—"}</td>
                          <td className="px-3 py-2"><Badge tone={ATTENDANCE_STATUS_TONE[r.status] as any}>{ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-muted-foreground">* OT = ứng viên giờ làm thêm (tính toán) — chưa phải OT được duyệt/trả lương.</p>
            </CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
