"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  REQUEST_TYPE_LIST,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_TYPES,
} from "@/lib/requests";

interface Req {
  id: string; code: string; type: string; status: string; priority: string;
  content: string | null; neededBy: string | null; slaDeadline: string | null;
  createdAt: string; _count: { lines: number; comments: number };
}
interface Opt { id: string; code?: string; sku?: string; name: string }

const STATUS_TONE: Record<string, any> = {
  DRAFT: "muted", PENDING_RECEIPT: "warning", RECEIVED: "default", IN_PROGRESS: "default",
  PENDING_SUPPLEMENT: "warning", PENDING_ACCEPTANCE: "warning", DONE: "success",
  REJECTED: "danger", CANCELLED: "muted",
};

export default function RequestsPage() {
  const canWrite = useCan(PERMISSIONS.REQUEST_WRITE);
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fScope, setFScope] = useState("");

  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Opt[]>([]);
  const [partners, setPartners] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    type: "YCX", priority: "P2", p1Reason: "", content: "", partnerId: "", projectId: "",
    isCommercialStock: false, deliveryLocation: "", neededBy: "", relatedDocCode: "",
    lines: [{ productId: "", quantity: 1, designatedSerial: "", techNote: "" }],
  });

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (fType) qs.set("type", fType);
      if (fStatus) qs.set("status", fStatus);
      if (fScope) qs.set("mine", fScope);
      setRows(await apiFetch<Req[]>(`/api/requests?${qs.toString()}`));
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [fType, fStatus, fScope]);

  async function openCreate() {
    setError(null);
    if (products.length === 0) {
      const [p, pa, pr] = await Promise.all([
        apiFetch<Opt[]>("/api/products"), apiFetch<Opt[]>("/api/partners"), apiFetch<Opt[]>("/api/projects"),
      ]);
      setProducts(p); setPartners(pa); setProjects(pr);
    }
    setOpen(true);
  }

  const def = REQUEST_TYPES[form.type as keyof typeof REQUEST_TYPES];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const payload = {
        ...form,
        neededBy: form.neededBy || null,
        partnerId: form.partnerId || null,
        projectId: form.projectId || null,
        lines: def?.needsLines
          ? form.lines.filter((l: any) => l.productId).map((l: any) => ({ ...l, quantity: Number(l.quantity) }))
          : [],
      };
      await apiFetch("/api/requests", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setForm({ ...form, content: "", p1Reason: "", lines: [{ productId: "", quantity: 1 }] });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  function setLine(i: number, patch: any) {
    setForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => (idx === i ? { ...l, ...patch } : l)) }));
  }

  return (
    <div>
      <PageHeader
        title="Yêu cầu (5A-0)"
        description="Lớp yêu cầu hai chiều: nhập/xuất/chuyển/mua/kiểm kê/mở khóa/tra cứu. Mọi phiếu đều bắt nguồn từ một yêu cầu."
        action={canWrite && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Tạo yêu cầu</Button>}
      />

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={fType} onChange={(e) => setFType(e.target.value)} className="w-48">
          <option value="">— Tất cả loại —</option>
          {REQUEST_TYPE_LIST.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-44">
          <option value="">— Tất cả trạng thái —</option>
          {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={fScope} onChange={(e) => setFScope(e.target.value)} className="w-44">
          <option value="">— Tất cả —</option>
          <option value="1">Tôi tạo</option>
          <option value="assigned">Tôi phụ trách</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Mã YC</TH><TH>Loại</TH><TH>Ưu tiên</TH><TH>Trạng thái</TH><TH>Nội dung</TH><TH>Dòng</TH><TH>Cần có</TH><TH>Tạo lúc</TH></TR></THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có yêu cầu nào.</TD></TR>
              ) : rows.map((r) => (
                <TR key={r.id} className="cursor-pointer hover:bg-accent/50">
                  <TD className="font-medium"><Link href={`/requests/${r.id}`} className="text-primary hover:underline">{r.code}</Link></TD>
                  <TD>{r.type}</TD>
                  <TD>{r.priority === "P1" ? <Badge tone="danger">P1</Badge> : r.priority === "P3" ? <Badge tone="muted">P3</Badge> : <Badge tone="default">P2</Badge>}</TD>
                  <TD><Badge tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</Badge></TD>
                  <TD className="max-w-xs truncate text-muted-foreground">{r.content}</TD>
                  <TD>{r._count.lines}</TD>
                  <TD className="text-muted-foreground">{r.neededBy ? formatDate(r.neededBy) : "—"}</TD>
                  <TD className="text-muted-foreground">{formatDate(r.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo yêu cầu mới">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại yêu cầu *</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {REQUEST_TYPE_LIST.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mức ưu tiên *</Label>
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(REQUEST_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
          </div>
          {def && <p className="text-xs text-muted-foreground">→ Sinh ra: {def.produces}</p>}

          {form.priority === "P1" && (
            <div className="space-y-1.5">
              <Label>Lý do gấp (P1) *</Label>
              <Input value={form.p1Reason} onChange={(e) => setForm({ ...form, p1Reason: e.target.value })} placeholder="Bắt buộc ghi lý do khi chọn P1" />
            </div>
          )}

          {def?.needsPartner && (
            <div className="space-y-1.5">
              <Label>NCC / Khách hàng *</Label>
              <Select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">— Chọn —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dự án</Label>
              <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— Không —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Thời gian cần có</Label>
              <Input type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} />
            </div>
          </div>
          {form.type === "YCN" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isCommercialStock} onChange={(e) => setForm({ ...form, isCommercialStock: e.target.checked })} />
              Hàng tồn thương mại (nếu không gắn dự án)
            </label>
          )}
          <div className="space-y-1.5">
            <Label>Địa điểm giao nhận</Label>
            <Input value={form.deliveryLocation} onChange={(e) => setForm({ ...form, deliveryLocation: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Nội dung / lý do</Label>
            <Input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Mã chứng từ liên quan (HĐ/PO/đơn/ticket)</Label>
            <Input value={form.relatedDocCode} onChange={(e) => setForm({ ...form, relatedDocCode: e.target.value })} />
          </div>

          {def?.needsLines && (
            <div className="space-y-2">
              <Label>Dòng hàng</Label>
              {form.lines.map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })} className="flex-1">
                    <option value="">— Sản phẩm —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                  </Select>
                  <Input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-20" />
                  <Input placeholder="Serial chỉ định" value={l.designatedSerial ?? ""} onChange={(e) => setLine(i, { designatedSerial: e.target.value })} className="w-40" />
                  {form.lines.length > 1 && (
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, lines: f.lines.filter((_: any, idx: number) => idx !== i) }))} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f: any) => ({ ...f, lines: [...f.lines, { productId: "", quantity: 1 }] }))}>+ Thêm dòng</Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={busy}>Tạo (Nháp)</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
