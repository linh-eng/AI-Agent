"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { EMPLOYEE_ROLE_OPTIONS, EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_TONE } from "@/lib/clinic-labels";

interface Row {
  id: string; code: string; fullName: string; phone?: string | null; email?: string | null;
  title?: string | null; branch?: string | null; status: string; roles: string[];
  mainCompetence?: string | null; competenceCount: number; certCount: number; scheduleCount: number;
}

export default function EmployeesPage() {
  const canWrite = useCan(PERMISSIONS.STAFF_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (role) p.set("role", role); if (branch) p.set("branch", branch); if (status) p.set("status", status);
    try { setRows(await apiFetch<Row[]>(`/api/employees?${p}`)); } finally { setLoading(false); }
  }, [q, role, branch, status]);
  useEffect(() => { load(); }, [load]);

  const branches = Array.from(new Set(rows.map((r) => r.branch).filter(Boolean))) as string[];

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Danh mục nhân viên thực tế (đa vai trò · phí theo vai trò · năng lực · lịch làm việc). Khác Quản trị người dùng (tài khoản đăng nhập)."
        action={canWrite && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Thêm nhân sự</Button>}
      />
      <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm mã / tên..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-40" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Mọi vai trò</option>{EMPLOYEE_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
        <Select className="w-40" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">Mọi chi nhánh</option>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{Object.keys(EMPLOYEE_STATUS_LABEL).map((s) => <option key={s} value={s}>{EMPLOYEE_STATUS_LABEL[s]}</option>)}</Select>
      </CardContent></Card>
      <Card>
        <CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Họ tên</TH><TH>Chức danh</TH><TH>Vai trò</TH><TH>Chuyên môn chính</TH><TH>Chi nhánh</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Không có nhân sự</TD></TR>
              ) : rows.map((e) => (
                <TR key={e.id} className="cursor-pointer hover:bg-muted/40">
                  <TD className="font-mono"><Link href={`/employees/${e.id}`} className="text-primary">{e.code}</Link></TD>
                  <TD><Link href={`/employees/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link></TD>
                  <TD className="text-muted-foreground">{e.title ?? "—"}</TD>
                  <TD><div className="flex flex-wrap gap-1">{e.roles.length ? e.roles.map((r) => <Badge key={r} tone="muted">{r}</Badge>) : <span className="text-muted-foreground">—</span>}</div></TD>
                  <TD className="text-muted-foreground">{e.mainCompetence ?? "—"}{e.competenceCount > 1 ? ` +${e.competenceCount - 1}` : ""}</TD>
                  <TD className="text-muted-foreground">{e.branch ?? "—"}</TD>
                  <TD><Badge tone={EMPLOYEE_STATUS_TONE[e.status] ?? "muted"}>{EMPLOYEE_STATUS_LABEL[e.status] ?? e.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div></CardContent>
      </Card>

      {creating && <CreateModal onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); if (id) window.location.href = `/employees/${id}`; else load(); }} />}
    </div>
  );
}

// Tạo nhanh — thông tin cơ bản; vai trò/phí/năng lực/lịch quản lý ở màn chi tiết.
function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id?: string) => void }) {
  const [f, setF] = useState({ fullName: "", phone: "", email: "", title: "", branch: "", roles: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function toggleRole(r: string) { setF((s) => ({ ...s, roles: s.roles.includes(r) ? s.roles.filter((x) => x !== r) : [...s.roles, r] })); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const r = await apiFetch<{ id: string }>("/api/employees", { method: "POST", body: JSON.stringify({ fullName: f.fullName, phone: f.phone || null, email: f.email || null, title: f.title || null, branch: f.branch || null, roles: f.roles }) });
      onSaved(r.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="Thêm nhân sự">
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5"><Label>Họ tên *</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Điện thoại</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Chức danh chính</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="VD: Chuyên viên da" /></div>
          <div className="space-y-1.5"><Label>Chi nhánh</Label><Input value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} placeholder="VD: CS1" /></div>
        </div>
        <div className="space-y-1.5"><Label>Vai trò (chọn nhiều)</Label>
          <div className="flex flex-wrap gap-2">{EMPLOYEE_ROLE_OPTIONS.map((r) => (
            <button type="button" key={r} onClick={() => toggleRole(r)} className={`rounded-full border px-3 py-1 text-sm ${f.roles.includes(r) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{r}</button>
          ))}</div>
          <p className="text-xs text-muted-foreground">Phí theo từng vai trò khai báo ở màn chi tiết (tab Vai trò &amp; Phí).</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !f.fullName}>{saving ? "Đang lưu..." : "Tạo & mở hồ sơ"}</Button></div>
      </form>
    </Modal>
  );
}
