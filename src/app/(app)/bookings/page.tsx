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
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "@/lib/clinic-labels";

interface Booking {
  id: string;
  code: string;
  scheduledAt: string;
  status: string;
  room?: string | null;
  performer?: string | null;
  price?: string | number | null;
  customer: { code: string; fullName: string; phone?: string | null };
  service?: { name: string } | null;
}
interface Opt { id: string; code?: string; fullName?: string; name?: string }

const STATUS_FLOW = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"];

export default function BookingsPage() {
  const canWrite = useCan(PERMISSIONS.BOOKING_WRITE);
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);
  const [form, setForm] = useState({ customerId: "", serviceId: "", scheduledAt: "", durationMinutes: "", room: "", performer: "", price: "", deposit: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Booking[]>(`/api/bookings${statusFilter ? `?status=${statusFilter}` : ""}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);
  useEffect(() => {
    apiFetch<Opt[]>("/api/customers").then(setCustomers).catch(() => {});
    apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      ["serviceId", "durationMinutes", "room", "performer", "price", "deposit", "note"].forEach((k) => { if (!body[k]) delete body[k]; });
      if (body.durationMinutes) body.durationMinutes = Number(body.durationMinutes);
      if (body.price) body.price = Number(body.price);
      if (body.deposit) body.deposit = Number(body.deposit);
      await apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ customerId: "", serviceId: "", scheduledAt: "", durationMinutes: "", room: "", performer: "", price: "", deposit: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function changeStatus(id: string, status: string) {
    await apiFetch(`/api/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }

  return (
    <div>
      <PageHeader
        title="Booking"
        description="Đặt lịch dịch vụ — theo dõi vòng đời từ Mới đến Hoàn thành."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo booking</Button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-muted-foreground">Trạng thái</Label>
        <Select className="w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Thời gian</TH><TH>Khách</TH><TH>Dịch vụ</TH><TH>Phòng/NV</TH><TH className="text-right">Giá</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có booking</TD></TR>
              ) : (
                rows.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-mono font-medium">{b.code}</TD>
                    <TD>{new Date(b.scheduledAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</TD>
                    <TD>
                      <Link href={`/customers/${(b as any).customerId ?? ""}`} className="hover:underline">{b.customer.fullName}</Link>
                      <div className="text-xs text-muted-foreground">{b.customer.phone ?? b.customer.code}</div>
                    </TD>
                    <TD>{b.service?.name ?? "—"}</TD>
                    <TD>{[b.room, b.performer].filter(Boolean).join(" · ") || "—"}</TD>
                    <TD className="text-right">{b.price ? formatNumber(Number(b.price)) + " ₫" : "—"}</TD>
                    <TD>
                      {canWrite ? (
                        <Select className="h-8 w-40" value={b.status} onChange={(e) => changeStatus(b.id, e.target.value)}>
                          {STATUS_FLOW.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
                        </Select>
                      ) : (
                        <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo booking">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Khách hàng *</Label>
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
              <option value="">— Chọn khách —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dịch vụ</Label>
              <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                <option value="">—</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Thời gian *</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phòng</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Người thực hiện</Label><Input value={form.performer} onChange={(e) => setForm({ ...form, performer: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Giá (bỏ trống = giá dịch vụ)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tiền cọc</Label><Input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
