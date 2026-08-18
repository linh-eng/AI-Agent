"use client";
// HR-PH3 — Đóng góp nhân sự thực tế của buổi (bằng chứng công việc, bất biến sau freeze).
// Thêm/hoàn tác; hiển thị dịch vụ item/bước, phút, trọng số, cờ đối chiếu chấm công.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatVnTime } from "@/lib/timezone";

const mins = (m: number | null) => (m == null ? "—" : `${m}′`);

export function SessionContributions({ sessionId, canWrite, executionItems }: { sessionId: string; canWrite: boolean; executionItems?: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<any>({ employeeId: "", contributionTypeCode: "", sessionExecutionItemId: "", serviceStepKey: "", startedAt: "", endedAt: "", actualMinutes: "", weight: "" });

  const load = useCallback(() => { apiFetch<any[]>(`/api/session-staff-contributions?treatmentSessionId=${sessionId}`).then(setRows).catch(() => setRows([])); }, [sessionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<any[]>("/api/employees?active=1").then(setEmployees).catch(() => setEmployees([]));
    apiFetch<any[]>("/api/staff-contribution-types").then(setTypes).catch(() => setTypes([]));
  }, []);

  const add = async () => {
    try {
      setErr(null);
      await apiFetch("/api/session-staff-contributions", { method: "POST", body: JSON.stringify({
        treatmentSessionId: sessionId, employeeId: f.employeeId, contributionTypeCode: f.contributionTypeCode,
        sessionExecutionItemId: f.sessionExecutionItemId || null, serviceStepKey: f.serviceStepKey || null,
        startedAt: f.startedAt || null, endedAt: f.endedAt || null,
        actualMinutes: f.actualMinutes === "" ? null : Number(f.actualMinutes), weight: f.weight === "" ? null : Number(f.weight),
      }) });
      setF({ employeeId: "", contributionTypeCode: "", sessionExecutionItemId: "", serviceStepKey: "", startedAt: "", endedAt: "", actualMinutes: "", weight: "" });
      load();
    } catch (e: any) { setErr(e?.message ?? "Lỗi"); }
  };
  const reverse = async (id: string) => { const reason = prompt("Lý do hoàn tác đóng góp?"); if (!reason) return; try { await apiFetch(`/api/session-staff-contributions/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }); load(); } catch (e: any) { setErr(e?.message ?? "Lỗi"); } };

  return (
    <div className="space-y-3">
      {err && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Loại</th><th className="px-3 py-2">Dịch vụ/Bước</th>
            <th className="px-3 py-2">Bắt đầu–Kết thúc</th><th className="px-3 py-2 text-right">Phút</th><th className="px-3 py-2 text-right">Trọng số</th>
            <th className="px-3 py-2">Cờ</th><th className="px-3 py-2">Trạng thái</th>{canWrite && <th />}
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={canWrite ? 9 : 8} className="px-3 py-6 text-center text-muted-foreground">Chưa ghi đóng góp nào.</td></tr> :
              rows.map((r) => {
                const flags = (r.crossCheckFlags ?? []) as any[];
                const reversal = r.entryKind === "REVERSAL";
                return (
                  <tr key={r.id} className={`border-b last:border-0 ${r.status === "REVERSED" || reversal ? "text-muted-foreground line-through" : ""}`}>
                    <td className="px-3 py-2">{r.employeeNameSnapshot}{r.employeeRoleSnapshot ? <span className="text-xs text-muted-foreground"> · {r.employeeRoleSnapshot}</span> : null}</td>
                    <td className="px-3 py-2">{r.contributionTypeCode}{reversal ? " (hoàn tác)" : ""}</td>
                    <td className="px-3 py-2">{r.serviceNameSnapshot ?? "—"}{r.serviceStepKey ? ` / ${r.serviceStepKey}` : ""}</td>
                    <td className="px-3 py-2">{r.startedAt ? `${formatVnTime(r.startedAt)}–${r.endedAt ? formatVnTime(r.endedAt) : "…"}` : "—"}</td>
                    <td className="px-3 py-2 text-right">{mins(r.actualMinutes)}</td>
                    <td className="px-3 py-2 text-right">{r.weight ?? "—"}</td>
                    <td className="px-3 py-2">{flags.length ? flags.map((x) => <Badge key={x.code} tone={x.severity === "WARNING" ? "warning" : "muted"}>{x.message}</Badge>) : "—"}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    {canWrite && <td className="px-3 py-2 text-right">{!reversal && r.status !== "REVERSED" && <Button size="sm" variant="ghost" onClick={() => reverse(r.id)}>Hoàn tác</Button>}</td>}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Nhân sự</Label><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">— Chọn —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</Select></div>
          <div className="space-y-1"><Label>Loại đóng góp</Label><Select value={f.contributionTypeCode} onChange={(e) => setF({ ...f, contributionTypeCode: e.target.value })}><option value="">— Chọn —</option>{types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</Select></div>
          <div className="space-y-1"><Label>Dịch vụ thực hiện</Label><Select value={f.sessionExecutionItemId} onChange={(e) => setF({ ...f, sessionExecutionItemId: e.target.value })}><option value="">— Cấp buổi —</option>{(executionItems ?? []).map((it: any) => <option key={it.id} value={it.id}>{it.serviceNameSnapshot ?? it.service?.name ?? it.serviceId}</option>)}</Select></div>
          <div className="space-y-1"><Label>Bước/Phase</Label><Input value={f.serviceStepKey} onChange={(e) => setF({ ...f, serviceStepKey: e.target.value })} placeholder="LASER…" /></div>
          <div className="space-y-1"><Label>Bắt đầu</Label><Input type="datetime-local" value={f.startedAt} onChange={(e) => setF({ ...f, startedAt: e.target.value })} /></div>
          <div className="space-y-1"><Label>Kết thúc</Label><Input type="datetime-local" value={f.endedAt} onChange={(e) => setF({ ...f, endedAt: e.target.value })} /></div>
          <div className="space-y-1"><Label>Hoặc số phút</Label><Input type="number" value={f.actualMinutes} onChange={(e) => setF({ ...f, actualMinutes: e.target.value })} /></div>
          <div className="space-y-1"><Label>Trọng số</Label><Input type="number" step="0.01" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-4"><Button size="sm" disabled={!f.employeeId || !f.contributionTypeCode} onClick={add}>Thêm đóng góp</Button></div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Trọng số = trọng số vận hành (chưa quy đổi tiền — HR-PH5). Cờ vàng = cảnh báo đối chiếu chấm công (không chặn). Sửa sau khi đông cứng: dùng Hoàn tác + ghi lại.</p>
    </div>
  );
}
