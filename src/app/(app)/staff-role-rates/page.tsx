"use client";
// =============================================================================
// ② Bảng ĐƠN GIÁ NHÂN SỰ theo vai trò — catalog dùng chung cho Giá vốn dịch vụ.
// KTV có/chưa chứng chỉ · Master · Bác sĩ · Sales CV/NV — mỗi vai trò có phí +
// thưởng + tips + hoa hồng. Số tiền chỉ hiện với finance.read (server đã mask).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { useOpenNew } from "@/lib/use-open-new";
import { PERMISSIONS } from "@/lib/rbac";

const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));
const emptyForm = { code: "", roleName: "", certified: false, baseFee: 0, bonus: 0, tips: 0, commission: 0, commissionPercent: "", note: "", isActive: true };

export default function StaffRoleRatesPage() {
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiFetch<any[]>(`/api/staff-role-rates`));
      setError(null);
    } catch (e: any) { setError(e?.message ?? "Không tải được"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openNew() { setEditId(null); setForm(emptyForm); setShowForm(true); }
  useOpenNew(openNew, canWrite); // ?new=1 → tự mở form Tạo mới (deep-link nút "+")
  function openEdit(r: any) {
    setEditId(r.id);
    setForm({ code: r.code, roleName: r.roleName, certified: r.certified, baseFee: r.baseFee ?? 0, bonus: r.bonus ?? 0, tips: r.tips ?? 0, commission: r.commission ?? 0, commissionPercent: r.commissionPercent ?? "", note: r.note ?? "", isActive: r.isActive });
    setShowForm(true);
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const body: any = {
        roleName: form.roleName, certified: !!form.certified,
        baseFee: Number(form.baseFee) || 0, bonus: Number(form.bonus) || 0,
        tips: Number(form.tips) || 0, commission: Number(form.commission) || 0,
        commissionPercent: form.commissionPercent === "" ? null : Number(form.commissionPercent),
        note: form.note || null, isActive: !!form.isActive,
      };
      if (editId) await apiFetch(`/api/staff-role-rates/${editId}`, { method: "PATCH", body });
      else await apiFetch(`/api/staff-role-rates`, { method: "POST", body });
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e?.message ?? "Không lưu được"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Đơn giá nhân sự theo vai trò" description="Bảng đơn giá dùng chung cho chi phí nhân sự trong Giá vốn dịch vụ. Sửa 1 nơi, mọi dịch vụ dùng chung (cho ghi đè tại từng dịch vụ)." />

      {!canFinance && (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-amber-700">Bạn không có quyền xem số liệu tài chính — các cột phí/thưởng/hoa hồng bị ẩn.</CardContent></Card>
      )}
      {error && <Card className="mb-4"><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}

      {canWrite && (
        <div className="mb-4">
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-3.5 w-3.5" /> Thêm vai trò</Button>
        </div>
      )}

      {showForm && canWrite && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <div className="text-sm font-semibold">{editId ? "Sửa đơn giá vai trò" : "Thêm đơn giá vai trò"}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Tên vai trò *</Label><Input placeholder="vd: Kỹ thuật viên, Master, Bác sĩ, Sales CV" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} /></div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.certified} onChange={(e) => setForm({ ...form, certified: e.target.checked })} /> Có chứng chỉ</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang dùng</label>
              </div>
              <div><Label>Phí cơ bản (đ)</Label><Input type="number" value={form.baseFee} onChange={(e) => setForm({ ...form, baseFee: e.target.value })} /></div>
              <div><Label>Thưởng (đ)</Label><Input type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} /></div>
              <div><Label>Tips (đ)</Label><Input type="number" value={form.tips} onChange={(e) => setForm({ ...form, tips: e.target.value })} /></div>
              <div><Label>Hoa hồng (đ)</Label><Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} /></div>
              <div><Label>Hoa hồng % (tham khảo)</Label><Input type="number" placeholder="không tính vào giá vốn" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} /></div>
              <div><Label>Ghi chú</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={busy || !form.roleName.trim()}><Save className="mr-1 h-3.5 w-3.5" /> Lưu</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Mã</th><th className="p-3">Vai trò</th><th className="p-3">Chứng chỉ</th>
                  <th className="p-3 text-right">Phí</th><th className="p-3 text-right">Thưởng</th>
                  <th className="p-3 text-right">Tips</th><th className="p-3 text-right">Hoa hồng</th>
                  <th className="p-3 text-right">HH %</th><th className="p-3 text-right">Tổng / lượt</th>
                  <th className="p-3">Trạng thái</th><th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Đang tải…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Chưa có đơn giá vai trò. Bấm “Thêm vai trò”.</td></tr>
                ) : rows.map((r) => {
                  const total = canFinance ? (Number(r.baseFee) || 0) + (Number(r.bonus) || 0) + (Number(r.tips) || 0) + (Number(r.commission) || 0) : null;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{r.code}</td>
                      <td className="p-3 font-medium">{r.roleName}</td>
                      <td className="p-3">{r.certified ? <Badge tone="success">Có CC</Badge> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3 text-right">{money(r.baseFee)}</td>
                      <td className="p-3 text-right">{money(r.bonus)}</td>
                      <td className="p-3 text-right">{money(r.tips)}</td>
                      <td className="p-3 text-right">{money(r.commission)}</td>
                      <td className="p-3 text-right">{r.commissionPercent == null ? "—" : `${Number(r.commissionPercent)}%`}</td>
                      <td className="p-3 text-right font-semibold">{total == null ? "—" : formatCurrency(total)}</td>
                      <td className="p-3">{r.isActive ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="muted">Ngưng</Badge>}</td>
                      <td className="p-3 text-right">{canWrite && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
