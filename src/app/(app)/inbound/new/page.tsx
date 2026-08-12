"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { apiFetch } from "@/lib/client";
import { focusNextOnEnter } from "@/lib/form";

interface Supplier { id: string; name: string; code: string }
interface Warehouse { id: string; name: string; code: string }
interface Product {
  id: string;
  sku: string;
  name: string;
  uom: string;
  trackingMode: "LOT" | "QUANTITY";
  requiresExpiry: boolean;
}
interface Item {
  productId: string;
  batchCode: string;
  expiryDate: string;
  mfgDate: string;
  quantity: string;
  unitCost: string;
}

const emptyItem: Item = {
  productId: "",
  batchCode: "",
  expiryDate: "",
  mfgDate: "",
  quantity: "",
  unitCost: "",
};

export default function NewReceiptPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Supplier[]>("/api/suppliers").then(setSuppliers).catch(() => {});
    apiFetch<Warehouse[]>("/api/warehouses").then((w) => {
      setWarehouses(w);
      if (w[0]) setWarehouseId(w[0].id);
    });
    apiFetch<Product[]>("/api/products").then(setProducts).catch(() => {});
  }, []);

  const productById = new Map(products.map((p) => [p.id, p]));

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        supplierId,
        warehouseId,
        note: note || null,
        items: items.map((it) => ({
          productId: it.productId,
          batchCode: it.batchCode || null,
          expiryDate: it.expiryDate || null,
          mfgDate: it.mfgDate || null,
          quantity: Number(it.quantity),
          unitCost: it.unitCost ? Number(it.unitCost) : null,
        })),
      };
      const res = await apiFetch<{ id: string }>("/api/receipts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/inbound/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setSaving(false);
    }
  }

  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Tạo phiếu nhập"
        description="Chọn nhà cung cấp, kho đích và thêm các dòng hàng."
        action={
          <Link href="/inbound">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>
          </Link>
        }
      />
      <form onSubmit={submit} onKeyDown={focusNextOnEnter} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nhà cung cấp *</Label>
              <Combobox
                required
                value={supplierId}
                onChange={setSupplierId}
                placeholder="— Chọn NCC —"
                items={suppliers.map((s) => ({ value: s.id, label: s.name, keywords: s.code }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kho nhập *</Label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Dòng hàng</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" /> Thêm dòng
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => {
                const p = productById.get(it.productId);
                const isLot = p?.trackingMode === "LOT";
                return (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="space-y-1.5 sm:col-span-4">
                        <Label>Sản phẩm *</Label>
                        <Combobox
                          required
                          value={it.productId}
                          onChange={(v) => updateItem(i, { productId: v })}
                          placeholder="— Chọn —"
                          items={products.map((pr) => ({
                            value: pr.id,
                            label: `${pr.sku} — ${pr.name}`,
                            keywords: pr.sku,
                          }))}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>SL * {p ? `(${p.uom})` : ""}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, { quantity: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-3">
                        <Label>Giá vốn/đơn vị</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={it.unitCost}
                          onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                        />
                      </div>
                      <div className="flex items-end sm:col-span-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(i)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {isLot && (
                      <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Mã lô *</Label>
                          <Input
                            value={it.batchCode}
                            onChange={(e) => updateItem(i, { batchCode: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>HSD {p?.requiresExpiry ? "*" : ""}</Label>
                          <Input
                            type="date"
                            value={it.expiryDate}
                            onChange={(e) => updateItem(i, { expiryDate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ngày SX</Label>
                          <Input
                            type="date"
                            value={it.mfgDate}
                            onChange={(e) => updateItem(i, { mfgDate: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Tổng giá trị: <span className="font-semibold text-foreground">{total.toLocaleString("vi-VN")} đ</span>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu & ghi sổ"}
          </Button>
        </div>
      </form>
    </div>
  );
}
