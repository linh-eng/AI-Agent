"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";

// Vai trò gợi ý (spa + quản trị) — vẫn có thể gán các vai trò khác nếu cần.
const ROLE_OPTIONS = ["ADMIN", "BOD", "MANAGER", "RECEPTION", "CUSTOMER_CARE", "SPECIALIST", "CASHIER", "MARKETING"];

interface Role { code: string; name: string }
interface User { id: string; email: string; name: string; isActive: boolean; createdAt: string; roles: Role[] }

export default function UsersPage() {
  const me = useSession();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setForbidden(false);
    try { setRows(await apiFetch<User[]>("/api/users")); }
    catch (e) { if (e instanceof Error && /quyền|403/.test(e.message)) setForbidden(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(u: User) {
    if (!confirm(`Xóa tài khoản "${u.name}" (${u.email})? Không thể hoàn tác.`)) return;
    setError(null);
    try { await apiFetch(`/api/users/${u.id}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }

  if (forbidden) return (
    <div>
      <PageHeader title="Quản trị người dùng" description="Tạo tài khoản đăng nhập & gán vai trò." />
      <p className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">Chỉ tài khoản Quản trị (Admin) mới được quản lý người dùng.</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Quản trị người dùng"
        description="Tạo tài khoản đăng nhập, gán vai trò, đặt lại mật khẩu, khóa/mở tài khoản."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Thêm người dùng</Button>}
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Họ tên</TH><TH>Email đăng nhập</TH><TH>Vai trò</TH><TH>Ngày tạo</TH><TH>Trạng thái</TH><TH></TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có người dùng</TD></TR>
              ) : rows.map((u) => (
                <TR key={u.id} className={u.isActive ? "" : "opacity-50"}>
                  <TD className="font-medium">{u.name}</TD>
                  <TD className="font-mono text-xs">{u.email}</TD>
                  <TD><div className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map((r) => <Badge key={r.code} tone="muted">{ROLE_LABELS[r.code as keyof typeof ROLE_LABELS] ?? r.name}</Badge>) : <span className="text-muted-foreground">—</span>}</div></TD>
                  <TD>{formatDate(u.createdAt)}</TD>
                  <TD>{u.isActive ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="muted">Đã khóa</Badge>}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit(u)}><Pencil className="h-4 w-4" /></Button>
                      {u.id !== me.userId && <Button size="icon" variant="ghost" onClick={() => remove(u)} title="Xóa tài khoản"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || edit) && <UserModal user={edit} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); load(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [roleCodes, setRoleCodes] = useState<string[]>(user?.roles.map((r) => r.code) ?? []);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(c: string) { setRoleCodes((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      if (editing) {
        const body: any = { name, roleCodes, isActive };
        if (password) body.password = password;
        await apiFetch(`/api/users/${user!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/users", { method: "POST", body: JSON.stringify({ email, name, password, roleCodes, isActive }) });
      }
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Sửa người dùng` : "Thêm người dùng"}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Email đăng nhập *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={editing} required placeholder="nhanvien@sophia.com.vn" /></div>
          <div className="space-y-1.5"><Label>Họ tên *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> {editing ? "Đặt lại mật khẩu (bỏ trống nếu giữ nguyên)" : "Mật khẩu *"}</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={!editing} placeholder={editing ? "••• (không đổi)" : "Tối thiểu 6 ký tự"} />
        </div>
        <div className="space-y-1.5">
          <Label>Vai trò (chọn nhiều)</Label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((c) => (
              <label key={c} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${roleCodes.includes(c) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Checkbox checked={roleCodes.includes(c)} onChange={() => toggle(c)} /> {ROLE_LABELS[c as keyof typeof ROLE_LABELS] ?? c}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Tài khoản hoạt động</label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !name || (!editing && (!email || !password))}>{saving ? "Đang lưu..." : "Lưu"}</Button></div>
      </form>
    </Modal>
  );
}
