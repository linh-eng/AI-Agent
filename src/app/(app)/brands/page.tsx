"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { useOpenNew } from "@/lib/use-open-new";
import { PERMISSIONS } from "@/lib/rbac";

interface Brand {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  _count: { products: number; protocols: number; technologies: number };
}

export default function BrandsPage() {
  const canWrite = useCan(PERMISSIONS.BRAND_WRITE);
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", note: "" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Brand[]>("/api/brands")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useOpenNew(() => setOpen(true), canWrite); // ?new=1 → tự mở form Tạo mới

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/brands", { method: "POST", body: JSON.stringify(form) });
      setOpen(false); setForm({ name: "", description: "", note: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Brand"
        description="Quản lý nhiều thương hiệu (DMK, Dermalogica, Klapp…). Admin tự thêm — không hard-code."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm brand</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Mô tả</TH><TH>Công nghệ</TH><TH>Protocol</TH><TH>Sản phẩm</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có brand</TD></TR>
              ) : (
                rows.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-mono font-medium">{b.code}</TD>
                    <TD className="font-medium">{b.name}</TD>
                    <TD className="text-muted-foreground">{b.description ?? "—"}</TD>
                    <TD><Badge tone="muted">{b._count.technologies}</Badge></TD>
                    <TD><Badge tone="muted">{b._count.protocols}</Badge></TD>
                    <TD><Badge tone="muted">{b._count.products}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm brand">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Tên brand *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Ghi chú nội bộ</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
