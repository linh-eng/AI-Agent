"use client";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SESSION_STAFF_ROLE_LABEL, SESSION_STAFF_ROLE_TONE } from "@/lib/clinic-labels";

const ROLES = ["PRIMARY", "ASSISTANT", "MASTER", "CHECKER", "CONSULTANT"];

/**
 * Phân công NHÂN SỰ cho MỘT buổi — chọn nhân viên (từ danh mục) → vai trò
 * (chính/hỗ trợ/master/kiểm tra/tư vấn) → phí. Phí chỉ hiện với người có quyền
 * tài chính. Ghi vào customer timeline qua buổi.
 */
export function SessionStaff({ sessionId, canWrite }: { sessionId: string; canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalFee, setTotalFee] = useState<number | null>(null);
  const [canFinance, setCanFinance] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("PRIMARY");
  const [fee, setFee] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<any>(`/api/session-staff?sessionId=${sessionId}`);
    setRows(data.staff ?? []);
    setTotalFee(data.totalFee ?? null);
    setCanFinance(!!data.canSeeFinance);
  }, [sessionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<any[]>("/api/employees?active=1").then(setEmployees).catch(() => {}); }, []);

  async function add() {
    setError(null);
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) { setError("Chọn nhân sự"); return; }
    try {
      await apiFetch("/api/session-staff", {
        method: "POST",
        body: JSON.stringify({ sessionId, employeeId, staffName: emp.fullName, role, fee: fee ? Number(fee) : undefined }),
      });
      setEmployeeId(""); setRole("PRIMARY"); setFee("");
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function remove(id: string) {
    await apiFetch(`/api/session-staff/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa phân công nhân sự cho buổi này.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
              <Badge tone={SESSION_STAFF_ROLE_TONE[r.role]}>{SESSION_STAFF_ROLE_LABEL[r.role]}</Badge>
              <span className="font-medium">{r.staffName}</span>
              {canFinance && r.fee != null && <span className="text-xs text-muted-foreground">· {formatCurrency(Number(r.fee))}</span>}
              {canWrite && <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
          {canFinance && totalFee != null && (
            <div className="flex justify-between px-2 pt-1 text-sm font-medium"><span>Tổng phí nhân sự</span><span className="text-primary">{formatCurrency(totalFee)}</span></div>
          )}
        </div>
      )}

      {canWrite && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">Nhân sự</Label>
            <Select className="h-8" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— Chọn —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}{e.roles?.length ? ` (${e.roles.join(", ")})` : ""}</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Vai trò</Label>
            <Select className="h-8 w-28" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{SESSION_STAFF_ROLE_LABEL[r]}</option>)}
            </Select>
          </div>
          {canFinance && <div className="space-y-1"><Label className="text-xs">Phí</Label><Input className="h-8 w-24" type="number" placeholder="mặc định" value={fee} onChange={(e) => setFee(e.target.value)} /></div>}
          <Button type="button" size="sm" onClick={add} disabled={!employeeId}>Thêm</Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
