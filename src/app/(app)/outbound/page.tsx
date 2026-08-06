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
import { OUTBOUND_TYPE_LIST, OUTBOUND_TYPES, type OutboundTypeCode } from "@/lib/outbound";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

interface Order {
  id: string; number: string; type: string; status: string; deliveredAt?: string | null; createdAt: string;
  customer?: { code: string; name: string } | null; project?: { code: string } | null; _count?: { lines: number };
}
interface Opt { id: string; sku?: string; code?: string; name: string; trackingMode?: string }
interface LineForm { productId: string; quantity: string }

export default function OutboundPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.OUTBOUND_WRITE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Opt[]>([]);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);

  const [type, setType] = useState<OutboundTypeCode>("X1");
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ productId: "", quantity: "1" }]);

  const config = OUTBOUND_TYPES[type];

  async function load() {
    setLoading(true);
    try { setOrders(await apiFetch<Order[]>("/api/outbound")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function openModal() {
    setError(null);
    const [p, c, pr] = await Promise.all([
      apiFetch<Opt[]>("/api/products"),
      apiFetch<Opt[]>("/api/partners?type=CUSTOMER"),
      apiFetch<Opt[]>("/api/projects"),
    ]);
    setProducts(p); setCustomers(c); setProjects(pr);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const order = await apiFetch<{ id: string }>("/api/outbound", {
        method: "POST",
        body: JSON.stringify({
          type, customerId: customerId || null, projectId: projectId || null, note: note || null,
          lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        }),
      });
      setOpen(false);
      router.push(`/outbound/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Xuất kho"
        description="Tạo phiếu xuất (X1–X11) → duyệt (kiểm tồn/công nợ) → picking quét serial → bàn giao."
        action={canWrite && <Button onClick={openModal}><Plus className="h-4 w-4" /> Tạo phiếu xuất</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Số phiếu</TH><TH>Loại</TH><TH>Khách/Dự án</TH><TH className="text-right">Dòng</TH><TH>Trạng thái</TH><TH>Giao</TH><TH>Ngày</TH></TR></THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : orders.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có phiếu xuất</TD></TR>
              ) : orders.map((o) => (
                <TR key={o.id}>
                  <TD><Link href={`/outbound/${o.id}`} className="font-mono font-medium text-primary hover:underline">{o.number}</Link></TD>
                  <TD><span className="font-mono">{o.type}</span> <span className="text-muted-foreground">{OUTBOUND_TYPES[o.type as OutboundTypeCode]?.label}</span></TD>
                  <TD>{o.customer?.name ?? o.project?.code ?? "—"}</TD>
                  <TD className="text-right">{o._count?.lines ?? 0}</TD>
                  <TD><Badge tone={DOC_STATUS_TONE[o.status]}>{DOC_STATUS_LABEL[o.status]}</Badge></TD>
                  <TD>{o.deliveredAt ? <Badge tone="success">Đã giao</Badge> : "—"}</TD>
                  <TD className="text-muted-foreground">{formatDate(o.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phiếu xuất" className="max-w-3xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Loại nghiệp vụ *</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as OutboundTypeCode)}>
                {OUTBOUND_TYPE_LIST.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Khách hàng {config.requiresCustomer && "*"}</Label>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Chọn khách —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dự án {config.requiresProject && "*"}</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— Chọn dự án —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Danh sách hàng</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { productId: "", quantity: "1" }])}><Plus className="h-4 w-4" /> Thêm dòng</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Select value={l.productId} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, productId: e.target.value } : x))} required>
                    <option value="">— Sản phẩm —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} [{p.trackingMode}]</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" min="1" value={l.quantity} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
                </div>
                <div className="col-span-1 flex items-center">
                  {lines.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Tạo phiếu"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
