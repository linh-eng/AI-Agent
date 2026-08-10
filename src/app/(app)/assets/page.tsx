"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }
interface Supplier { id: string; name: string }
interface Asset {
  id: string;
  code: string;
  product: { sku: string; name: string };
  serialNumber?: string | null;
  status: string;
  location?: string | null;
  warehouse?: { name: string } | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
}

const STATUS: Record<string, { label: string; tone: "success" | "default" | "warning" | "muted" }> = {
  IN_STOCK: { label: "Trong kho", tone: "success" },
  IN_USE: { label: "Đang dùng", tone: "default" },
  MAINTENANCE: { label: "Bảo trì", tone: "warning" },
  RETIRED: { label: "Thanh lý", tone: "muted" },
};

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  return Math.round((a - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
}

export default function AssetsPage() {
  const canWrite = useCan(PERMISSIONS.ASSET_WRITE);
  const [rows, setRows] = useState<Asset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    productId: "",
    code: "",
    serialNumber: "",
    warehouseId: "",
    supplierId: "",
    status: "IN_STOCK",
    location: "",
    purchaseDate: "",
    warrantyUntil: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Asset[]>("/api/assets"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Product[]>("/api/products").then(setProducts).catch(() => {});
    apiFetch<Warehouse[]>("/api/warehouses").then(setWarehouses).catch(() => {});
    apiFetch<Supplier[]>("/api/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ productId: "", code: "", serialNumber: "", warehouseId: "", supplierId: "", status: "IN_STOCK", location: "", purchaseDate: "", warrantyUntil: "", note: "" });
    setError(null);
    setOpen(true);
  }
  function openEdit(a: Asset) {
    setEditing(a);
    setForm({
      productId: "",
      code: a.code,
      serialNumber: a.serialNumber ?? "",
      warehouseId: "",
      supplierId: "",
      status: a.status,
      location: a.location ?? "",
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : "",
      warrantyUntil: a.warrantyUntil ? a.warrantyUntil.slice(0, 10) : "",
      note: "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/assets/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            serialNumber: form.serialNumber || null,
            status: form.status,
            location: form.location || null,
            purchaseDate: form.purchaseDate || null,
            warrantyUntil: form.warrantyUntil || null,
          }),
        });
      } else {
        await apiFetch("/api/assets", {
          method: "POST",
          body: JSON.stringify({
            productId: form.productId,
            code: form.code || null,
            serialNumber: form.serialNumber || null,
            warehouseId: form.warehouseId || null,
            supplierId: form.supplierId || null,
            status: form.status,
            location: form.location || null,
            purchaseDate: form.purchaseDate || null,
            warrantyUntil: form.warrantyUntil || null,
            note: form.note || null,
          }),
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
        title="Tài sản / Thiết bị"
        description="Theo dõi thiết bị & máy theo serial, trạng thái sử dụng và hạn bảo hành."
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm tài sản
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã TS</TH>
                <TH>Thiết bị</TH>
                <TH>Serial</TH>
                <TH>Vị trí</TH>
                <TH className="text-center">Trạng thái</TH>
                <TH>Bảo hành đến</TH>
                {canWrite && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canWrite ? 7 : 6} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={canWrite ? 7 : 6} className="py-8 text-center text-muted-foreground">Chưa có tài sản</TD>
                </TR>
              ) : (
                rows.map((a) => {
                  const days = a.warrantyUntil ? daysUntil(a.warrantyUntil) : null;
                  return (
                    <TR key={a.id}>
                      <TD>
                        <Link href={`/assets/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                          {a.code}
                        </Link>
                      </TD>
                      <TD>
                        <div className="font-medium">{a.product.name}</div>
                        <div className="text-xs text-muted-foreground">{a.product.sku}</div>
                      </TD>
                      <TD className="font-mono text-xs">{a.serialNumber ?? "—"}</TD>
                      <TD className="text-muted-foreground">{a.location ?? a.warehouse?.name ?? "—"}</TD>
                      <TD className="text-center">
                        <Badge tone={STATUS[a.status]?.tone ?? "muted"}>{STATUS[a.status]?.label ?? a.status}</Badge>
                      </TD>
                      <TD>
                        {a.warrantyUntil ? (
                          <span className={days! < 0 ? "text-red-600" : days! <= 60 ? "text-amber-600" : ""}>
                            {formatDate(a.warrantyUntil)}
                            {days! < 0 ? " (hết BH)" : days! <= 60 ? ` (còn ${days}n)` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      {canWrite && (
                        <TD className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TD>
                      )}
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Sửa tài sản ${editing.code}` : "Thêm tài sản"} className="max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Thiết bị *</Label>
                <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                  <option value="">— Chọn sản phẩm —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mã tài sản</Label>
                <Input placeholder="Tự sinh nếu để trống" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số serial</Label>
              <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ngày mua</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Bảo hành đến</Label>
              <Input type="date" value={form.warrantyUntil} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vị trí đặt</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Kho</Label>
                <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
                  <option value="">— Không gắn kho —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label>Nhà cung cấp</Label>
              <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
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
