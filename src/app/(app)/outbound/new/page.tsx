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
import { formatNumber } from "@/lib/utils";

interface Warehouse { id: string; name: string }
interface InvRow {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  onHand: number;
}
interface Item {
  productId: string;
  quantity: string;
}

const ISSUE_TYPES = [
  { value: "SALE", label: "Bán hàng" },
  { value: "INTERNAL_USE", label: "Dùng nội bộ / tiêu hao dịch vụ" },
  { value: "DISPOSAL", label: "Hủy (hết hạn / hỏng)" },
  { value: "ADJUSTMENT", label: "Điều chỉnh giảm" },
];

export default function NewIssuePage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [issueType, setIssueType] = useState("SALE");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Warehouse[]>("/api/warehouses").then((w) => {
      setWarehouses(w);
      if (w[0]) setWarehouseId(w[0].id);
    });
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    apiFetch<InvRow[]>(`/api/inventory?warehouseId=${warehouseId}`)
      .then((rows) => setInventory(rows.filter((r) => r.onHand > 0)))
      .catch(() => setInventory([]));
  }, [warehouseId]);

  const invById = new Map(inventory.map((r) => [r.productId, r]));

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { productId: "", quantity: "" }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!warehouseId) return setError("Vui lòng chọn kho xuất.");
    const cleanItems = items.filter((it) => it.productId || it.quantity);
    const valid = cleanItems.filter((it) => it.productId && Number(it.quantity) > 0);
    if (valid.length === 0)
      return setError("Cần ít nhất 1 dòng hàng: chọn sản phẩm và nhập số lượng > 0.");
    if (cleanItems.some((it) => !it.productId || !(Number(it.quantity) > 0)))
      return setError("Có dòng hàng chưa chọn sản phẩm hoặc chưa nhập số lượng. Vui lòng kiểm tra lại.");
    setSaving(true);
    try {
      const payload = {
        warehouseId,
        issueType,
        customerName: customerName || null,
        note: note || null,
        items: valid.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
        })),
      };
      const res = await apiFetch<{ id: string }>("/api/issues", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/outbound/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tạo phiếu xuất"
        description="Hệ thống tự chọn lô theo FEFO (hết hạn trước xuất trước) và chặn xuất vượt tồn."
        action={
          <Link href="/outbound">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>
          </Link>
        }
      />
      <form onSubmit={submit} onKeyDown={focusNextOnEnter} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Kho xuất *</Label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Loại xuất *</Label>
              <Select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                {ISSUE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Khách / Bộ phận nhận</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
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
                const inv = invById.get(it.productId);
                const qty = Number(it.quantity) || 0;
                const over = inv && qty > inv.onHand;
                return (
                  <div key={i} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-12">
                    <div className="space-y-1.5 sm:col-span-6">
                      <Label>Sản phẩm *</Label>
                      <Combobox
                        required
                        value={it.productId}
                        onChange={(v) => updateItem(i, { productId: v })}
                        placeholder="— Chọn sản phẩm còn tồn —"
                        items={inventory.map((r) => ({
                          value: r.productId,
                          label: `${r.sku} — ${r.name} (tồn ${formatNumber(r.onHand)} ${r.uom})`,
                          keywords: r.sku,
                        }))}
                      />
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
                      {inv && (
                        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                          Khả dụng: {formatNumber(inv.onHand)} {inv.uom}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end sm:col-span-3">
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
                );
              })}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu & ghi sổ"}
          </Button>
        </div>
      </form>
    </div>
  );
}
