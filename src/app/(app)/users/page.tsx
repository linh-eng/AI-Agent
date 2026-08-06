"use client";
import { useEffect, useState } from "react";
import { Plus, KeyRound, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan, useSession } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Role { id: string; code: string; name: string }
interface User {
  id: string; email: string; name: string; isActive: boolean; createdAt: string;
  roles: { code: string; name: string }[];
}

export default function UsersPage() {
  const canManage = useCan(PERMISSIONS.USER_MANAGE);
  const me = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const [cForm, setCForm] = useState({ email: "", name: "", password: "", roleCodes: [] as string[] });
  const [eForm, setEForm] = useState({ name: "", password: "", isActive: true, roleCodes: [] as string[] });

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([apiFetch<User[]>("/api/users"), apiFetch<Role[]>("/api/roles")]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
  }, [canManage]);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Quản lý người dùng" />
        <Card><CardContent className="py-10 text-center text-muted-foreground">Chỉ Admin mới truy cập được trang này.</CardContent></Card>
      </div>
    );
  }

  function toggleRole(list: string[], code: string): string[] {
    return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null); setMsg(null); setBusy(true);
    try {
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(cForm) });
      setCreateOpen(false);
      setCForm({ email: "", name: "", password: "", roleCodes: [] });
      setMsg("Đã tạo người dùng.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEForm({ name: u.name, password: "", isActive: u.isActive, roleCodes: u.roles.map((r) => r.code) });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null); setMsg(null); setBusy(true);
    try {
      const body: any = { name: eForm.name, isActive: eForm.isActive, roleCodes: eForm.roleCodes };
      if (eForm.password) body.password = eForm.password;
      await apiFetch(`/api/users/${editUser!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditUser(null);
      setMsg("Đã cập nhật người dùng.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Quản lý người dùng"
        description="Tạo tài khoản nhân viên, gán vai trò, đặt lại mật khẩu, bật/tắt tài khoản."
        action={<Button onClick={() => { setCreateOpen(true); setError(null); }}><Plus className="h-4 w-4" /> Thêm người dùng</Button>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && !createOpen && !editUser && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Email</TH><TH>Họ tên</TH><TH>Vai trò</TH><TH>Trạng thái</TH><TH>Ngày tạo</TH><TH></TH></TR></THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : users.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">{u.email}{u.id === me.userId && <span className="ml-1 text-xs text-muted-foreground">(bạn)</span>}</TD>
                  <TD>{u.name}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r.code} tone="muted">{r.name}</Badge>)}
                    </div>
                  </TD>
                  <TD>{u.isActive ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="danger">Đã khóa</Badge>}</TD>
                  <TD className="text-muted-foreground">{formatDate(u.createdAt)}</TD>
                  <TD>
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /> Sửa</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tạo người dùng */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm người dùng">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Họ tên *</Label><Input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} required /></div>
          </div>
          <div className="space-y-1.5"><Label>Mật khẩu *</Label><Input type="text" value={cForm.password} onChange={(e) => setCForm({ ...cForm, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" required /></div>
          <div className="space-y-1.5">
            <Label>Vai trò *</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
              {roles.map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={cForm.roleCodes.includes(r.code)} onChange={() => setCForm({ ...cForm, roleCodes: toggleRole(cForm.roleCodes, r.code) })} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
          {error && createOpen && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={busy}>Tạo</Button></div>
        </form>
      </Modal>

      {/* Sửa người dùng */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Sửa: ${editUser?.email ?? ""}`}>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label>Họ tên</Label><Input value={eForm.name} onChange={(e) => setEForm({ ...eForm, name: e.target.value })} required /></div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Đặt lại mật khẩu</Label>
            <Input type="text" value={eForm.password} onChange={(e) => setEForm({ ...eForm, password: e.target.value })} placeholder="Bỏ trống nếu không đổi" />
          </div>
          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
              {roles.map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={eForm.roleCodes.includes(r.code)} onChange={() => setEForm({ ...eForm, roleCodes: toggleRole(eForm.roleCodes, r.code) })} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={eForm.isActive} disabled={editUser?.id === me.userId} onChange={(e) => setEForm({ ...eForm, isActive: e.target.checked })} />
            Tài khoản đang hoạt động {editUser?.id === me.userId && <span className="text-xs text-muted-foreground">(không thể tự khóa)</span>}
          </label>
          {error && editUser && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditUser(null)}>Hủy</Button><Button type="submit" disabled={busy}>Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
