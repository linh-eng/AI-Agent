"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
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
  id: string; code: string; customerId?: string; scheduledAt: string; durationMinutes?: number | null;
  status: string; room?: string | null; bed?: string | null; machine?: string | null;
  technician?: string | null; master?: string | null; performer?: string | null;
  price?: string | number | null;
  customer: { code: string; fullName: string; phone?: string | null };
  service?: { name: string } | null;
}
interface Opt { id: string; code?: string; fullName?: string; name?: string }
interface Conflict { field: string; label: string; value: string; bookingCode: string; customerName: string; scheduledAt: string; durationMinutes: number }

const STATUS_FLOW = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"];
const VIEWS = [["list", "Danh sách"], ["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]] as const;
type View = (typeof VIEWS)[number][0];

// ---- date helpers ----
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const resourceLine = (b: Booking) => [b.technician && `KTV: ${b.technician}`, b.master && `Master: ${b.master}`, b.room && `Phòng: ${b.room}`, b.bed && `Giường: ${b.bed}`, b.machine && `Máy: ${b.machine}`].filter(Boolean).join(" · ");

export default function BookingsPage() {
  const canWrite = useCan(PERMISSIONS.BOOKING_WRITE);
  const [view, setView] = useState<View>("list");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);

  // Khoảng thời gian cho các chế độ lịch.
  const range = useMemo(() => {
    if (view === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (view === "week") { const m = mondayOf(anchor); return { from: m, to: addDays(m, 7) }; }
    if (view === "month") { const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const gridStart = mondayOf(first); return { from: gridStart, to: addDays(gridStart, 42) }; }
    return null;
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "list") {
        setRows(await apiFetch<Booking[]>(`/api/bookings${statusFilter ? `?status=${statusFilter}` : ""}`));
      } else if (range) {
        const q = `?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
        setRows(await apiFetch<Booking[]>(`/api/bookings${q}`));
      }
    } finally { setLoading(false); }
  }, [view, statusFilter, range]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<Opt[]>("/api/customers").then(setCustomers).catch(() => {});
    apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {});
  }, []);

  async function changeStatus(id: string, status: string) {
    await apiFetch(`/api/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }

  function shift(dir: number) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else if (view === "month") setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  const rangeTitle = useMemo(() => {
    if (view === "day") return anchor.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (view === "week") { const m = mondayOf(anchor); return `Tuần ${m.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${addDays(m, 6).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`; }
    if (view === "month") return anchor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
    return "";
  }, [view, anchor]);

  return (
    <div>
      <PageHeader
        title="Booking / Lịch hẹn"
        description="Đặt lịch dịch vụ theo kỹ thuật viên/master/phòng/giường/máy — tự cảnh báo trùng lịch."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo booking</Button>}
      />

      {/* Chuyển chế độ xem */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          {VIEWS.map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
        {view === "list" ? (
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Trạng thái</Label>
            <Select className="w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {STATUS_FLOW.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>Hôm nay</Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="ml-1 text-sm font-medium capitalize">{rangeTitle}</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : view === "list" ? (
        <ListView rows={rows} canWrite={canWrite} onStatus={changeStatus} />
      ) : view === "day" ? (
        <DayView rows={rows} day={anchor} />
      ) : view === "week" ? (
        <WeekView rows={rows} monday={mondayOf(anchor)} />
      ) : (
        <MonthView rows={rows} anchor={anchor} />
      )}

      <BookingFormModal
        open={open}
        onClose={() => setOpen(false)}
        customers={customers}
        services={services}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

// ---------- List ----------
function ListView({ rows, canWrite, onStatus }: { rows: Booking[]; canWrite: boolean; onStatus: (id: string, s: string) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR><TH>Mã</TH><TH>Thời gian</TH><TH>Khách</TH><TH>Dịch vụ</TH><TH>Tài nguyên</TH><TH className="text-right">Giá</TH><TH>Trạng thái</TH></TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có booking</TD></TR>
            ) : rows.map((b) => (
              <TR key={b.id}>
                <TD className="font-mono font-medium">{b.code}</TD>
                <TD>{new Date(b.scheduledAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</TD>
                <TD><Link href={`/customers/${b.customerId ?? ""}`} className="hover:underline">{b.customer.fullName}</Link><div className="text-xs text-muted-foreground">{b.customer.phone ?? b.customer.code}</div></TD>
                <TD>{b.service?.name ?? "—"}</TD>
                <TD className="text-xs">{resourceLine(b) || "—"}</TD>
                <TD className="text-right">{b.price ? formatNumber(Number(b.price)) + " ₫" : "—"}</TD>
                <TD>
                  {canWrite ? (
                    <Select className="h-8 w-40" value={b.status} onChange={(e) => onStatus(b.id, e.target.value)}>
                      {STATUS_FLOW.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
                    </Select>
                  ) : <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BookingChip({ b }: { b: Booking }) {
  return (
    <div className="rounded-md border-l-2 border-primary bg-primary/5 px-2 py-1 text-xs">
      <div className="font-medium">{hhmm(b.scheduledAt)} · {b.customer.fullName}</div>
      {b.service?.name && <div className="text-muted-foreground">{b.service.name}</div>}
      {resourceLine(b) && <div className="text-[11px] text-muted-foreground">{resourceLine(b)}</div>}
      <Badge tone={BOOKING_STATUS_TONE[b.status]} className="mt-0.5">{BOOKING_STATUS_LABEL[b.status]}</Badge>
    </div>
  );
}

// ---------- Day ----------
function DayView({ rows, day }: { rows: Booking[]; day: Date }) {
  const items = rows.filter((b) => sameDay(new Date(b.scheduledAt), day)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  return (
    <Card><CardContent className="space-y-2 p-4">
      {items.length === 0 ? <p className="py-8 text-center text-muted-foreground">Không có lịch hẹn trong ngày.</p> : items.map((b) => <BookingChip key={b.id} b={b} />)}
    </CardContent></Card>
  );
}

// ---------- Week ----------
function WeekView({ rows, monday }: { rows: Booking[]; monday: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const items = rows.filter((b) => sameDay(new Date(b.scheduledAt), d)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
        return (
          <Card key={d.toISOString()} className={sameDay(d, today) ? "ring-1 ring-primary" : ""}>
            <CardContent className="p-2">
              <div className="mb-1.5 text-center text-xs font-medium">{d.toLocaleDateString("vi-VN", { weekday: "short" })}<div className="text-muted-foreground">{d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</div></div>
              <div className="space-y-1.5">
                {items.length === 0 ? <div className="py-2 text-center text-[11px] text-muted-foreground/60">—</div> : items.map((b) => <BookingChip key={b.id} b={b} />)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Month ----------
function MonthView({ rows, anchor }: { rows: Booking[]; anchor: Date }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <Card><CardContent className="p-2">
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">{WD.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const items = rows.filter((b) => sameDay(new Date(b.scheduledAt), d)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <div key={d.toISOString()} className={`min-h-[84px] rounded-md border p-1 text-xs ${inMonth ? "" : "bg-muted/40 text-muted-foreground/60"} ${sameDay(d, today) ? "ring-1 ring-primary" : ""}`}>
              <div className="mb-0.5 text-right font-medium">{d.getDate()}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <div key={b.id} className="truncate rounded bg-primary/10 px-1 py-0.5 text-[11px]" title={`${hhmm(b.scheduledAt)} ${b.customer.fullName}${resourceLine(b) ? " · " + resourceLine(b) : ""}`}>
                    {hhmm(b.scheduledAt)} {b.customer.fullName}
                  </div>
                ))}
                {items.length > 3 && <div className="text-[11px] text-muted-foreground">+{items.length - 3} nữa</div>}
              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

// ---------- Create modal (with conflict warning) ----------
const EMPTY = { customerId: "", serviceId: "", scheduledAt: "", durationMinutes: "", technician: "", master: "", room: "", bed: "", machine: "", price: "", deposit: "", note: "" };

function BookingFormModal({ open, onClose, customers, services, onSaved }: { open: boolean; onClose: () => void; customers: Opt[]; services: Opt[]; onSaved: () => void }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm({ ...EMPTY }); setError(null); setConflicts(null); } }, [open]);

  async function submit(allowConflict: boolean) {
    setSaving(true); setError(null);
    const body: any = { ...form, allowConflict };
    ["serviceId", "durationMinutes", "technician", "master", "room", "bed", "machine", "price", "deposit", "note"].forEach((k) => { if (!body[k]) delete body[k]; });
    if (body.durationMinutes) body.durationMinutes = Number(body.durationMinutes);
    if (body.price) body.price = Number(body.price);
    if (body.deposit) body.deposit = Number(body.deposit);
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json?.details?.conflicts) { setConflicts(json.details.conflicts); setSaving(false); return; }
      if (!res.ok) throw new Error(json?.error ?? "Lỗi");
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo booking">
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Khách hàng *</Label>
          <Select value={form.customerId} onChange={(e) => { setForm({ ...form, customerId: e.target.value }); setConflicts(null); }} required>
            <option value="">— Chọn khách —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Dịch vụ</Label><Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}><option value="">—</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Thời gian *</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => { setForm({ ...form, scheduledAt: e.target.value }); setConflicts(null); }} required /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" placeholder="60" value={form.durationMinutes} onChange={(e) => { setForm({ ...form, durationMinutes: e.target.value }); setConflicts(null); }} /></div>
          <div className="space-y-1.5"><Label>Kỹ thuật viên</Label><Input value={form.technician} onChange={(e) => { setForm({ ...form, technician: e.target.value }); setConflicts(null); }} /></div>
          <div className="space-y-1.5"><Label>Master</Label><Input value={form.master} onChange={(e) => { setForm({ ...form, master: e.target.value }); setConflicts(null); }} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Phòng</Label><Input value={form.room} onChange={(e) => { setForm({ ...form, room: e.target.value }); setConflicts(null); }} /></div>
          <div className="space-y-1.5"><Label>Giường</Label><Input value={form.bed} onChange={(e) => { setForm({ ...form, bed: e.target.value }); setConflicts(null); }} /></div>
          <div className="space-y-1.5"><Label>Máy</Label><Input value={form.machine} onChange={(e) => { setForm({ ...form, machine: e.target.value }); setConflicts(null); }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Giá (bỏ trống = giá dịch vụ)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tiền cọc</Label><Input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>

        {conflicts && conflicts.length > 0 && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-700"><AlertTriangle className="h-4 w-4" /> Cảnh báo trùng lịch</div>
            <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
              {conflicts.map((c, i) => (
                <li key={i}>• <b>{c.label} "{c.value}"</b> đã bận: {c.bookingCode} — {c.customerName} lúc {new Date(c.scheduledAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} ({c.durationMinutes}′)</li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          {conflicts && conflicts.length > 0
            ? <Button type="button" variant="destructive" disabled={saving} onClick={() => submit(true)}>Vẫn đặt (bỏ qua cảnh báo)</Button>
            : <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>}
        </div>
      </form>
    </Modal>
  );
}
