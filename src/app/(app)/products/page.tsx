"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { focusNextOnEnter } from "@/lib/form";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { TRACKING_MODE_LABEL, TRACKING_MODE_TONE } from "@/lib/labels";

type Mode = "LOT" | "QUANTITY";
interface Category {
  id: string;
  name: string;
}
interface Brand {
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
  isTester?: boolean;
  uom: string;
  minStock?: number | null;
  expiryDate?: string | null;
  expiryAlertDays?: number | null;
}

// Số ngày còn lại tới HSD (âm = đã quá hạn). null nếu chưa nhập HSD.
function daysToExpiry(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

const EMPTY = {
  sku: "",
  barcode: "",
  name: "",
  brand: "",
  categoryId: "",
  trackingMode: "LOT" as Mode,
  requiresExpiry: true,
  isTester: false,
  uom: "Cái",
  minStock: "",
  expiryAlertDays: "",
  purchaseDate: "",
  openedDate: "",
  expiryDate: "",
};

export default function ProductsPage() {
  const canWrite = useCan(PERMISSIONS.PRODUCT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
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
    apiFetch<Brand[]>("/api/brands").then(setBrands).catch(() => {});
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
          isTester: form.isTester,
          uom: form.uom,
          minStock: form.minStock ? Number(form.minStock) : null,
          expiryAlertDays: form.expiryAlertDays ? Number(form.expiryAlertDays) : null,
          purchaseDate: form.purchaseDate || null,
          openedDate: form.openedDate || null,
          expiryDate: form.expiryDate || null,
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
                <TH>HSD</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chưa có sản phẩm
                  </TD>
                </TR>
              ) : (
                filtered.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs font-medium">{p.sku}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.isTester && <Badge tone="warning">Hàng test</Badge>}
                      </div>
                      {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
                    </TD>
                    <TD className="text-muted-foreground">{p.category?.name ?? "—"}</TD>
                    <TD>
                      <Badge tone={TRACKING_MODE_TONE[p.trackingMode]}>
                        {TRACKING_MODE_LABEL[p.trackingMode]}
                        {p.trackingMode === "LOT" && p.requiresExpiry ? " · HSD" : ""}
                      </Badge>
                    </TD>
                    <TD>{p.uom}</TD>
                    <TD className="text-right">{p.minStock != null ? formatNumber(p.minStock) : "—"}</TD>
                    <TD>
                      {(() => {
                        const days = daysToExpiry(p.expiryDate);
                        if (days == null) return <span className="text-muted-foreground">—</span>;
                        const threshold = p.expiryAlertDays ?? 60;
                        if (days < 0) return <Badge tone="danger">Đã hết hạn</Badge>;
                        if (days <= threshold)
                          return <Badge tone="warning">Còn {formatNumber(days)} ngày</Badge>;
                        return <span className="text-muted-foreground">Còn {formatNumber(days)} ngày</span>;
                      })()}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm sản phẩm">
        <form onSubmit={create} onKeyDown={focusNextOnEnter} className="space-y-4">
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
              <Combobox
                value={form.brand}
                onChange={(v) => setForm({ ...form, brand: v })}
                placeholder="— Chọn thương hiệu —"
                items={brands.map((b) => ({ value: b.name, label: b.name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nhóm hàng</Label>
              <Combobox
                value={form.categoryId}
                onChange={(v) => setForm({ ...form, categoryId: v })}
                placeholder="— Chọn nhóm —"
                items={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isTester}
              onChange={(e) => setForm({ ...form, isTester: e.target.checked })}
            />
            Hàng test / tester (dùng thử, không bán)
          </label>
          {form.trackingMode === "LOT" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.requiresExpiry}
                onChange={(e) => setForm({ ...form, requiresExpiry: e.target.checked })}
              />
              Bắt buộc nhập HSD khi nhận hàng (theo lô)
            </label>
          )}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Mốc hạn sử dụng (hệ thống tự tính số ngày cảnh báo)</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Ngày mua</Label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày mở nắp</Label>
                <Input
                  type="date"
                  value={form.openedDate}
                  onChange={(e) => setForm({ ...form, openedDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hạn sử dụng (HSD)</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cảnh báo trước HSD (số ngày)</Label>
                <Input
                  type="number"
                  placeholder="Mặc định 60"
                  value={form.expiryAlertDays}
                  onChange={(e) => setForm({ ...form, expiryAlertDays: e.target.value })}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Nhập HSD ở đây để hệ thống tự tính “còn bao nhiêu ngày” và cảnh báo khi tới ngưỡng. Sản phẩm
              quản lý theo lô vẫn theo dõi HSD riêng của từng lô khi nhập kho.
            </p>
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
