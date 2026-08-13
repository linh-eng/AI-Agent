"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/clinic-labels";

interface Employee {
  id: string; code: string; fullName: string; phone?: string | null; email?: string | null;
  roles: string[]; defaultFee?: string | number | null; isActive: boolean; note?: string | null;
}

export default function EmployeesPage() {
  const canWrite = useCan(PERMISSIONS.HR_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Employee[]>("/api/employees")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Nhân viên đa vai trò (Kỹ thuật viên/Master/CSKH/Sales/Quản lý…). Phí mặc định dùng khi phân công buổi."
        action={canWrite && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Thêm nhân sự</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Họ tên</TH><TH>Vai trò</TH><TH>Liên hệ</TH>{canFinance && <TH className="text-right">Phí mặc định</TH>}<TH>Trạng thái</TH>{canWrite && <TH></TH>}</TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có nhân sự</TD></TR>
              ) : rows.map((e) => (
                <TR key={e.id} className={e.isActive ? "" : "opacity-50"}>
                  <TD className="font-mono">{e.code}</TD>
                  <TD className="font-medium">{e.fullName}</TD>
                  <TD><div className="flex flex-wrap gap-1">{e.roles.length ? e.roles.map((r) => <Badge key={r} tone="muted">{r}</Badge>) : <span className="text-muted-foreground">—</span>}</div></TD>
                  <TD className="text-xs text-muted-foreground">{[e.phone, e.email].filter(Boolean).join(" · ") || "—"}</TD>
                  {canFinance && <TD className="text-right">{e.defaultFee != null ? formatCurrency(Number(e.defaultFee)) : "—"}</TD>}
                  <TD>{e.isActive ? <Badge tone="success">Đang làm</Badge> : <Badge tone="muted">Ngưng</Badge>}</TD>
                  {canWrite && <TD><Button size="icon" variant="ghost" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button></TD>}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || edit) && (
        <EmployeeModal
          employee={edit}
          canFinance={canFinance}
          onClose={() => { setCreating(false); setEdit(null); }}
          onSaved={() => { setCreating(false); setEdit(null); load(); }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, canFinance, onClose, onSaved }: { employee: Employee | null; canFinance: boolean; onClose: () => void; onSaved: () => void }) {
  const editing = !!employee;
  const [f, setF] = useState({
    fullName: employee?.fullName ?? "", phone: employee?.phone ?? "", email: employee?.email ?? "",
    roles: employee?.roles ?? [] as string[], defaultFee: employee?.defaultFee != null ? String(employee.defaultFee) : "",
    note: employee?.note ?? "", isActive: employee?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleRole(r: string) {
    setF((s) => ({ ...s, roles: s.roles.includes(r) ? s.roles.filter((x) => x !== r) : [...s.roles, r] }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const body: any = { fullName: f.fullName, phone: f.phone || null, email: f.email || null, roles: f.roles, note: f.note || null, isActive: f.isActive };
    if (canFinance) body.defaultFee = f.defaultFee ? Number(f.defaultFee) : null;
    try {
      if (editing) await apiFetch(`/api/employees/${employee!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await apiFetch("/api/employees", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Sửa nhân sự ${employee!.code}` : "Thêm nhân sự"}>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5"><Label>Họ tên *</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Điện thoại</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Vai trò (chọn nhiều)</Label>
          <div className="flex flex-wrap gap-2">
            {EMPLOYEE_ROLE_OPTIONS.map((r) => (
              <label key={r} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${f.roles.includes(r) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Checkbox checked={f.roles.includes(r)} onChange={() => toggleRole(r)} /> {r}
              </label>
            ))}
          </div>
        </div>
        {canFinance && <div className="space-y-1.5"><Label>Phí mặc định mỗi buổi</Label><Input type="number" value={f.defaultFee} onChange={(e) => setF({ ...f, defaultFee: e.target.value })} placeholder="VD: 200000" /></div>}
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {editing && <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Đang làm việc</label>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !f.fullName}>{saving ? "Đang lưu..." : "Lưu"}</Button></div>
      </form>
    </Modal>
  );
}
