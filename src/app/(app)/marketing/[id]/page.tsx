"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/clinic-labels";

const LEAD_STATUSES = ["NEW", "CONTACTED", "BOOKED", "WON", "LOST"];

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className={`text-xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.MARKETING_WRITE);
  const [c, setC] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "", channel: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/marketing-campaigns/${id}`);
      setC(data);
      setLeads(await apiFetch<any[]>(`/api/leads?campaignId=${id}`).catch(() => []));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/leads", { method: "POST", body: JSON.stringify({ ...form, campaignId: id }) });
      setOpen(false); setForm({ name: "", phone: "", email: "", source: "", channel: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function setLeadStatus(leadId: string, status: string) {
    await apiFetch(`/api/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }
  async function convert(leadId: string) {
    const r = await apiFetch<{ customerId: string }>(`/api/leads/${leadId}/convert`, { method: "POST", body: "{}" }).catch((e) => { setError(e.message); return null; });
    if (r) window.location.href = `/customers/${r.customerId}`;
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!c) return <p className="text-destructive">Không tìm thấy chiến dịch.</p>;
  const m = c.metrics;

  return (
    <div>
      <Link href="/marketing" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Chiến dịch
      </Link>
      <PageHeader
        title={c.name}
        description={`${c.code}${c.channel ? " · " + c.channel : ""}`}
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm lead</Button>}
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Leads" value={formatNumber(m.leads)} />
        <Stat label="Khách acquired" value={formatNumber(m.customers)} tone="text-emerald-600" />
        <Stat label="Booking" value={formatNumber(m.bookings)} />
        <Stat label="Hoàn thành" value={formatNumber(m.completedBookings)} />
        <Stat label="Conversion" value={`${(m.conversionRate * 100).toFixed(0)}%`} />
        {c.canSeeFinance && <Stat label="Doanh thu" value={formatNumber(m.revenue) + " ₫"} tone="text-emerald-600" />}
        {c.canSeeFinance && <Stat label="Chi phí" value={formatNumber(m.cost) + " ₫"} tone="text-amber-600" />}
        {c.canSeeFinance && <Stat label="ROI" value={m.roi != null ? `${(m.roi * 100).toFixed(0)}%` : "—"} tone={m.roi != null && m.roi >= 0 ? "text-emerald-600" : "text-red-600"} />}
      </div>
      {c.canSeeFinance && (
        <p className="mb-4 text-xs text-muted-foreground">
          Chi phí/Lead: {m.costPerLead != null ? formatNumber(Math.round(m.costPerLead)) + " ₫" : "—"} ·
          Chi phí/Khách: {m.costPerCustomer != null ? formatNumber(Math.round(m.costPerCustomer)) + " ₫" : "—"}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Điện thoại</TH><TH>Nguồn</TH><TH>Trạng thái</TH>{canWrite && <TH></TH>}</TR>
            </THead>
            <TBody>
              {leads.length === 0 ? (
                <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">Chưa có lead</TD></TR>
              ) : (
                leads.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-mono">{l.code}</TD>
                    <TD className="font-medium">{l.convertedCustomerId ? <Link href={`/customers/${l.convertedCustomerId}`} className="text-primary hover:underline">{l.name}</Link> : l.name}</TD>
                    <TD>{l.phone ?? "—"}</TD>
                    <TD>{l.source ?? "—"}</TD>
                    <TD>
                      {canWrite && l.status !== "WON" ? (
                        <Select className="h-8 w-32" value={l.status} onChange={(e) => setLeadStatus(l.id, e.target.value)}>
                          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
                        </Select>
                      ) : <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>}
                    </TD>
                    {canWrite && <TD>{l.status !== "WON" && <Button size="sm" variant="outline" onClick={() => convert(l.id)}><UserCheck className="h-3.5 w-3.5" /> Chuyển đổi</Button>}</TD>}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm lead">
        <form onSubmit={addLead} className="space-y-4">
          <div className="space-y-1.5"><Label>Tên *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Điện thoại</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nguồn</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Kênh</Label><Input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
