"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  LIBRARY_STATUS_LABEL,
  LIBRARY_STATUS_TONE,
  PROTOCOL_KIND_LABEL,
} from "@/lib/clinic-labels";

interface Protocol {
  id: string;
  code: string;
  name: string;
  kind: string;
  version: number;
  status: string;
  brand?: { name: string } | null;
  _count: { technologies: number; products: number; sessions: number };
}
interface Brand { id: string; name: string }

export default function ProtocolsPage() {
  const canWrite = useCan(PERMISSIONS.PROTOCOL_WRITE);
  const [rows, setRows] = useState<Protocol[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", kind: "BRAND", brandId: "", purpose: "", suitableFor: "",
    contraindications: "", recommendedFreq: "", recommendedCount: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Protocol[]>(`/api/brand-protocols${kindFilter ? `?kind=${kindFilter}` : ""}`));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kindFilter]);
  useEffect(() => { apiFetch<Brand[]>("/api/brands").then(setBrands).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      if (!body.brandId) delete body.brandId;
      if (body.recommendedCount) body.recommendedCount = Number(body.recommendedCount); else delete body.recommendedCount;
      Object.keys(body).forEach((k) => { if (body[k] === "") delete body[k]; });
      await apiFetch("/api/brand-protocols", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ name: "", kind: "BRAND", brandId: "", purpose: "", suitableFor: "", contraindications: "", recommendedFreq: "", recommendedCount: "" });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Protocol Library"
        description="Protocol chuẩn của hãng và protocol nội bộ. Khác với phác đồ riêng của khách hàng."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm protocol</Button>}
      />
      <div className="mb-4 flex items-center gap-2">
        <Label className="text-muted-foreground">Loại</Label>
        <Select className="w-40" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="BRAND">Hãng</option>
          <option value="INTERNAL">Nội bộ</option>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Loại</TH><TH>Brand</TH><TH>Ver</TH><TH>Công nghệ</TH><TH>SP</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có protocol</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono font-medium"><Link href={`/protocols/${p.id}`} className="text-primary hover:underline">{p.code}</Link></TD>
                    <TD><Link href={`/protocols/${p.id}`} className="hover:underline">{p.name}</Link></TD>
                    <TD><Badge tone={p.kind === "BRAND" ? "default" : "muted"}>{PROTOCOL_KIND_LABEL[p.kind]}</Badge></TD>
                    <TD>{p.brand?.name ?? "—"}</TD>
                    <TD>v{p.version}</TD>
                    <TD>{p._count.technologies}</TD>
                    <TD>{p._count.products}</TD>
                    <TD><Badge tone={LIBRARY_STATUS_TONE[p.status]}>{LIBRARY_STATUS_LABEL[p.status]}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm protocol" className="max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên protocol *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="BRAND">Hãng</option>
                <option value="INTERNAL">Nội bộ</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              <option value="">— (protocol nội bộ có thể không thuộc brand) —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Mục tiêu</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tình trạng phù hợp</Label><Input value={form.suitableFor} onChange={(e) => setForm({ ...form, suitableFor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Chống chỉ định</Label><Input value={form.contraindications} onChange={(e) => setForm({ ...form, contraindications: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tần suất khuyến nghị</Label><Input value={form.recommendedFreq} onChange={(e) => setForm({ ...form, recommendedFreq: e.target.value })} placeholder="VD: 2 tuần/lần" /></div>
            <div className="space-y-1.5"><Label>Số lần khuyến nghị</Label><Input type="number" value={form.recommendedCount} onChange={(e) => setForm({ ...form, recommendedCount: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Bước thực hiện, công nghệ, sản phẩm cấu hình ở trang chi tiết sau khi tạo.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
