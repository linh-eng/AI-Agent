"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useSession } from "@/components/session-provider";
import { ROLE_LABELS, ROLES, type RoleCode } from "@/lib/rbac";

interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

const ALL_ROLES = Object.values(ROLES) as RoleCode[];

export default function UsersPage() {
  const me = useSession();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    roles: ["STAFF"] as string[],
    isActive: true,
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<User[]>("/api/users"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ email: "", name: "", password: "", roles: ["STAFF"], isActive: true });
    setError(null);
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ email: u.email, name: u.name, password: "", roles: u.roles, isActive: u.isActive });
    setError(null);
    setOpen(true);
  }
  function toggleRole(code: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(code) ? f.roles.filter((r) => r !== code) : [...f.roles, code],
    }));
  }

  async function remove(u: User) {
    if (!confirm(`Xoá tài khoản "${u.name}" (${u.email})?\nThao tác này không thể hoàn tác.`)) return;
    try {
      await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xoá được người dùng");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        const body: any = { name: form.name, roles: form.roles, isActive: form.isActive };
        if (form.password) body.password = form.password;
        await apiFetch(`/api/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify({ email: form.email, name: form.name, password: form.password, roles: form.roles }),
        });
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Quản trị người dùng"
        description="Tạo tài khoản, phân vai trò, khoá/mở, đặt lại mật khẩu và xoá người dùng."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm người dùng
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Họ tên</TH>
                <TH>Email</TH>
                <TH>Vai trò</TH>
                <TH className="text-center">Trạng thái</TH>
                <TH>Ngày tạo</TH>
                <TH className="text-right">Thao tác</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : (
                rows.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-medium">
                      {u.name}
                      {u.id === me.userId && <span className="ml-1 text-xs text-muted-foreground">(bạn)</span>}
                    </TD>
                    <TD className="text-muted-foreground">{u.email}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} tone="default">{ROLE_LABELS[r as RoleCode] ?? r}</Badge>
                        ))}
                      </div>
                    </TD>
                    <TD className="text-center">
                      {u.isActive ? <Badge tone="success">Đang hoạt động</Badge> : <Badge tone="muted">Đã khoá</Badge>}
                    </TD>
                    <TD className="text-muted-foreground">{formatDate(u.createdAt)}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Sửa">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.id !== me.userId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(u)}
                            title="Xoá người dùng"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Sửa: ${editing.name}` : "Thêm người dùng"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Họ tên *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {editing ? "Đặt lại mật khẩu (để trống nếu không đổi)" : "Mật khẩu *"}
            </Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "Nhập để đổi mật khẩu…" : "Tối thiểu 6 ký tự"}
              required={!editing}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vai trò *</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((code) => (
                <label key={code} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox checked={form.roles.includes(code)} onChange={() => toggleRole(code)} />
                  {ROLE_LABELS[code]}
                </label>
              ))}
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                disabled={editing.id === me.userId}
              />
              Tài khoản đang hoạt động
              {editing.id === me.userId && <span className="text-xs text-muted-foreground">(không thể tự khoá)</span>}
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
