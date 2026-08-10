"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

type Mode = "LOT" | "QUANTITY";
interface Category {
  id: string;
  name: string;
}
interface Row {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: Category | null;
  trackingMode: Mode;
  requiresExpiry: boolean;
  uom: string;
  minStock?: number | null;
}

const EMPTY = {
  sku: "",
  barcode: "",
  name: "",
  brand: "",
  categoryId: "",
  trackingMode: "LOT" as Mode,
  requiresExpiry: true,
  uom: "Cái",
  minStock: "",
  expiryAlertDays: "",
};

export default function ProductsPage() {
  const canWrite = useCan(PERMISSIONS.PRODUCT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/products"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Category[]>("/api/categories").then(setCategories).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          sku: form.sku,
          barcode: form.barcode || null,
          name: form.name,
          brand: form.brand || null,
          categoryId: form.categoryId || null,
          trackingMode: form.trackingMode,
          requiresExpiry: form.trackingMode === "LOT" ? form.requiresExpiry : false,
          uom: form.uom,
          minStock: form.minStock ? Number(form.minStock) : null,
          expiryAlertDays: form.expiryAlertDays ? Number(form.expiryAlertDays) : null,
        }),
      });
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.sku.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description="Hàng hóa trong kho — chế độ quản lý theo lô (có HSD) hoặc theo số lượng."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo tên / SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Tên</TH>
                <TH>Nhóm</TH>
                <TH>Chế độ QL</TH>
                <TH>ĐVT</TH>
                <TH className="text-right">Định mức</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Chưa có sản phẩm
                  </TD>
                </TR>
              ) : (
                filtered.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs font-medium">{p.sku}</TD>
                    <TD>
                      <div className="font-medium">{p.name}</div>
                      {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
                    </TD>
                    <TD className="text-muted-foreground">{p.category?.name ?? "—"}</TD>
                    <TD>
                      {p.trackingMode === "LOT" ? (
                        <Badge tone="default">Theo lô{p.requiresExpiry ? " · HSD" : ""}</Badge>
                      ) : (
                        <Badge tone="muted">Số lượng</Badge>
                      )}
                    </TD>
                    <TD>{p.uom}</TD>
                    <TD className="text-right">{p.minStock != null ? formatNumber(p.minStock) : "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm sản phẩm">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tên sản phẩm *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Thương hiệu</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nhóm hàng</Label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— Chọn nhóm —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Chế độ QL *</Label>
              <Select
                value={form.trackingMode}
                onChange={(e) => setForm({ ...form, trackingMode: e.target.value as Mode })}
              >
                <option value="LOT">Theo lô</option>
                <option value="QUANTITY">Theo số lượng</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ĐVT</Label>
              <Input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Định mức tồn</Label>
              <Input
                type="number"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
          </div>
          {form.trackingMode === "LOT" && (
            <div className="grid grid-cols-2 items-end gap-3">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={form.requiresExpiry}
                  onChange={(e) => setForm({ ...form, requiresExpiry: e.target.checked })}
                />
                Bắt buộc nhập HSD khi nhận hàng
              </label>
              <div className="space-y-1.5">
                <Label>Số ngày cảnh báo trước HSD</Label>
                <Input
                  type="number"
                  placeholder="Mặc định 60"
                  value={form.expiryAlertDays}
                  onChange={(e) => setForm({ ...form, expiryAlertDays: e.target.value })}
                />
              </div>
            </div>
          )}
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
