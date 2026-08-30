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
import { ROLE_LABELS, ROLE_PERMISSIONS, type RoleCode } from "@/lib/rbac";

// Vai trò gợi ý (spa + quản trị) — vẫn có thể gán các vai trò khác nếu cần.
const ROLE_OPTIONS = ["ADMIN", "BOD", "MANAGER", "RECEPTION", "CUSTOMER_CARE", "SPECIALIST", "CASHIER", "MARKETING"];

// Quyền BỔ SUNG có thể cấp riêng cho 1 tài khoản (ngoài vai trò), gom nhóm + nhãn tiếng Việt.
// Server chấp nhận mọi quyền hợp lệ TRỪ user.manage; đây là danh sách thường dùng cho tối ưu công việc.
const EXTRA_PERM_GROUPS: { group: string; items: { code: string; label: string }[] }[] = [
  { group: "Khách hàng & đầu ra", items: [
    { code: "customer.write", label: "Tạo/sửa khách hàng" },
    { code: "proposal.accept", label: "Chốt báo giá" },
    { code: "treatment.editCompleted", label: "Sửa buổi đã hoàn thành" },
    { code: "booking.override", label: "Đặt đè lịch (trùng lịch)" },
    { code: "followup.write", label: "Quản lý quy trình CSKH" },
  ]},
  { group: "Tài chính", items: [
    { code: "payment.write", label: "Thu tiền" },
    { code: "payment.void", label: "Hủy phiếu thu" },
    { code: "invoice.write", label: "Lập hóa đơn" },
    { code: "deposit.write", label: "Thu / phân bổ cọc" },
    { code: "finance.read", label: "Xem giá vốn / dữ liệu tài chính" },
  ]},
  { group: "Thiết lập & giá", items: [
    { code: "service.write", label: "Sửa dịch vụ / SOP" },
    { code: "price.write", label: "Sửa bảng giá" },
    { code: "pricefloor.write", label: "Sửa giá vốn / giá sàn" },
    { code: "pricefloor.override", label: "Duyệt bán dưới giá sàn" },
    { code: "protocol.write", label: "Sửa protocol" },
    { code: "marketing.write", label: "Marketing (chiến dịch)" },
    { code: "setting.write", label: "Cài đặt thương hiệu" },
  ]},
  { group: "Nhân sự & lương", items: [
    { code: "staff.write", label: "Quản lý hồ sơ nhân sự" },
    { code: "attendance.read", label: "Xem chấm công" },
    { code: "attendance.write", label: "Chấm công (điều chỉnh/duyệt)" },
    { code: "payroll.read", label: "Xem bảng lương" },
    { code: "payroll.write", label: "Tính bảng lương" },
    { code: "payroll.approve", label: "Duyệt / chi lương" },
  ]},
];

interface Role { code: string; name: string }
interface User { id: string; email: string; name: string; isActive: boolean; createdAt: string; roles: Role[]; extraPermissions?: string[] }

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
                  <TD><div className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map((r) => <Badge key={r.code} tone="muted">{ROLE_LABELS[r.code as keyof typeof ROLE_LABELS] ?? r.name}</Badge>) : <span className="text-muted-foreground">—</span>}{(u.extraPermissions?.length ?? 0) > 0 && <Badge tone="success">+{u.extraPermissions!.length} quyền</Badge>}</div></TD>
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
  const [extraPerms, setExtraPerms] = useState<string[]>(user?.extraPermissions ?? []);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(c: string) { setRoleCodes((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]); }
  function toggleExtra(c: string) { setExtraPerms((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]); }
  // Quyền đã CÓ theo vai trò đang chọn (để đánh dấu "đã có" — không cần cấp thêm).
  const roleCovered = new Set<string>();
  for (const rc of roleCodes) (ROLE_PERMISSIONS[rc as RoleCode] ?? []).forEach((p) => roleCovered.add(p));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      if (editing) {
        const body: any = { name, roleCodes, extraPermissions: extraPerms, isActive };
        if (password) body.password = password;
        await apiFetch(`/api/users/${user!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/users", { method: "POST", body: JSON.stringify({ email, name, password, roleCodes, extraPermissions: extraPerms, isActive }) });
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
        <div className="space-y-1.5">
          <Label>Quyền bổ sung (cấp riêng cho tài khoản này)</Label>
          <p className="text-xs text-muted-foreground">Cấp thêm quyền ngoài vai trò để tối ưu công việc (VD: một Lễ tân được thêm quyền hủy phiếu thu). Quyền <b>đã có theo vai trò</b> hiện mờ. <b>Quản trị người dùng</b> không cấp được — chỉ Admin.</p>
          <div className="max-h-60 space-y-3 overflow-y-auto rounded-md border p-3">
            {EXTRA_PERM_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{g.group}</div>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const covered = roleCovered.has(it.code);
                    const on = extraPerms.includes(it.code);
                    return (
                      <label key={it.code} title={it.code}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${covered ? "cursor-default border-dashed text-muted-foreground opacity-60" : on ? "cursor-pointer border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "cursor-pointer text-muted-foreground"}`}>
                        <Checkbox checked={on || covered} disabled={covered} onChange={() => !covered && toggleExtra(it.code)} />
                        {it.label}{covered ? " (đã có theo vai trò)" : ""}
                      </label>
                    );
                  })}
                </div>
              </div>
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
