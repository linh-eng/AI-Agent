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
import { Combobox } from "@/components/ui/combobox";
import { focusNextOnEnter } from "@/lib/form";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { computeDepreciation } from "@/lib/depreciation";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { ASSET_STATUS_LABEL, ASSET_STATUS_TONE } from "@/lib/labels";

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
  warehouseId?: string | null;
  supplierId?: string | null;
  note?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  cost?: number | null;
  salvageValue?: number | null;
  depreciationStart?: string | null;
  depreciationMonths?: number | null;
  depreciationMethod?: "STRAIGHT_LINE" | "DECLINING" | null;
  warrantyVendor?: string | null;
  warrantyMonths?: number | null;
  maintenanceCycleMonths?: number | null;
  contractValue?: number | null;
  managementType?: "DEBT" | "INVOICE" | "CONTRACT" | null;
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  return Math.round((a - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
}

const EMPTY_FORM = {
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
  // (a) khấu hao
  cost: "",
  salvageValue: "",
  depreciationStart: "",
  depreciationMonths: "",
  depreciationMethod: "STRAIGHT_LINE",
  // (b) bảo hành/bảo trì
  warrantyVendor: "",
  warrantyMonths: "",
  maintenanceCycleMonths: "",
  // (c) thanh toán & công nợ
  contractValue: "",
  managementType: "",
};

export default function AssetsPage() {
  const canWrite = useCan(PERMISSIONS.ASSET_WRITE);
  const canManage = useCan(PERMISSIONS.ASSET_MANAGE);
  const [rows, setRows] = useState<Asset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

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
    setForm({ ...EMPTY_FORM });
    setError(null);
    setOpen(true);
  }
  function openEdit(a: Asset) {
    setEditing(a);
    setForm({
      productId: "",
      code: a.code,
      serialNumber: a.serialNumber ?? "",
      warehouseId: a.warehouseId ?? "",
      supplierId: a.supplierId ?? "",
      status: a.status,
      location: a.location ?? "",
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : "",
      warrantyUntil: a.warrantyUntil ? a.warrantyUntil.slice(0, 10) : "",
      note: a.note ?? "",
      cost: a.cost != null ? String(a.cost) : "",
      salvageValue: a.salvageValue != null ? String(a.salvageValue) : "",
      depreciationStart: a.depreciationStart ? a.depreciationStart.slice(0, 10) : "",
      depreciationMonths: a.depreciationMonths != null ? String(a.depreciationMonths) : "",
      depreciationMethod: a.depreciationMethod ?? "STRAIGHT_LINE",
      warrantyVendor: a.warrantyVendor ?? "",
      warrantyMonths: a.warrantyMonths != null ? String(a.warrantyMonths) : "",
      maintenanceCycleMonths: a.maintenanceCycleMonths != null ? String(a.maintenanceCycleMonths) : "",
      contractValue: a.contractValue != null ? String(a.contractValue) : "",
      managementType: a.managementType ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editing && !form.productId) return setError("Vui lòng chọn thiết bị (sản phẩm).");
    const num = (v: string) => (v ? Number(v) : null);
    // Trường khấu hao + bảo hành/bảo trì (dùng chung create & edit).
    const extra = {
      cost: num(form.cost),
      salvageValue: num(form.salvageValue),
      depreciationStart: form.depreciationStart || null,
      depreciationMonths: form.depreciationMonths ? Number(form.depreciationMonths) : null,
      depreciationMethod: form.depreciationMethod || null,
      warrantyVendor: form.warrantyVendor || null,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : null,
      maintenanceCycleMonths: form.maintenanceCycleMonths ? Number(form.maintenanceCycleMonths) : null,
      contractValue: num(form.contractValue),
      managementType: form.managementType || null,
    };
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
            warehouseId: form.warehouseId || null,
            supplierId: form.supplierId || null,
            note: form.note || null,
            ...extra,
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
            ...extra,
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
                <TH className="text-right">GT còn lại</TH>
                {canManage && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canManage ? 8 : 7} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={canManage ? 8 : 7} className="py-8 text-center text-muted-foreground">Chưa có tài sản</TD>
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
                        <Badge tone={ASSET_STATUS_TONE[a.status] ?? "muted"}>{ASSET_STATUS_LABEL[a.status] ?? a.status}</Badge>
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
                      <TD className="text-right">
                        {(() => {
                          if (!a.cost || !a.depreciationMonths || !a.depreciationStart)
                            return <span className="text-muted-foreground">—</span>;
                          const dep = computeDepreciation({
                            cost: a.cost,
                            salvage: a.salvageValue ?? 0,
                            months: a.depreciationMonths,
                            start: new Date(a.depreciationStart),
                            method: a.depreciationMethod ?? "STRAIGHT_LINE",
                          });
                          if (!dep) return <span className="text-muted-foreground">—</span>;
                          return (
                            <span title={`Nguyên giá ${formatNumber(a.cost)} đ · đã KH ${formatNumber(dep.accumulated)} đ`}>
                              {formatNumber(dep.remaining)} đ
                            </span>
                          );
                        })()}
                      </TD>
                      {canManage && (
                        <TD className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Chỉnh sửa">
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
        <form onSubmit={save} onKeyDown={focusNextOnEnter} className="space-y-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Thiết bị *</Label>
                <Combobox
                  required
                  value={form.productId}
                  onChange={(v) => setForm({ ...form, productId: v })}
                  placeholder="— Chọn sản phẩm —"
                  items={products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}`, keywords: p.sku }))}
                />
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
                {Object.entries(ASSET_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
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
            <div className="space-y-1.5">
              <Label>Kho</Label>
              <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
                <option value="">— Không gắn kho —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nhà cung cấp</Label>
            <Combobox
              value={form.supplierId}
              onChange={(v) => setForm({ ...form, supplierId: v })}
              placeholder="— Chọn NCC —"
              items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          {/* (a) Khấu hao */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Khấu hao tài sản</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Nguyên giá (đ)</Label>
                <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Giá trị thu hồi (đ)</Label>
                <Input type="number" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phương pháp</Label>
                <Select value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}>
                  <option value="STRAIGHT_LINE">Đường thẳng</option>
                  <option value="DECLINING">Số dư giảm dần</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bắt đầu khấu hao</Label>
                <Input type="date" value={form.depreciationStart} onChange={(e) => setForm({ ...form, depreciationStart: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Thời gian (tháng)</Label>
                <Input type="number" min="1" value={form.depreciationMonths} onChange={(e) => setForm({ ...form, depreciationMonths: e.target.value })} />
              </div>
            </div>
          </div>

          {/* (b) Bảo hành / bảo trì định kỳ */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Bảo hành &amp; bảo trì định kỳ</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Hãng / đơn vị bảo hành</Label>
                <Input value={form.warrantyVendor} onChange={(e) => setForm({ ...form, warrantyVendor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Thời gian BH (tháng)</Label>
                <Input type="number" min="1" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Chu kỳ bảo trì (tháng)</Label>
                <Input type="number" min="1" value={form.maintenanceCycleMonths} onChange={(e) => setForm({ ...form, maintenanceCycleMonths: e.target.value })} />
              </div>
            </div>
          </div>

          {/* (c) Thanh toán & công nợ */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Thanh toán &amp; công nợ</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tổng giá trị hợp đồng (đ)</Label>
                <Input type="number" min="0" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Hình thức quản lý</Label>
                <Select value={form.managementType} onChange={(e) => setForm({ ...form, managementType: e.target.value })}>
                  <option value="">— Chọn —</option>
                  <option value="DEBT">Theo công nợ</option>
                  <option value="INVOICE">Theo hóa đơn</option>
                  <option value="CONTRACT">Theo hợp đồng</option>
                </Select>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Chi tiết các đợt thanh toán, ngân hàng, hình thức chi trả và file đính kèm quản lý ở trang chi
              tiết tài sản.
            </p>
          </div>
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
