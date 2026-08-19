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
import { PRODUCT_TYPE_LABEL } from "@/lib/clinic-labels";

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  productType: string;
  sellingPrice?: string | number | null;
  cost?: string | number | null;
  brand?: { name: string } | null;
}
interface Brand { id: string; name: string }

export default function CatalogPage() {
  const canWrite = useCan(PERMISSIONS.CATALOG_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", brandId: "", category: "", productType: "HOME_CARE",
    sellingPrice: "", cost: "", benefits: "", suitableFor: "", usage: "", description: "", ingredients: "", contraindications: "", frequency: "", volume: "",
  });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Product[]>("/api/spa-products")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); apiFetch<Brand[]>("/api/brands").then(setBrands).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      if (!body.brandId) delete body.brandId;
      if (body.sellingPrice) body.sellingPrice = Number(body.sellingPrice); else delete body.sellingPrice;
      if (body.cost) body.cost = Number(body.cost); else delete body.cost;
      Object.keys(body).forEach((k) => { if (body[k] === "") delete body[k]; });
      await apiFetch("/api/spa-products", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ name: "", brandId: "", category: "", productType: "HOME_CARE", sellingPrice: "", cost: "", benefits: "", suitableFor: "", usage: "", description: "", ingredients: "", contraindications: "", frequency: "", volume: "" });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Sản phẩm (Catalog)"
        description="Product catalog theo brand. Phân biệt sản phẩm chuyên nghiệp (dùng trong buổi) và chăm sóc tại nhà (bán lẻ)."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm sản phẩm</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH><TH>Tên</TH><TH>Brand</TH><TH>Nhóm</TH><TH>Loại</TH>
                <TH className="text-right">Giá bán</TH>
                {canFinance && <TH className="text-right">Giá vốn</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={canFinance ? 7 : 6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={canFinance ? 7 : 6} className="py-8 text-center text-muted-foreground">Chưa có sản phẩm</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono font-medium">{p.sku}</TD>
                    <TD className="font-medium">{p.name}</TD>
                    <TD>{p.brand?.name ?? "—"}</TD>
                    <TD>{p.category ?? "—"}</TD>
                    <TD><Badge tone={p.productType === "PROFESSIONAL" ? "warning" : p.productType === "BOTH" ? "default" : "success"}>{PRODUCT_TYPE_LABEL[p.productType]}</Badge></TD>
                    <TD className="text-right">{p.sellingPrice != null ? formatNumber(Number(p.sellingPrice)) + " ₫" : "—"}</TD>
                    {canFinance && <TD className="text-right text-muted-foreground">{p.cost != null ? formatNumber(Number(p.cost)) + " ₫" : "—"}</TD>}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm sản phẩm" className="max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                <option value="">—</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Nhóm</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                {Object.entries(PRODUCT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Giá bán (₫)</Label><Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Giá vốn (₫)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tình trạng phù hợp</Label><Input value={form.suitableFor} onChange={(e) => setForm({ ...form, suitableFor: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Thành phần</Label><Input value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Chống chỉ định</Label><Input value={form.contraindications} onChange={(e) => setForm({ ...form, contraindications: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Công dụng</Label><Input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Hướng dẫn sử dụng</Label><Input value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tần suất</Label><Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Dung tích</Label><Input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
