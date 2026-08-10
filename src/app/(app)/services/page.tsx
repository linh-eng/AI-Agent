"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Product { id: string; sku: string; name: string; uom: string }
interface SvItem { productId: string; quantity: number; product?: Product }
interface Service {
  id: string;
  code: string;
  name: string;
  price?: number | null;
  note?: string | null;
  isActive: boolean;
  items: { productId: string; quantity: number; product: Product }[];
}
interface FormItem { productId: string; quantity: string }

export default function ServicesPage() {
  const canWrite = useCan(PERMISSIONS.SERVICE_WRITE);
  const [rows, setRows] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", price: "", note: "", isActive: true });
  const [items, setItems] = useState<FormItem[]>([{ productId: "", quantity: "" }]);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Service[]>("/api/services"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Product[]>("/api/products").then(setProducts).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", price: "", note: "", isActive: true });
    setItems([{ productId: "", quantity: "" }]);
    setError(null);
    setOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setForm({ code: s.code, name: s.name, price: s.price != null ? String(s.price) : "", note: s.note ?? "", isActive: s.isActive });
    setItems(
      s.items.length
        ? s.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity) }))
        : [{ productId: "", quantity: "" }]
    );
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanItems = items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));
    try {
      const price = form.price ? Number(form.price) : null;
      if (editing) {
        await apiFetch(`/api/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, price, note: form.note || null, isActive: form.isActive, items: cleanItems }),
        });
      } else {
        await apiFetch("/api/services", {
          method: "POST",
          body: JSON.stringify({ code: form.code, name: form.name, price, note: form.note || null, items: cleanItems }),
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
        title="Liệu trình dịch vụ"
        description="Khai báo định mức vật tư tiêu hao cho mỗi lượt dịch vụ. Khi ghi nhận thực hiện, hệ thống tự trừ kho."
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm liệu trình
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Tên liệu trình</TH>
                <TH className="text-right">Đơn giá</TH>
                <TH>Định mức tiêu hao / lượt</TH>
                <TH className="text-center">Trạng thái</TH>
                {canWrite && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canWrite ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={canWrite ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    Chưa có liệu trình
                  </TD>
                </TR>
              ) : (
                rows.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono font-medium">{s.code}</TD>
                    <TD>{s.name}</TD>
                    <TD className="text-right">{s.price != null ? `${formatNumber(s.price)} đ` : "—"}</TD>
                    <TD className="text-muted-foreground">
                      {s.items.length === 0 ? (
                        <span className="text-amber-600">Chưa khai báo</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.items.map((i) => (
                            <Badge key={i.productId} tone="muted">
                              {i.product.name}: {formatNumber(i.quantity)} {i.product.uom}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TD>
                    <TD className="text-center">
                      {s.isActive ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="muted">Ngừng</Badge>}
                    </TD>
                    {canWrite && (
                      <TD className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TD>
                    )}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Sửa liệu trình" : "Thêm liệu trình"} className="max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tên liệu trình *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đơn giá / lượt (đ)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang áp dụng
            </label>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Định mức tiêu hao / lượt</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((p) => [...p, { productId: "", quantity: "" }])}
              >
                <Plus className="h-4 w-4" /> Thêm vật tư
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-8">
                    <Select value={it.productId} onChange={(e) => setItems((p) => p.map((x, idx) => (idx === i ? { ...x, productId: e.target.value } : x)))}>
                      <option value="">— Chọn vật tư —</option>
                      {products.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.sku} — {pr.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Định mức"
                      value={it.quantity}
                      onChange={(e) => setItems((p) => p.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
