"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { LIBRARY_STATUS_LABEL, LIBRARY_STATUS_TONE } from "@/lib/clinic-labels";

interface Template {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  version: number;
  status: string;
  updatedAt: string;
  _count: { instances: number };
}

export default function FormTemplatesPage() {
  const canWrite = useCan(PERMISSIONS.FORM_WRITE);
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "", description: "" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Template[]>("/api/form-templates")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const t = await apiFetch<{ id: string }>("/api/form-templates", { method: "POST", body: JSON.stringify(form) });
      window.location.href = `/form-templates/${t.id}`;
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Biểu mẫu / Protocol Builder"
        description="Thiết kế biểu mẫu động (kéo–thả) cho phác đồ, đánh giá, tư vấn. Có version & phê duyệt."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo biểu mẫu</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Nhóm</TH><TH>Ver</TH><TH>Đã áp dụng</TH><TH>Cập nhật</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có biểu mẫu</TD></TR>
              ) : (
                rows.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-mono font-medium"><Link href={`/form-templates/${t.id}`} className="text-primary hover:underline">{t.code}</Link></TD>
                    <TD><Link href={`/form-templates/${t.id}`} className="hover:underline">{t.name}</Link></TD>
                    <TD>{t.category ?? "—"}</TD>
                    <TD>v{t.version}</TD>
                    <TD>{t._count.instances}</TD>
                    <TD>{formatDate(t.updatedAt)}</TD>
                    <TD><Badge tone={LIBRARY_STATUS_TONE[t.status]}>{LIBRARY_STATUS_LABEL[t.status]}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo biểu mẫu">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Tên biểu mẫu *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Nhóm</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Phác đồ / Đánh giá / Tư vấn" /></div>
          <div className="space-y-1.5"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Tạo & thiết kế</Button></div>
        </form>
      </Modal>
    </div>
  );
}
