"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, FileSpreadsheet } from "lucide-react";
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
  openMaxMonths?: number | null;
  storeWarnMonths?: number | null;
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
  purchaseDate?: string | null;
  openedDate?: string | null;
  expiryDate?: string | null;
  expiryAlertDays?: number | null;
}

function parseISO(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function daysBetween(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Ngưỡng mặc định "tồn lâu chưa mở" khi nhóm chưa cấu hình (đồng bộ với src/lib/inventory.ts).
const DEFAULT_STORE_WARN_MONTHS = 12;

/**
 * HSD thực tế của sản phẩm = MIN( HSD trên bao bì, ngày mở nắp + hạn sau mở (PAO nhóm) ).
 *  - Đã mở nắp + nhóm có cấu hình PAO: hạn sau mở là GIỚI HẠN TỐI ĐA (không vượt HSD bao bì).
 *  - Chưa mở nắp (hoặc nhóm chưa cấu hình PAO): dùng HSD trên bao bì.
 * Luôn tính theo NGÀY MỞ NẮP thực tế người dùng nhập, không dùng ngày tạo bản ghi.
 */
function effectiveExpiry(r: Row): { date: Date | null; byOpen: boolean } {
  const pkg = parseISO(r.expiryDate);
  const opened = parseISO(r.openedDate);
  const pao = r.category?.openMaxMonths ?? null;
  const postOpen = opened && pao ? addMonths(opened, pao) : null;
  if (pkg && postOpen) return postOpen < pkg ? { date: postOpen, byOpen: true } : { date: pkg, byOpen: false };
  if (postOpen) return { date: postOpen, byOpen: true };
  return { date: pkg, byOpen: false };
}

// Đã mua quá lâu mà chưa mở nắp (theo ngưỡng của nhóm)? Trả số tháng nếu có cảnh báo.
function storedTooLong(r: Row): number | null {
  const warn = r.category?.storeWarnMonths ?? DEFAULT_STORE_WARN_MONTHS;
  const purchase = parseISO(r.purchaseDate);
  if (!warn || !purchase || r.openedDate) return null;
  const limit = addMonths(purchase, warn);
  if (daysBetween(limit) <= 0) {
    const months = Math.floor((Date.now() - purchase.getTime()) / (30 * 86_400_000));
    return months;
  }
  return null;
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
  const canManage = useCan(PERMISSIONS.PRODUCT_MANAGE);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      sku: r.sku,
      barcode: r.barcode ?? "",
      name: r.name,
      brand: r.brand ?? "",
      categoryId: r.category?.id ?? "",
      trackingMode: r.trackingMode,
      requiresExpiry: !!r.requiresExpiry,
      isTester: !!r.isTester,
      uom: r.uom,
      minStock: r.minStock != null ? String(r.minStock) : "",
      expiryAlertDays: r.expiryAlertDays != null ? String(r.expiryAlertDays) : "",
      purchaseDate: r.purchaseDate ? r.purchaseDate.slice(0, 10) : "",
      openedDate: r.openedDate ? r.openedDate.slice(0, 10) : "",
      expiryDate: r.expiryDate ? r.expiryDate.slice(0, 10) : "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
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
    };
    try {
      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      setForm(EMPTY);
      setEditing(null);
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
            <>
              <Link href="/import#product">
                <Button variant="outline">
                  <FileSpreadsheet className="h-4 w-4" /> Nhập Excel
                </Button>
              </Link>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Thêm sản phẩm
              </Button>
            </>
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
                {canManage && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canManage ? 8 : 7} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={canManage ? 8 : 7} className="py-8 text-center text-muted-foreground">
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
                        const stored = storedTooLong(p);
                        const { date, byOpen } = effectiveExpiry(p);
                        const badges: React.ReactNode[] = [];
                        if (date) {
                          const days = daysBetween(date);
                          const threshold = p.expiryAlertDays ?? 60;
                          const title = byOpen ? "Hạn sau mở nắp" : "HSD bao bì";
                          if (days < 0) badges.push(<Badge key="e" tone="danger">Đã hết hạn</Badge>);
                          else if (days <= threshold)
                            badges.push(
                              <Badge key="e" tone="warning" title={title}>
                                Còn {formatNumber(days)} ngày{byOpen ? " (sau mở)" : ""}
                              </Badge>
                            );
                          else
                            badges.push(
                              <span key="e" className="text-muted-foreground" title={title}>
                                Còn {formatNumber(days)} ngày{byOpen ? " (sau mở)" : ""}
                              </span>
                            );
                        }
                        if (stored != null)
                          badges.push(
                            <Badge key="s" tone="warning" title="Đã mua lâu mà chưa mở nắp">
                              Tồn ~{stored} tháng chưa mở
                            </Badge>
                          );
                        if (badges.length === 0) return <span className="text-muted-foreground">—</span>;
                        return <div className="flex flex-wrap gap-1">{badges}</div>;
                      })()}
                    </TD>
                    {canManage && (
                      <TD className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Chỉnh sửa">
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Chỉnh sửa ${editing.sku}` : "Thêm sản phẩm"}>
        <form onSubmit={save} onKeyDown={focusNextOnEnter} className="space-y-4">
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
