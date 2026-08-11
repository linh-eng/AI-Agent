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
import { formatDate, formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE } from "@/lib/clinic-labels";

interface Proposal {
  id: string; code: string; title: string; status: string;
  agreedPrice?: string | number | null;
  createdAt: string;
  customer: { code: string; fullName: string };
  _count: { options: number };
}
interface Opt { id: string; code: string; fullName: string }

export default function ProposalsPage() {
  const canWrite = useCan(PERMISSIONS.PROPOSAL_WRITE);
  const [rows, setRows] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", title: "" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Proposal[]>("/api/proposals")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); apiFetch<Opt[]>("/api/customers").then(setCustomers).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body = {
        customerId: form.customerId,
        title: form.title,
        options: [{ kind: "RECOMMENDED", name: "Phương án khuyến nghị", items: [] }],
      };
      const p = await apiFetch<{ id: string }>("/api/proposals", { method: "POST", body: JSON.stringify(body) });
      window.location.href = `/proposals/${p.id}`;
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Báo giá / Phương án"
        description="Nhiều phương án ngân sách (Thiết yếu/Khuyến nghị/Cao cấp) cho khách chọn. Chốt → snapshot bất biến."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo báo giá</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tiêu đề</TH><TH>Khách</TH><TH>Số PA</TH><TH className="text-right">Giá chốt</TH><TH>Ngày</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có báo giá</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono font-medium"><Link href={`/proposals/${p.id}`} className="text-primary hover:underline">{p.code}</Link></TD>
                    <TD><Link href={`/proposals/${p.id}`} className="hover:underline">{p.title}</Link></TD>
                    <TD>{p.customer.fullName}</TD>
                    <TD>{p._count.options}</TD>
                    <TD className="text-right">{p.agreedPrice != null ? formatNumber(Number(p.agreedPrice)) + " ₫" : "—"}</TD>
                    <TD>{formatDate(p.createdAt)}</TD>
                    <TD><Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo báo giá">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Khách hàng *</Label>
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
              <option value="">— Chọn khách —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Tiêu đề *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Phương án trị nám 2026" required /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Tạo & thiết kế</Button></div>
        </form>
      </Modal>
    </div>
  );
}
