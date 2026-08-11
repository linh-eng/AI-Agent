"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Service {
  id: string;
  code: string;
  name: string;
  durationMinutes?: number | null;
  standardPrice: string | number;
  expectedCost?: string | number | null;
  isActive: boolean;
  category?: { name: string } | null;
}
interface Cat { id: string; code: string; name: string }

export default function ServicesPage() {
  const canWrite = useCan(PERMISSIONS.SERVICE_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Service[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", categoryId: "", durationMinutes: "", standardPrice: "", expectedCost: "", description: "" });
  const [catForm, setCatForm] = useState({ code: "", name: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Service[]>("/api/services"));
      setCats(await apiFetch<Cat[]>("/api/service-categories"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form, standardPrice: Number(form.standardPrice || 0) };
      if (!body.categoryId) delete body.categoryId;
      if (body.durationMinutes) body.durationMinutes = Number(body.durationMinutes); else delete body.durationMinutes;
      if (body.expectedCost) body.expectedCost = Number(body.expectedCost); else delete body.expectedCost;
      if (!body.description) delete body.description;
      await apiFetch("/api/services", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ name: "", categoryId: "", durationMinutes: "", standardPrice: "", expectedCost: "", description: "" });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function createCat(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/service-categories", { method: "POST", body: JSON.stringify(catForm) });
      setCatOpen(false);
      setCatForm({ code: "", name: "" });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Dịch vụ"
        description="Danh mục dịch vụ, giá chuẩn và giá vốn dự kiến. Một dịch vụ dùng được trong nhiều phác đồ."
        action={
          canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCatOpen(true)}>Nhóm dịch vụ</Button>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm dịch vụ</Button>
            </div>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH><TH>Tên</TH><TH>Nhóm</TH><TH>Thời lượng</TH>
                <TH className="text-right">Giá chuẩn</TH>
                {canFinance && <TH className="text-right">Giá vốn</TH>}
                <TH>Trạng thái</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={canFinance ? 7 : 6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={canFinance ? 7 : 6} className="py-8 text-center text-muted-foreground">Chưa có dịch vụ</TD></TR>
              ) : (
                rows.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono font-medium">{s.code}</TD>
                    <TD>{s.name}</TD>
                    <TD>{s.category?.name ?? "—"}</TD>
                    <TD>{s.durationMinutes ? `${s.durationMinutes}′` : "—"}</TD>
                    <TD className="text-right">{formatNumber(Number(s.standardPrice))} ₫</TD>
                    {canFinance && <TD className="text-right text-muted-foreground">{s.expectedCost != null ? formatNumber(Number(s.expectedCost)) + " ₫" : "—"}</TD>}
                    <TD><Badge tone={s.isActive ? "success" : "muted"}>{s.isActive ? "Hoạt động" : "Ngừng"}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm dịch vụ">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Tên dịch vụ *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nhóm</Label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">—</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Giá chuẩn (₫) *</Label><Input type="number" value={form.standardPrice} onChange={(e) => setForm({ ...form, standardPrice: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Giá vốn dự kiến (₫)</Label><Input type="number" value={form.expectedCost} onChange={(e) => setForm({ ...form, expectedCost: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Thêm nhóm dịch vụ">
        <form onSubmit={createCat} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Mã *</Label><Input value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Tên *</Label><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCatOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
