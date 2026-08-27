"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";

interface Warehouse { id: string; name: string }
interface InvRow { productId: string; sku: string; name: string; uom: string; onHand: number }
interface Item { productId: string; quantity: string }

export default function NewTransferPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Warehouse[]>("/api/warehouses").then((w) => {
      setWarehouses(w);
      if (w[0]) setFromWarehouseId(w[0].id);
      if (w[1]) setToWarehouseId(w[1].id);
    });
  }, []);

  useEffect(() => {
    if (!fromWarehouseId) return;
    apiFetch<InvRow[]>(`/api/inventory?warehouseId=${fromWarehouseId}`)
      .then((rows) => setInventory(rows.filter((r) => r.onHand > 0)))
      .catch(() => setInventory([]));
  }, [fromWarehouseId]);

  const invById = new Map(inventory.map((r) => [r.productId, r]));

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ id: string }>("/api/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          note: note || null,
          items: items.map((it) => ({ productId: it.productId, quantity: Number(it.quantity) })),
        }),
      });
      router.push(`/transfers/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tạo phiếu chuyển kho"
        description="Chọn kho nguồn & kho đích, thêm sản phẩm cần chuyển."
        action={
          <Link href="/transfers">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>
          </Link>
        }
      />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Kho nguồn *</Label>
              <Select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kho đích *</Label>
              <Select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {fromWarehouseId === toWarehouseId && (
          <p className="text-sm text-amber-600">Kho nguồn và kho đích đang trùng nhau.</p>
        )}

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Sản phẩm chuyển</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((p) => [...p, { productId: "", quantity: "" }])}
              >
                <Plus className="h-4 w-4" /> Thêm dòng
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => {
                const inv = invById.get(it.productId);
                const qty = Number(it.quantity) || 0;
                const over = inv && qty > inv.onHand;
                return (
                  <div key={i} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-12">
                    <div className="space-y-1.5 sm:col-span-7">
                      <Label>Sản phẩm *</Label>
                      <Select
                        value={it.productId}
                        onChange={(e) => updateItem(i, { productId: e.target.value })}
                        required
                      >
                        <option value="">— Chọn sản phẩm còn tồn ở kho nguồn —</option>
                        {inventory.map((r) => (
                          <option key={r.productId} value={r.productId}>
                            {r.sku} — {r.name} (tồn {formatNumber(r.onHand)} {r.uom})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label>Số lượng * {inv ? `(${inv.uom})` : ""}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        required
                        className={over ? "border-destructive" : ""}
                      />
                    </div>
                    <div className="flex justify-end sm:col-span-2">
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
                );
              })}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || fromWarehouseId === toWarehouseId}>
            {saving ? "Đang chuyển…" : "Chuyển & ghi sổ"}
          </Button>
        </div>
      </form>
    </div>
  );
}
