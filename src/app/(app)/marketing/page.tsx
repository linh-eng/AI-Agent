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
import { formatDate, formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Campaign {
  id: string; code: string; name: string; channel?: string | null; status: string;
  budget?: string | number | null; startDate?: string | null; endDate?: string | null;
  _count: { leads: number; customers: number };
}

export default function MarketingPage() {
  const canWrite = useCan(PERMISSIONS.MARKETING_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", channel: "", budget: "", cost: "", startDate: "", endDate: "", owner: "" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Campaign[]>("/api/marketing-campaigns")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      ["channel", "startDate", "endDate", "owner"].forEach((k) => { if (!body[k]) delete body[k]; });
      if (body.budget) body.budget = Number(body.budget); else delete body.budget;
      if (body.cost) body.cost = Number(body.cost); else delete body.cost;
      await apiFetch("/api/marketing-campaigns", { method: "POST", body: JSON.stringify(body) });
      setOpen(false); setForm({ name: "", channel: "", budget: "", cost: "", startDate: "", endDate: "", owner: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Marketing / Chiến dịch"
        description="Chiến dịch → Lead → Khách → Booking → Doanh thu. Theo dõi conversion & ROI."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo chiến dịch</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Kênh</TH><TH>Thời gian</TH><TH>Leads</TH><TH>Khách</TH>{canFinance && <TH className="text-right">Ngân sách</TH>}<TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có chiến dịch</TD></TR>
              ) : (
                rows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-mono font-medium"><Link href={`/marketing/${c.id}`} className="text-primary hover:underline">{c.code}</Link></TD>
                    <TD><Link href={`/marketing/${c.id}`} className="hover:underline">{c.name}</Link></TD>
                    <TD>{c.channel ?? "—"}</TD>
                    <TD className="text-xs">{c.startDate ? formatDate(c.startDate) : "—"} → {c.endDate ? formatDate(c.endDate) : "—"}</TD>
                    <TD>{c._count.leads}</TD>
                    <TD>{c._count.customers}</TD>
                    {canFinance && <TD className="text-right">{c.budget != null ? formatNumber(Number(c.budget)) + " ₫" : "—"}</TD>}
                    <TD><Badge tone={c.status === "ACTIVE" ? "success" : "muted"}>{c.status === "ACTIVE" ? "Đang chạy" : "Kết thúc"}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo chiến dịch">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Tên chiến dịch *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Kênh</Label><Input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder="Facebook, Google, Zalo..." /></div>
            <div className="space-y-1.5"><Label>Phụ trách</Label><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Bắt đầu</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Kết thúc</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Ngân sách (₫)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Chi phí (₫)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
