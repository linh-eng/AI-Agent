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

interface Issue {
  status: string;
  warehouseId: string;
  issueType: string;
  customerName?: string | null;
  note?: string | null;
  items: { productId: string; quantity: number }[];
}

export default function EditIssuePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [issueType, setIssueType] = useState("SALE");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Phần tồn phiếu này đang giữ — vì sửa = hoàn rồi xuất lại, cộng vào tồn khả
  // dụng để không báo thiếu tồn nhầm khi giữ nguyên số lượng.
  const [held, setHeld] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    apiFetch<Warehouse[]>("/api/warehouses").then(setWarehouses).catch(() => {});
    apiFetch<Issue>(`/api/issues/${params.id}`)
      .then((r) => {
        if (r.status !== "POSTED") {
          setBlocked("Chỉ sửa được phiếu đang ở trạng thái “Đã ghi sổ”.");
          return;
        }
        setWarehouseId(r.warehouseId);
        setIssueType(r.issueType);
        setCustomerName(r.customerName ?? "");
        setNote(r.note ?? "");
        // Gộp các dòng đã tách theo lô (FEFO) về mức sản phẩm để sửa số lượng.
        const agg = new Map<string, number>();
        for (const it of r.items) agg.set(it.productId, (agg.get(it.productId) ?? 0) + it.quantity);
        setHeld(agg);
        const merged = Array.from(agg, ([productId, q]) => ({ productId, quantity: String(q) }));
        setItems(merged.length ? merged : [{ productId: "", quantity: "" }]);
      })
      .catch((e) => setBlocked(e instanceof Error ? e.message : "Không tải được phiếu"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!warehouseId) return;
    apiFetch<InvRow[]>(`/api/inventory?warehouseId=${warehouseId}`)
      .then((rows) => setInventory(rows))
      .catch(() => setInventory([]));
  }, [warehouseId]);

  const invById = new Map(inventory.map((r) => [r.productId, r]));
  // Tồn khả dụng khi sửa = tồn hiện tại + phần phiếu này đang giữ.
  function availableFor(productId: string): number {
    const base = invById.get(productId)?.onHand ?? 0;
    return base + (held.get(productId) ?? 0);
  }

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
    setSaving(true);
    try {
      const payload = {
        reason,
        warehouseId,
        issueType,
        customerName: customerName || null,
        note: note || null,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
        })),
      };
      const res = await apiFetch<{ id: string }>(`/api/issues/${params.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      router.push(`/outbound/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setSaving(false);
    }
  }

  // Sản phẩm hiển thị trong dropdown: những sản phẩm còn tồn hoặc đang được phiếu giữ.
  const selectable = inventory.filter((r) => availableFor(r.productId) > 0);

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (blocked)
    return (
      <div>
        <p className="text-destructive">{blocked}</p>
        <Link href={`/outbound/${params.id}`} className="mt-3 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Quay lại phiếu
          </Button>
        </Link>
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Sửa phiếu xuất"
        description="Hệ thống sẽ hủy phiếu cũ (hoàn tồn) và tạo phiếu xuất mới (phân bổ FEFO lại). Bắt buộc nhập lý do."
        action={
          <Link href={`/outbound/${params.id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>
          </Link>
        }
      />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Kho xuất *</Label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">— Chọn kho —</option>
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

        <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="p-5">
            <div className="space-y-1.5">
              <Label>Lý do sửa phiếu *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: xuất sai số lượng / sai loại xuất…"
                required
                minLength={3}
                maxLength={300}
              />
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
                const avail = it.productId ? availableFor(it.productId) : undefined;
                const inv = invById.get(it.productId);
                const uom = inv?.uom ?? "";
                const qty = Number(it.quantity) || 0;
                const over = avail != null && qty > avail;
                // Dropdown: gồm sản phẩm còn khả dụng + sản phẩm đang chọn (nếu hết tồn).
                const options = selectable.some((r) => r.productId === it.productId) || !it.productId
                  ? selectable
                  : [...selectable, ...inventory.filter((r) => r.productId === it.productId)];
                return (
                  <div key={i} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-12">
                    <div className="space-y-1.5 sm:col-span-6">
                      <Label>Sản phẩm *</Label>
                      <Select
                        value={it.productId}
                        onChange={(e) => updateItem(i, { productId: e.target.value })}
                        required
                      >
                        <option value="">— Chọn sản phẩm còn tồn —</option>
                        {options.map((r) => (
                          <option key={r.productId} value={r.productId}>
                            {r.sku} — {r.name} (khả dụng {formatNumber(availableFor(r.productId))} {r.uom})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label>Số lượng * {uom ? `(${uom})` : ""}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        required
                        className={over ? "border-destructive" : ""}
                      />
                      {avail != null && (
                        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                          Khả dụng: {formatNumber(avail)} {uom}
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
          <Button type="submit" disabled={saving || reason.trim().length < 3}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </div>
  );
}
