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
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { CUSTOMER_MATERIAL_STATUS_LABEL } from "@/lib/clinic-labels";

export default function CustomerMaterialsPage() {
  const canWrite = useCan(PERMISSIONS.MATERIAL_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", name: "", unit: "", allocatedQty: "", unitCost: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<any[]>("/api/customer-materials"));
      setCustomers(await apiFetch<any[]>("/api/customers").catch(() => []));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function allocate(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const body: any = { customerId: form.customerId, name: form.name, unit: form.unit, allocatedQty: Number(form.allocatedQty) };
      if (form.unitCost) body.unitCost = Number(form.unitCost);
      if (form.note) body.note = form.note;
      await apiFetch("/api/customer-materials", { method: "POST", body: JSON.stringify(body) });
      setOpen(false); setForm({ customerId: "", name: "", unit: "", allocatedQty: "", unitCost: "", note: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Vật tư khách hàng"
        description="Vật tư dành riêng cho từng khách — chỉ dùng cho khách đó, không dùng chéo. Dùng được qua nhiều buổi."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Cấp vật tư cho khách</Button>}
      />
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Mã</TH><TH>Khách hàng</TH><TH>Vật tư</TH><TH className="text-right">Đã cấp</TH><TH className="text-right">Đã dùng</TH><TH className="text-right">Còn lại</TH>{canFinance && <TH className="text-right">Giá vốn/đv</TH>}<TH>Trạng thái</TH></TR></THead>
            <TBody>
              {loading ? <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                : rows.length === 0 ? <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có vật tư khách hàng nào.</TD></TR>
                : rows.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-mono text-sm">{m.code}</TD>
                    <TD>{m.customer?.fullName ?? "—"}</TD>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="text-right tabular-nums">{Number(m.allocatedQty)} {m.unit}</TD>
                    <TD className="text-right tabular-nums">{Number(m.usedQty)}</TD>
                    <TD className="text-right tabular-nums font-medium">{Number(m.remainingQty)}</TD>
                    {canFinance && <TD className="text-right text-muted-foreground">{m.unitCost != null ? formatCurrency(m.unitCost) : "—"}</TD>}
                    <TD><Badge tone={m.status === "ACTIVE" ? "success" : m.status === "USED_UP" ? "muted" : "danger"}>{CUSTOMER_MATERIAL_STATUS_LABEL[m.status]}</Badge></TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Cấp vật tư cho khách">
        <form onSubmit={allocate} className="space-y-4">
          <div className="space-y-1.5"><Label>Khách hàng *</Label>
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
              <option value="">— Chọn khách —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.fullName}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên vật tư *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Đơn vị *</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="đơn vị, ml..." required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Số lượng cấp *</Label><Input type="number" step="any" value={form.allocatedQty} onChange={(e) => setForm({ ...form, allocatedQty: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Giá vốn/đơn vị (₫)</Label><Input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
