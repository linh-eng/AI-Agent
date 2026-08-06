"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { WO_STATUS_LABEL, WO_STATUS_TONE, WO_MODE_LABEL } from "@/lib/labels";

interface WO {
  id: string;
  number: string;
  mode: string;
  status: string;
  createdAt: string;
  product?: { sku: string; name: string } | null;
  _count?: { bomPlanned: number; bomAsBuilt: number };
}
interface Opt { id: string; sku: string; name: string; trackingMode: string }

export default function WorkOrdersPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.WORKORDER_WRITE);
  const [rows, setRows] = useState<WO[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState("TO_ORDER");
  const [productId, setProductId] = useState("");
  const [assembledBy, setAssembledBy] = useState("");
  const [note, setNote] = useState("");
  const [bom, setBom] = useState<{ productId: string; quantity: string }[]>([{ productId: "", quantity: "1" }]);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<WO[]>("/api/work-orders"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openModal() {
    setError(null);
    setProducts(await apiFetch<Opt[]>("/api/products"));
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const wo = await apiFetch<{ id: string }>("/api/work-orders", {
        method: "POST",
        body: JSON.stringify({
          mode,
          productId: productId || null,
          assembledBy: assembledBy || null,
          note: note || null,
          bomPlanned: bom
            .filter((b) => b.productId)
            .map((b) => ({ productId: b.productId, quantity: Number(b.quantity) })),
        }),
      });
      setOpen(false);
      router.push(`/work-orders/${wo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Lắp ráp (Work Order)"
        description="Tạo lệnh lắp ráp, cấp phát linh kiện vào WIP, QC/burn-in, sinh thành phẩm + as-built BOM."
        action={canWrite && <Button onClick={openModal}><Plus className="h-4 w-4" /> Tạo lệnh lắp ráp</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Số lệnh</TH>
                <TH>Thành phẩm</TH>
                <TH>Chế độ</TH>
                <TH className="text-right">BOM KH</TH>
                <TH className="text-right">As-built</TH>
                <TH>Trạng thái</TH>
                <TH>Ngày tạo</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có lệnh lắp ráp</TD></TR>
              ) : (
                rows.map((w) => (
                  <TR key={w.id}>
                    <TD>
                      <Link href={`/work-orders/${w.id}`} className="font-mono font-medium text-primary hover:underline">
                        {w.number}
                      </Link>
                    </TD>
                    <TD>{w.product?.name ?? "—"}</TD>
                    <TD className="text-muted-foreground">{WO_MODE_LABEL[w.mode]}</TD>
                    <TD className="text-right">{w._count?.bomPlanned ?? 0}</TD>
                    <TD className="text-right">{w._count?.bomAsBuilt ?? 0}</TD>
                    <TD><Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></TD>
                    <TD className="text-muted-foreground">{formatDate(w.createdAt)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo lệnh lắp ráp" className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Chế độ *</Label>
              <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="TO_ORDER">Lắp theo đơn</option>
                <option value="TO_STOCK">Lắp để tồn kho</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sản phẩm thành phẩm</Label>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— Chọn thành phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Người lắp</Label>
              <Input value={assembledBy} onChange={(e) => setAssembledBy(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>BOM kế hoạch (linh kiện dự kiến)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setBom([...bom, { productId: "", quantity: "1" }])}>
                <Plus className="h-4 w-4" /> Thêm
              </Button>
            </div>
            {bom.map((b, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Select value={b.productId} onChange={(e) => setBom(bom.map((x, idx) => idx === i ? { ...x, productId: e.target.value } : x))}>
                    <option value="">— Linh kiện —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} [{p.trackingMode}]</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" min="1" value={b.quantity} onChange={(e) => setBom(bom.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
                </div>
                <div className="col-span-1 flex items-center">
                  {bom.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setBom(bom.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Tạo lệnh"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
