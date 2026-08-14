"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Clock, X, SlidersHorizontal, ChevronDown, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate, formatDateTime } from "@/lib/utils";
import { VN_TZ, formatVnTime, parseVnLocal } from "@/lib/timezone";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "@/lib/clinic-labels";

interface Booking {
  id: string; code: string; customerId?: string; scheduledAt: string; durationMinutes?: number | null;
  status: string; room?: string | null; bed?: string | null; machine?: string | null;
  technician?: string | null; master?: string | null; assistants?: string[]; performer?: string | null;
  price?: string | number | null; note?: string | null;
  planId?: string | null; stageId?: string | null; sessionNumber?: number | null;
  customer: { code: string; fullName: string; phone?: string | null };
  service?: { name: string } | null;
}
interface Customer { id: string; code: string; fullName: string; phone?: string | null }
interface Service { id: string; name: string; durationMinutes?: number | null; standardPrice?: number | string }
interface Employee { id: string; fullName: string; roles: string[]; isActive?: boolean }
interface Resource { id: string; name: string; type: "ROOM" | "BED" | "MACHINE"; parentId?: string | null; isActive: boolean }
interface Conflict { field: string; label: string; value: string; bookingCode: string; customerName: string; scheduledAt: string; durationMinutes: number }
interface Slot { scheduledAt: string }

const STATUS_FLOW = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED", "CANCELLED", "NO_SHOW"];
const VIEWS = [["list", "Danh sách"], ["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]] as const;
type View = (typeof VIEWS)[number][0];

// ---- date helpers ----
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// Hiển thị giờ VN (Asia/Ho_Chi_Minh) — đồng nhất với formatDateTime, mọi màn giống nhau.
const VN = { timeZone: VN_TZ } as const;
const hhmm = (iso: string | Date) => formatVnTime(iso);
const endOf = (iso: string, dur?: number | null) => new Date(new Date(iso).getTime() + (dur ?? 60) * 60_000);
const timeRange = (b: Booking) => `${hhmm(b.scheduledAt)}–${hhmm(endOf(b.scheduledAt, b.durationMinutes))}`;
const resourceLine = (b: Booking) => [b.technician && `KTV: ${b.technician}`, b.master && `Master: ${b.master}`, b.room && `Phòng: ${b.room}`, b.bed && `Giường: ${b.bed}`, b.machine && `Máy: ${b.machine}`].filter(Boolean).join(" · ");

const EMPTY_FILTER = { serviceId: "", technician: "", room: "", machine: "", status: "" };

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsPageInner />
    </Suspense>
  );
}

function BookingsPageInner() {
  const canWrite = useCan(PERMISSIONS.BOOKING_WRITE);
  const canOverride = useCan(PERMISSIONS.BOOKING_OVERRIDE);
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ ...EMPTY_FILTER });
  const [showFilter, setShowFilter] = useState(false);
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  const [resourceMgr, setResourceMgr] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const loadResources = useCallback(() => { apiFetch<Resource[]>("/api/booking-resources?active=1").then(setResources).catch(() => {}); }, []);

  const range = useMemo(() => {
    if (view === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (view === "week") { const m = mondayOf(anchor); return { from: m, to: addDays(m, 7) }; }
    if (view === "month") { const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const gridStart = mondayOf(first); return { from: gridStart, to: addDays(gridStart, 42) }; }
    return null;
  }, [view, anchor]);

  const filterQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filter.serviceId) p.set("serviceId", filter.serviceId);
    if (filter.technician) p.set("technician", filter.technician);
    if (filter.room) p.set("room", filter.room);
    if (filter.machine) p.set("machine", filter.machine);
    if (filter.status) p.set("status", filter.status);
    return p;
  }, [filter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = filterQuery();
      if (view !== "list" && range) { p.set("from", range.from.toISOString()); p.set("to", range.to.toISOString()); }
      setRows(await apiFetch<Booking[]>(`/api/bookings?${p.toString()}`));
    } finally { setLoading(false); }
  }, [view, range, filterQuery]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<Customer[]>("/api/customers").then(setCustomers).catch(() => {});
    apiFetch<Service[]>("/api/services").then(setServices).catch(() => {});
    apiFetch<Employee[]>("/api/employees?active=1").then(setEmployees).catch(() => {});
    loadResources();
  }, [loadResources]);

  // Prefill từ "Tạo lịch hẹn" ở màn Phác đồ (mục 11): mở sẵn form + điền khách/dịch vụ/phác đồ/buổi.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const pf: Record<string, string> = {};
    ["customerId", "serviceId", "planId", "stageId", "sessionNumber", "sessionId"].forEach((k) => {
      const v = searchParams.get(k);
      if (v) pf[k] = v;
    });
    setPrefill(pf);
    setOpen(true);
    router.replace("/bookings"); // dọn query để không mở lại khi refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shift(dir: number) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else if (view === "month") setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  const rangeTitle = useMemo(() => {
    if (view === "day") return anchor.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", ...VN });
    if (view === "week") { const m = mondayOf(anchor); return `Tuần ${m.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", ...VN })} – ${addDays(m, 6).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", ...VN })}`; }
    if (view === "month") return anchor.toLocaleDateString("vi-VN", { month: "long", year: "numeric", ...VN });
    return "";
  }, [view, anchor]);

  const activeFilterCount = Object.values(filter).filter(Boolean).length;
  const technicians = useMemo(() => employees.filter((e) => e.roles?.some((r) => /kỹ thuật|master/i.test(r))), [employees]);

  return (
    <div>
      <PageHeader
        title="Lịch hẹn"
        description="Đặt lịch dịch vụ theo kỹ thuật viên/master/phòng/giường/máy — tự cảnh báo trùng tài nguyên & gợi ý giờ khác."
        action={canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResourceMgr(true)}><Settings2 className="h-4 w-4" /> Tài nguyên</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo lịch hẹn</Button>
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          {VIEWS.map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>Hôm nay</Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="ml-1 text-sm font-medium capitalize">{rangeTitle}</span>
          </div>
        )}
        <Button variant={activeFilterCount ? "default" : "outline"} size="sm" className="ml-auto" onClick={() => setShowFilter((s) => !s)}>
          <SlidersHorizontal className="h-4 w-4" /> Bộ lọc{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="mb-4"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5"><Label>Dịch vụ</Label><Select value={filter.serviceId} onChange={(e) => setFilter({ ...filter, serviceId: e.target.value })}><option value="">— Tất cả —</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Kỹ thuật viên</Label><Input value={filter.technician} onChange={(e) => setFilter({ ...filter, technician: e.target.value })} placeholder="Tên KTV..." /></div>
          <div className="space-y-1.5"><Label>Phòng</Label><Input value={filter.room} onChange={(e) => setFilter({ ...filter, room: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Máy</Label><Input value={filter.machine} onChange={(e) => setFilter({ ...filter, machine: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Trạng thái</Label><Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">— Tất cả —</option>{STATUS_FLOW.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}</Select></div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button size="sm" onClick={load}>Áp dụng</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFilter({ ...EMPTY_FILTER }); setTimeout(load, 0); }}><X className="h-4 w-4" /> Xóa lọc</Button>
          </div>
        </CardContent></Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : view === "list" ? (
        <ListView rows={rows} onOpen={setDetailId} />
      ) : view === "day" ? (
        <DayView rows={rows} day={anchor} employees={employees} onOpen={setDetailId} />
      ) : view === "week" ? (
        <WeekView rows={rows} monday={mondayOf(anchor)} onOpen={setDetailId} />
      ) : (
        <MonthView rows={rows} anchor={anchor} onOpenDay={(d) => { setAnchor(d); setView("day"); }} onOpen={setDetailId} />
      )}

      <BookingFormModal open={open} prefill={prefill} onClose={() => { setOpen(false); setPrefill(null); }} customers={customers} services={services} employees={employees} resources={resources} canOverride={canOverride} onSaved={() => { setOpen(false); setPrefill(null); load(); }} />
      {detailId && <BookingDetailModal id={detailId} onClose={() => setDetailId(null)} canWrite={canWrite} canOverride={canOverride} employees={employees} resources={resources} onChanged={load} />}
      {resourceMgr && <ResourceManagerModal resources={resources} onClose={() => setResourceMgr(false)} onChanged={loadResources} />}
    </div>
  );
}

/* ===================== Searchable / Multi selects ===================== */
function SearchableSelect({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <div className="flex h-9 cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-2 text-sm" onClick={() => setOpen((o) => !o)}>
        <span className={`flex-1 truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder || "— Chọn —"}</span>
        {value && <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg">
            <input autoFocus className="mb-1 w-full rounded border border-input bg-card px-2 py-1 text-sm" placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
            {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-muted-foreground">Không có trong danh mục</div> :
              filtered.map((o) => <button key={o} type="button" className={`block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted ${o === value ? "bg-primary/10 text-primary" : ""}`} onClick={() => { onChange(o); setOpen(false); setQ(""); }}>{o}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
function MultiSelect({ options, values, onChange, placeholder }: { options: string[]; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()) && !values.includes(o));
  return (
    <div className="relative">
      <div className="flex min-h-9 cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-sm" onClick={() => setOpen(true)}>
        {values.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{v}<button type="button" onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}><X className="h-3 w-3" /></button></span>)}
        {values.length === 0 && <span className="text-muted-foreground">{placeholder || "— Chọn —"}</span>}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg">
            <input autoFocus className="mb-1 w-full rounded border border-input bg-card px-2 py-1 text-sm" placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
            {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-muted-foreground">Không có</div> :
              filtered.map((o) => <button key={o} type="button" className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { onChange([...values, o]); setQ(""); }}>{o}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

/* Danh sách tùy chọn nhân sự/tài nguyên từ danh mục. */
function useResourceOptions(employees: Employee[], resources: Resource[]) {
  const techNames = employees.filter((e) => e.roles?.some((r) => /kỹ thuật/i.test(r))).map((e) => e.fullName);
  const masterNames = employees.filter((e) => e.roles?.some((r) => /master/i.test(r))).map((e) => e.fullName);
  const allNames = employees.map((e) => e.fullName);
  const rooms = resources.filter((r) => r.type === "ROOM");
  const beds = resources.filter((r) => r.type === "BED");
  const machines = resources.filter((r) => r.type === "MACHINE").map((r) => r.name);
  const roomNames = rooms.map((r) => r.name);
  return {
    technicians: techNames.length ? techNames : allNames,
    masters: masterNames.length ? masterNames : allNames,
    assistants: allNames,
    roomNames, machines,
    bedsFor: (roomName: string) => {
      if (!roomName) return beds.map((b) => b.name);
      const room = rooms.find((r) => r.name === roomName);
      const scoped = beds.filter((b) => b.parentId === room?.id);
      return (scoped.length ? scoped : beds).map((b) => b.name);
    },
  };
}

/* ===================== Resource manager ===================== */
function ResourceManagerModal({ resources, onClose, onChanged }: { resources: Resource[]; onClose: () => void; onChanged: () => void }) {
  const [type, setType] = useState<"ROOM" | "BED" | "MACHINE">("ROOM");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const rooms = resources.filter((r) => r.type === "ROOM");
  const TYPE_LABEL = { ROOM: "Phòng", BED: "Giường", MACHINE: "Máy/Thiết bị" } as const;

  async function add() {
    setErr(null);
    try {
      await apiFetch("/api/booking-resources", { method: "POST", body: JSON.stringify({ name, type, parentId: type === "BED" ? parentId || null : null }) });
      setName(""); setParentId(""); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function toggle(r: Resource) {
    try { await apiFetch(`/api/booking-resources/${r.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !r.isActive }) }); onChanged(); } catch { /* noop */ }
  }

  return (
    <Modal open onClose={onClose} title="Danh mục tài nguyên (Phòng / Giường / Máy)" className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-end gap-2">
          <div className="space-y-1"><Label>Loại</Label><Select value={type} onChange={(e) => setType(e.target.value as any)}><option value="ROOM">Phòng</option><option value="BED">Giường</option><option value="MACHINE">Máy/Thiết bị</option></Select></div>
          <div className="space-y-1"><Label>Tên</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phòng 4 / Giường C / Máy Laser 01" /></div>
          <Button type="button" disabled={!name.trim()} onClick={add}>Thêm</Button>
        </div>
        {type === "BED" && (
          <div className="space-y-1"><Label>Thuộc phòng (tùy chọn)</Label><Select value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">— Không gắn phòng —</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <THead><TR><TH>Loại</TH><TH>Tên</TH><TH>Thuộc phòng</TH><TH>Trạng thái</TH><TH></TH></TR></THead>
            <TBody>
              {resources.length === 0 ? <TR><TD colSpan={5} className="py-4 text-center text-muted-foreground">Chưa có tài nguyên</TD></TR> : resources.map((r) => (
                <TR key={r.id} className={r.isActive ? "" : "opacity-50"}>
                  <TD>{TYPE_LABEL[r.type]}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD>{r.parentId ? rooms.find((x) => x.id === r.parentId)?.name ?? "—" : "—"}</TD>
                  <TD>{r.isActive ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="muted">Ngưng</Badge>}</TD>
                  <TD className="text-right"><Button size="sm" variant="ghost" onClick={() => toggle(r)}>{r.isActive ? "Ngưng" : "Bật lại"}</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Đóng</Button></div>
      </div>
    </Modal>
  );
}

// ---------- List ----------
function ListView({ rows, onOpen }: { rows: Booking[]; onOpen: (id: string) => void }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Mã</TH><TH>Khung giờ</TH><TH>Khách</TH><TH>Dịch vụ</TH><TH>Tài nguyên</TH><TH className="text-right">Giá</TH><TH>Trạng thái</TH></TR></THead>
      <TBody>
        {rows.length === 0 ? (
          <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có lịch hẹn</TD></TR>
        ) : rows.map((b) => (
          <TR key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(b.id)}>
            <TD className="font-mono font-medium">{b.code}</TD>
            <TD><div>{formatDate(b.scheduledAt)}</div><div className="text-xs text-muted-foreground">{timeRange(b)}</div></TD>
            <TD>{b.customer.fullName}<div className="text-xs text-muted-foreground">{b.customer.phone ?? b.customer.code}</div></TD>
            <TD>{b.service?.name ?? "—"}</TD>
            <TD className="text-xs">{resourceLine(b) || "—"}</TD>
            <TD className="text-right">{b.price ? formatNumber(Number(b.price)) + " ₫" : "—"}</TD>
            <TD><Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge></TD>
          </TR>
        ))}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

function BookingChip({ b, onOpen }: { b: Booking; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(b.id)} className="w-full rounded-md border-l-2 border-primary bg-primary/5 px-2 py-1 text-left text-xs hover:bg-primary/10">
      <div className="font-medium">{timeRange(b)} · {b.customer.fullName}</div>
      {b.service?.name && <div className="text-muted-foreground">{b.service.name}</div>}
      {b.technician && <div className="text-[11px] text-muted-foreground">KTV: {b.technician}</div>}
      <Badge tone={BOOKING_STATUS_TONE[b.status]} className="mt-0.5">{BOOKING_STATUS_LABEL[b.status]}</Badge>
    </button>
  );
}

// ---------- Day (with capacity strip) ----------
const ACTIVE_STATUSES = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "RESCHEDULED"];
function DayView({ rows, day, employees, onOpen }: { rows: Booking[]; day: Date; employees: Employee[]; onOpen: (id: string) => void }) {
  const items = rows.filter((b) => sameDay(new Date(b.scheduledAt), day)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const active = items.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const busyTechs = new Set(active.map((b) => b.technician).filter(Boolean) as string[]);
  const busyRooms = new Set(active.map((b) => b.room).filter(Boolean) as string[]);
  const busyMachines = new Set(active.map((b) => b.machine).filter(Boolean) as string[]);
  const totalTechs = employees.filter((e) => e.roles?.some((r) => /kỹ thuật/i.test(r))).length;
  const freeTechs = Math.max(0, totalTechs - busyTechs.size);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Cap label="Tổng lịch hôm nay" value={String(items.length)} />
        <Cap label="KTV đang bận" value={String(busyTechs.size)} />
        <Cap label="KTV còn trống" value={totalTechs ? String(freeTechs) : "—"} tone={freeTechs === 0 && totalTechs > 0 ? "red" : "emerald"} />
        <Cap label="Máy đang dùng" value={String(busyMachines.size)} />
        <Cap label="Phòng đang dùng" value={String(busyRooms.size)} />
      </div>
      <Card><CardContent className="space-y-2 p-4">
        {items.length === 0 ? <p className="py-8 text-center text-muted-foreground">Không có lịch hẹn trong ngày.</p> : items.map((b) => <BookingChip key={b.id} b={b} onOpen={onOpen} />)}
      </CardContent></Card>
    </div>
  );
}
function Cap({ label, value, tone }: { label: string; value: string; tone?: "red" | "emerald" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "red" ? "text-red-600" : tone === "emerald" ? "text-emerald-600" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}

// ---------- Week ----------
function WeekView({ rows, monday, onOpen }: { rows: Booking[]; monday: Date; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const items = rows.filter((b) => sameDay(new Date(b.scheduledAt), d)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
        return (
          <Card key={d.toISOString()} className={sameDay(d, today) ? "ring-1 ring-primary" : ""}>
            <CardContent className="p-2">
              <div className="mb-1.5 text-center text-xs font-medium">{d.toLocaleDateString("vi-VN", { weekday: "short", ...VN })}<div className="text-muted-foreground">{d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", ...VN })}</div></div>
              <div className="space-y-1.5">
                {items.length === 0 ? <div className="py-2 text-center text-[11px] text-muted-foreground/60">—</div> : items.map((b) => <BookingChip key={b.id} b={b} onOpen={onOpen} />)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Month ----------
function MonthView({ rows, anchor, onOpenDay, onOpen }: { rows: Booking[]; anchor: Date; onOpenDay: (d: Date) => void; onOpen: (id: string) => void }) {
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
            <div key={d.toISOString()} className={`min-h-[92px] rounded-md border p-1 text-xs ${inMonth ? "" : "bg-muted/40 text-muted-foreground/60"} ${sameDay(d, today) ? "ring-1 ring-primary" : ""}`}>
              <button onClick={() => onOpenDay(d)} className="mb-0.5 block w-full text-right font-medium hover:text-primary">{d.getDate()}</button>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <button key={b.id} onClick={() => onOpen(b.id)} className="block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[11px] hover:bg-primary/20" title={`${timeRange(b)} ${b.customer.fullName}`}>
                    {hhmm(b.scheduledAt)} {b.customer.fullName}
                  </button>
                ))}
                {items.length > 3 && <button onClick={() => onOpenDay(d)} className="text-[11px] text-muted-foreground hover:text-primary">+{items.length - 3} nữa</button>}
              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

/* ===================== Conflict + suggestions block ===================== */
function ConflictBlock({ conflicts, suggestions, canOverride, overrideReason, setOverrideReason, onPickSlot, onOverride, saving }: {
  conflicts: Conflict[]; suggestions: Slot[]; canOverride: boolean;
  overrideReason: string; setOverrideReason: (v: string) => void;
  onPickSlot: (iso: string) => void; onOverride: () => void; saving: boolean;
}) {
  const today = new Date();
  const slotLabel = (iso: string) => {
    const d = new Date(iso);
    const rel = sameDay(d, today) ? "hôm nay" : sameDay(d, addDays(today, 1)) ? "ngày mai" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", ...VN });
    return `${hhmm(iso)} ${rel}`;
  };
  return (
    <div className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-700"><AlertTriangle className="h-4 w-4" /> Trùng tài nguyên</div>
      <ul className="space-y-1 text-xs text-amber-800">
        {conflicts.map((c, i) => (
          <li key={i}>• <b>{c.label} &quot;{c.value}&quot;</b> đang bận {hhmm(c.scheduledAt)}–{hhmm(endOf(c.scheduledAt, c.durationMinutes))} ({c.bookingCode} · {c.customerName})</li>
        ))}
      </ul>
      {suggestions.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-700"><Clock className="h-3.5 w-3.5" /> Khung giờ phù hợp gần nhất:</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.scheduledAt} type="button" onClick={() => onPickSlot(s.scheduledAt)} className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20">
                {slotLabel(s.scheduledAt)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-amber-500/30 pt-2">
        {canOverride ? (
          <div className="space-y-2">
            <Label className="text-xs">Lý do đặt đè (bắt buộc)</Label>
            <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="VD: khách VIP yêu cầu đúng khung giờ" />
            <Button type="button" variant="destructive" size="sm" disabled={saving || !overrideReason.trim()} onClick={onOverride}>Vẫn đặt (đè cảnh báo)</Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Bạn không có quyền đặt đè lịch trùng. Hãy chọn khung giờ khác hoặc đổi tài nguyên.</p>
        )}
      </div>
    </div>
  );
}

/* ===================== Create modal ===================== */
const EMPTY = { customerId: "", serviceId: "", scheduledAt: "", durationMinutes: "", technician: "", master: "", room: "", bed: "", machine: "", planId: "", stageId: "", sessionNumber: "", price: "", deposit: "", note: "" };

function BookingFormModal({ open, prefill, onClose, customers, services, employees, resources, canOverride, onSaved }: { open: boolean; prefill?: Record<string, string> | null; onClose: () => void; customers: Customer[]; services: Service[]; employees: Employee[]; resources: Resource[]; canOverride: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [assistants, setAssistants] = useState<string[]>([]);
  const [linkSessionId, setLinkSessionId] = useState<string | null>(null);
  const opts = useResourceOptions(employees, resources);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [suggestions, setSuggestions] = useState<Slot[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [floor, setFloor] = useState<any | null>(null);
  const [staffIssues, setStaffIssues] = useState<Array<{ name: string; reasons: string[]; resigned: boolean }> | null>(null);
  const [suggested, setSuggested] = useState<Array<{ id: string; code: string; fullName: string; roles: string[] }> | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const resetWarn = () => { setConflicts(null); setSuggestions([]); setFloor(null); setStaffIssues(null); setOverrideReason(""); };
  useEffect(() => {
    if (!open) return;
    setAssistants([]); setError(null); resetWarn(); setPlans([]); setStages([]);
    if (prefill && Object.keys(prefill).length) {
      // Prefill từ màn Phác đồ (mục 11) — điền sẵn khách/dịch vụ/phác đồ/giai đoạn/buổi.
      setForm({ ...EMPTY, customerId: prefill.customerId ?? "", serviceId: prefill.serviceId ?? "", planId: prefill.planId ?? "", stageId: prefill.stageId ?? "", sessionNumber: prefill.sessionNumber ?? "" });
      setLinkSessionId(prefill.sessionId ?? null);
      if (prefill.customerId) apiFetch<any[]>(`/api/treatment-plans?customerId=${prefill.customerId}`).then(setPlans).catch(() => {});
      if (prefill.planId) apiFetch<any>(`/api/treatment-plans/${prefill.planId}`).then((p) => setStages(p.stages ?? [])).catch(() => {});
      const svc = prefill.serviceId ? services.find((s) => s.id === prefill.serviceId) : null;
      if (svc?.durationMinutes) setForm((f) => ({ ...f, durationMinutes: String(svc.durationMinutes) }));
    } else {
      setForm({ ...EMPTY }); setLinkSessionId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setConflicts(null); setSuggestions([]); setStaffIssues(null); setSuggested(null); };

  // Gợi ý nhân sự ĐỦ NĂNG LỰC + rảnh cho dịch vụ/thời điểm đã chọn (mục 8.10–12).
  async function loadSuggest() {
    if (!form.serviceId || !form.scheduledAt) return;
    setLoadingSuggest(true); setSuggested(null);
    try {
      const at = parseVnLocal(form.scheduledAt).toISOString();
      const dur = Number(form.durationMinutes) || 60;
      const list = await apiFetch<Array<{ id: string; code: string; fullName: string; roles: string[] }>>(
        `/api/employees/suggest?serviceId=${form.serviceId}&at=${encodeURIComponent(at)}&duration=${dur}`
      );
      setSuggested(list);
    } catch { setSuggested([]); } finally { setLoadingSuggest(false); }
  }

  // Chọn khách → nạp phác đồ của khách.
  function onCustomer(id: string) {
    set({ customerId: id, planId: "", stageId: "", sessionNumber: "" });
    setPlans([]); setStages([]);
    if (id) apiFetch<any[]>(`/api/treatment-plans?customerId=${id}`).then(setPlans).catch(() => {});
  }
  // Chọn dịch vụ → tự lấy thời lượng chuẩn.
  function onService(id: string) {
    const svc = services.find((s) => s.id === id);
    set({ serviceId: id, durationMinutes: svc?.durationMinutes ? String(svc.durationMinutes) : form.durationMinutes });
    setFloor(null);
  }
  // Chọn phác đồ → nạp giai đoạn.
  function onPlan(id: string) {
    set({ planId: id, stageId: "" });
    setStages([]);
    if (id) apiFetch<any>(`/api/treatment-plans/${id}`).then((p) => setStages(p.stages ?? [])).catch(() => {});
  }

  const endPreview = useMemo(() => {
    if (!form.scheduledAt) return null;
    const dur = Number(form.durationMinutes) || 60;
    return new Date(new Date(form.scheduledAt).getTime() + dur * 60_000);
  }, [form.scheduledAt, form.durationMinutes]);

  function buildBody(extra: Record<string, unknown> = {}) {
    const body: any = { ...form, ...extra };
    body.assistants = assistants.length ? assistants : undefined;
    if (linkSessionId) body.sessionId = linkSessionId; // gắn ngược buổi dự kiến (mục 11–12)
    ["serviceId", "durationMinutes", "technician", "master", "room", "bed", "machine", "planId", "stageId", "sessionNumber", "price", "deposit", "note"].forEach((k) => { if (!body[k]) delete body[k]; });
    if (!body.assistants) delete body.assistants;
    ["durationMinutes", "sessionNumber", "price", "deposit"].forEach((k) => { if (body[k]) body[k] = Number(body[k]); });
    return body;
  }

  async function submit(opts: { allowConflict?: boolean; allowBelowFloor?: boolean } = {}) {
    setSaving(true); setError(null);
    const body = buildBody({ allowConflict: opts.allowConflict, allowBelowFloor: opts.allowBelowFloor, overrideReason: opts.allowConflict ? overrideReason : undefined });
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json?.details?.staffUnavailable) { setStaffIssues(json.details.staffUnavailable); setConflicts(null); setFloor(null); setSaving(false); return; }
      if (res.status === 409 && json?.details?.conflicts) { setConflicts(json.details.conflicts); setSuggestions(json.details.suggestions ?? []); setFloor(null); setStaffIssues(null); setSaving(false); return; }
      if (res.status === 409 && json?.details?.priceFloor) { setFloor(json.details.priceFloor); setConflicts(null); setStaffIssues(null); setSaving(false); return; }
      if (!res.ok) throw new Error(json?.error ?? "Lỗi");
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo lịch hẹn" className="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); submit({}); }} className="space-y-4">
        {linkSessionId && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            Đang tạo lịch hẹn cho một <b>buổi trong phác đồ</b> — đã điền sẵn khách/dịch vụ/phác đồ/giai đoạn/buổi. Chỉ cần chọn ngày giờ và nhân sự/tài nguyên.
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Khách hàng *</Label>
          <Select value={form.customerId} onChange={(e) => onCustomer(e.target.value)} required>
            <option value="">— Chọn khách —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Dịch vụ</Label><Select value={form.serviceId} onChange={(e) => onService(e.target.value)}><option value="">—</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.durationMinutes ? ` (${s.durationMinutes}′)` : ""}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Bắt đầu *</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} required /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" placeholder="60" value={form.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Giờ kết thúc dự kiến</Label><div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{form.scheduledAt ? `${hhmm(form.scheduledAt)} – ${endPreview ? hhmm(endPreview) : "—"}` : "— chọn giờ bắt đầu —"}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Kỹ thuật viên chính</Label><SearchableSelect options={opts.technicians} value={form.technician} onChange={(v) => set({ technician: v })} placeholder="Chọn KTV" /></div>
          <div className="space-y-1.5"><Label>Master</Label><SearchableSelect options={opts.masters} value={form.master} onChange={(v) => set({ master: v })} placeholder="Chọn Master" /></div>
          <div className="space-y-1.5"><Label>Nhân sự hỗ trợ</Label><MultiSelect options={opts.assistants} values={assistants} onChange={(v) => { setAssistants(v); setConflicts(null); }} placeholder="Chọn nhiều người" /></div>
        </div>
        {form.serviceId && form.scheduledAt && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Gợi ý nhân sự đủ năng lực &amp; rảnh cho dịch vụ này</span>
              <Button type="button" size="sm" variant="outline" disabled={loadingSuggest} onClick={loadSuggest}>{loadingSuggest ? "Đang tìm..." : "Gợi ý nhân sự"}</Button>
            </div>
            {suggested && (
              suggested.length === 0
                ? <p className="mt-2 text-xs text-muted-foreground">Không có nhân sự đủ năng lực &amp; rảnh ở khung giờ này.</p>
                : <div className="mt-2 flex flex-wrap gap-2">
                    {suggested.map((s) => (
                      <button type="button" key={s.id} onClick={() => set({ technician: s.fullName })}
                        className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10">
                        {s.fullName} <span className="opacity-60">({s.roles.join("/")})</span>
                      </button>
                    ))}
                  </div>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">Chỉ liệt kê người đang làm việc, đúng ca, không nghỉ phép, không trùng lịch và <b>đủ năng lực</b> dịch vụ. Bấm để chọn KTV.</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Phòng</Label><SearchableSelect options={opts.roomNames} value={form.room} onChange={(v) => set({ room: v, bed: "" })} placeholder="Chọn phòng" /></div>
          <div className="space-y-1.5"><Label>Giường</Label><SearchableSelect options={opts.bedsFor(form.room)} value={form.bed} onChange={(v) => set({ bed: v })} placeholder="Chọn giường" /></div>
          <div className="space-y-1.5"><Label>Máy / thiết bị</Label><SearchableSelect options={opts.machines} value={form.machine} onChange={(v) => set({ machine: v })} placeholder="Chọn máy" /></div>
        </div>
        {/* Liên kết phác đồ */}
        {form.customerId && plans.length > 0 && (
          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1.5"><Label>Phác đồ</Label><Select value={form.planId} onChange={(e) => onPlan(e.target.value)}><option value="">— Không —</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
            <div className="space-y-1.5"><Label>Giai đoạn</Label><Select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} disabled={!form.planId}><option value="">— Không —</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div className="space-y-1.5"><Label>Buổi số</Label><Input type="number" value={form.sessionNumber} onChange={(e) => setForm({ ...form, sessionNumber: e.target.value })} disabled={!form.planId} /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Giá (bỏ trống = giá dịch vụ)</Label><Input type="number" value={form.price} onChange={(e) => { set({ price: e.target.value }); setFloor(null); }} /></div>
          <div className="space-y-1.5"><Label>Tiền cọc</Label><Input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>

        {conflicts && conflicts.length > 0 && (
          <ConflictBlock conflicts={conflicts} suggestions={suggestions} canOverride={canOverride} overrideReason={overrideReason} setOverrideReason={setOverrideReason}
            onPickSlot={(iso) => { const local = new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); set({ scheduledAt: local }); }}
            onOverride={() => submit({ allowConflict: true })} saving={saving} />
        )}
        {floor && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Giá dưới giá sàn</div>
            <p className="mt-1 text-xs">Giá sàn dịch vụ là <b>{formatNumber(Number(floor.floorPrice))} ₫</b> (chi phí {formatNumber(Number(floor.totalCost))} ₫). Giá đang đặt thấp hơn {formatNumber(Number(floor.shortfall))} ₫.</p>
            <p className="mt-1 text-xs text-muted-foreground">{floor.reason}</p>
          </div>
        )}
        {staffIssues && staffIssues.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Nhân sự không khả dụng</div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {staffIssues.map((s, i) => (
                <li key={i}>• <b>{s.name}</b>: {s.reasons.join(", ")}{s.resigned && " (đã nghỉ việc — không thể phân công)"}</li>
              ))}
            </ul>
            {staffIssues.some((s) => s.resigned) ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Vui lòng chọn nhân sự khác hoặc đổi giờ.</p>
            ) : canOverride ? (
              <div className="mt-2 flex items-center gap-2">
                <Input className="h-8 flex-1" placeholder="Lý do đặt đè (bắt buộc)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                <Button type="button" size="sm" variant="destructive" disabled={saving || !overrideReason.trim()} onClick={() => submit({ allowConflict: true })}>Vẫn đặt (duyệt)</Button>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Cần người có quyền duyệt để đặt đè.</p>
            )}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          {floor ? (
            floor.canOverride
              ? <Button type="button" variant="destructive" disabled={saving} onClick={() => submit({ allowBelowFloor: true })}>Duyệt bán dưới sàn & lưu</Button>
              : <Button type="button" disabled>Cần người có quyền duyệt</Button>
          ) : (!conflicts || conflicts.length === 0) && (!staffIssues || staffIssues.length === 0) && (
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu lịch hẹn"}</Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* ===================== Detail modal ===================== */
function BookingDetailModal({ id, onClose, canWrite, canOverride, employees, resources, onChanged }: { id: string; onClose: () => void; canWrite: boolean; canOverride: boolean; employees: Employee[]; resources: Resource[]; onChanged: () => void }) {
  const [b, setB] = useState<any | null>(null);
  const [sub, setSub] = useState<null | "cancel" | "noshow" | "reschedule">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => { apiFetch<any>(`/api/bookings/${id}`).then(setB).catch(() => {}); }, [id]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(status: string, extra: { reason?: string } = {}) {
    setBusy(true); setErr(null);
    try {
      await apiFetch(`/api/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
      setSub(null); setReason(""); load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  if (!b) return <Modal open onClose={onClose} title="Chi tiết lịch hẹn"><p className="text-muted-foreground">Đang tải...</p></Modal>;

  const dur = b.durationMinutes ?? 60;
  const end = new Date(new Date(b.scheduledAt).getTime() + dur * 60000);
  const st = b.status as string;
  const history = Array.isArray(b.rescheduleHistory) ? b.rescheduleHistory : [];
  const overrides = Array.isArray(b.overrideLog) ? b.overrideLog : [];

  return (
    <Modal open onClose={onClose} title={`Lịch hẹn ${b.code}`} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2"><Badge tone={BOOKING_STATUS_TONE[st]}>{BOOKING_STATUS_LABEL[st]}</Badge><span className="text-xs text-muted-foreground">Tạo bởi {b.createdBy ?? "—"}</span></div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Khách hàng">
            <Field label="Họ tên" value={b.customer?.fullName} />
            <Field label="Điện thoại" value={b.customer?.phone ?? "—"} />
            <Field label="Mã khách" value={b.customer?.code} />
          </Section>
          <Section title="Dịch vụ">
            <Field label="Dịch vụ" value={b.service?.name ?? "—"} />
            <Field label="Phác đồ" value={b.plan ? b.plan.name : "—"} />
            <Field label="Buổi / giai đoạn" value={b.plan ? `${b.stage ? b.stage.name + " · " : ""}${b.sessionNumber ? "Buổi " + b.sessionNumber : ""}` || "—" : "—"} />
          </Section>
          <Section title="Thời gian">
            <Field label="Ngày" value={formatDate(b.scheduledAt)} />
            <Field label="Khung giờ" value={`${hhmm(b.scheduledAt)} – ${hhmm(end)}`} />
            <Field label="Thời lượng" value={`${dur} phút`} />
          </Section>
          <Section title="Nhân sự & tài nguyên">
            <Field label="KTV chính" value={b.technician ?? "—"} />
            <Field label="Master" value={b.master ?? "—"} />
            <Field label="Hỗ trợ" value={(b.assistants ?? []).join(", ") || "—"} />
            <Field label="Phòng / Giường / Máy" value={[b.room, b.bed, b.machine].filter(Boolean).join(" / ") || "—"} />
          </Section>
        </div>

        {b.note && <div className="rounded-md bg-muted/40 p-2 text-xs"><b>Ghi chú:</b> {b.note}</div>}
        {st === "CANCELLED" && <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">Đã hủy bởi {b.cancelledBy ?? "—"}{b.cancelReason ? ` · Lý do: ${b.cancelReason}` : ""}</div>}
        {st === "NO_SHOW" && <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">Không đến — ghi nhận bởi {b.noShowBy ?? "—"}{b.noShowReason ? ` · ${b.noShowReason}` : ""}</div>}

        {history.length > 0 && (
          <Section title="Lịch sử đổi lịch">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {history.map((h: any, i: number) => (
                <li key={i}>• {formatDateTime(h.from)} → {formatDateTime(h.to)} · {h.by}{h.reason ? ` · ${h.reason}` : ""}</li>
              ))}
            </ul>
          </Section>
        )}
        {overrides.length > 0 && (
          <Section title="Đặt đè cảnh báo">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {overrides.map((o: any, i: number) => <li key={i}>• {o.by} · {o.reason} <span className="opacity-70">({(o.conflicts ?? []).join("; ")})</span></li>)}
            </ul>
          </Section>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        {/* Quick actions */}
        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {(st === "NEW" || st === "PENDING") && <Button size="sm" disabled={busy} onClick={() => setStatus("CONFIRMED")}>Xác nhận</Button>}
            {st === "CONFIRMED" && <Button size="sm" disabled={busy} onClick={() => setStatus("ARRIVED")}>Khách đã đến</Button>}
            {st === "ARRIVED" && <Button size="sm" disabled={busy} onClick={() => setStatus("IN_PROGRESS")}>Bắt đầu thực hiện</Button>}
            {st === "IN_PROGRESS" && <Button size="sm" disabled={busy} onClick={() => setStatus("COMPLETED")}>Hoàn thành</Button>}
            {["NEW", "PENDING", "CONFIRMED", "ARRIVED"].includes(st) && <Button size="sm" variant="outline" disabled={busy} onClick={() => setSub("reschedule")}>Đổi lịch</Button>}
            {["CONFIRMED", "ARRIVED"].includes(st) && <Button size="sm" variant="outline" disabled={busy} onClick={() => setSub("noshow")}>Không đến</Button>}
            {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(st) && <Button size="sm" variant="destructive" disabled={busy} onClick={() => setSub("cancel")}>Hủy</Button>}
            {(st === "IN_PROGRESS" || st === "COMPLETED") && b.planId && <Link href={`/treatment-plans/${b.planId}`}><Button size="sm" variant="outline">Ghi nhận lần thực hiện</Button></Link>}
            <Link href={`/customers/${b.customer?.id ?? b.customerId}`}><Button size="sm" variant="ghost">Mở hồ sơ khách</Button></Link>
          </div>
        )}

        {sub === "cancel" && (
          <ReasonBox title="Lý do hủy lịch" placeholder="VD: khách báo bận" reason={reason} setReason={setReason} onCancel={() => setSub(null)} onConfirm={() => setStatus("CANCELLED", { reason })} busy={busy} confirmLabel="Xác nhận hủy" destructive />
        )}
        {sub === "noshow" && (
          <ReasonBox title="Ghi nhận khách không đến" placeholder="Lý do (nếu biết)" reason={reason} setReason={setReason} onCancel={() => setSub(null)} onConfirm={() => setStatus("NO_SHOW", { reason })} busy={busy} confirmLabel="Ghi nhận không đến" destructive />
        )}
        {sub === "reschedule" && (
          <RescheduleBox booking={b} employees={employees} resources={resources} canOverride={canOverride} onCancel={() => setSub(null)} onDone={() => { setSub(null); load(); onChanged(); }} />
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="space-y-0.5">{children}</div></div>;
}
function Field({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value || "—"}</span></div>;
}
function ReasonBox({ title, placeholder, reason, setReason, onCancel, onConfirm, busy, confirmLabel, destructive }: { title: string; placeholder: string; reason: string; setReason: (v: string) => void; onCancel: () => void; onConfirm: () => void; busy: boolean; confirmLabel: string; destructive?: boolean }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>{title}</Label>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Đóng</Button>
        <Button size="sm" variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  );
}

function RescheduleBox({ booking, employees, resources, canOverride, onCancel, onDone }: { booking: any; employees: Employee[]; resources: Resource[]; canOverride: boolean; onCancel: () => void; onDone: () => void }) {
  const opts = useResourceOptions(employees, resources);
  const toLocal = (iso: string) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState({
    scheduledAt: toLocal(booking.scheduledAt), durationMinutes: String(booking.durationMinutes ?? 60),
    technician: booking.technician ?? "", master: booking.master ?? "", room: booking.room ?? "", bed: booking.bed ?? "", machine: booking.machine ?? "", reason: "",
  });
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [suggestions, setSuggestions] = useState<Slot[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(allowConflict?: boolean) {
    setBusy(true); setErr(null);
    const body: any = { ...f, durationMinutes: Number(f.durationMinutes) || 60, allowConflict, overrideReason: allowConflict ? overrideReason : undefined };
    ["technician", "master", "room", "bed", "machine", "reason"].forEach((k) => { if (!body[k]) delete body[k]; });
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json?.details?.conflicts) { setConflicts(json.details.conflicts); setSuggestions(json.details.suggestions ?? []); setBusy(false); return; }
      if (!res.ok) throw new Error(json?.error ?? "Lỗi");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="text-sm font-medium">Đổi lịch (giữ lịch cũ, ghi lịch sử)</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Giờ mới *</Label><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => { setF({ ...f, scheduledAt: e.target.value }); setConflicts(null); }} /></div>
        <div className="space-y-1"><Label>Thời lượng (phút)</Label><Input type="number" value={f.durationMinutes} onChange={(e) => { setF({ ...f, durationMinutes: e.target.value }); setConflicts(null); }} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label>KTV</Label><SearchableSelect options={opts.technicians} value={f.technician} onChange={(v) => { setF({ ...f, technician: v }); setConflicts(null); }} placeholder="Chọn KTV" /></div>
        <div className="space-y-1"><Label>Phòng</Label><SearchableSelect options={opts.roomNames} value={f.room} onChange={(v) => { setF({ ...f, room: v, bed: "" }); setConflicts(null); }} placeholder="Chọn phòng" /></div>
        <div className="space-y-1"><Label>Máy</Label><SearchableSelect options={opts.machines} value={f.machine} onChange={(v) => { setF({ ...f, machine: v }); setConflicts(null); }} placeholder="Chọn máy" /></div>
      </div>
      <div className="space-y-1"><Label>Lý do đổi lịch *</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Bắt buộc nhập lý do" /></div>
      {conflicts && conflicts.length > 0 && (
        <ConflictBlock conflicts={conflicts} suggestions={suggestions} canOverride={canOverride} overrideReason={overrideReason} setOverrideReason={setOverrideReason}
          onPickSlot={(iso) => { setF({ ...f, scheduledAt: toLocal(iso) }); setConflicts(null); }} onOverride={() => submit(true)} saving={busy} />
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Đóng</Button>
        {(!conflicts || conflicts.length === 0) && <Button size="sm" disabled={busy || !f.reason.trim()} onClick={() => submit()}>Lưu đổi lịch</Button>}
      </div>
    </div>
  );
}
