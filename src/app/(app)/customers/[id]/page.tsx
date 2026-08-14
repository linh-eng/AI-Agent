"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Plus, Phone, Mail, MapPin, User, ArrowLeft, ChevronDown, CalendarPlus, MessageSquarePlus,
  FileText, BellRing, Star, Wallet, TrendingUp, Activity, Images, Package,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime, formatCurrency, computeAge, mediaSrc } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  GENDER_LABEL, BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, PLAN_STATUS_LABEL, PLAN_STATUS_TONE,
  SESSION_STATUS_LABEL, SESSION_STATUS_TONE, CRM_TYPE_LABEL, PAYMENT_METHOD_LABEL,
  TIMELINE_KIND_LABEL, TIMELINE_KIND_TONE, RECOMMENDATION_PRIORITY_LABEL, RECOMMENDATION_PRIORITY_TONE,
  CARE_KIND_LABEL, CARE_KIND_TONE, DELIVERY_CHANNEL_LABEL, INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE,
  PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE, TASK_STATUS_LABEL, statusLabel,
  DEPOSIT_STATUS_LABEL, DEPOSIT_STATUS_TONE,
} from "@/lib/clinic-labels";

/* ============================ Types ============================ */
interface Summary {
  totalSessions: number; totalBookings: number;
  nextBooking: { id: string; code: string; scheduledAt: string; serviceName: string | null; technician: string | null; status: string } | null;
  nextFollowUp: { id: string; title: string; dueDate: string | null; assignee: string | null } | null;
  pendingCareTasks: number;
  activePlan: { id: string; code: string; name: string; version: number; status: string; totalSessions: number; doneSessions: number; nextSessionAt: string | null; currentStage: string | null } | null;
  lastSession: { id: string; at: string | null; serviceName: string | null; technician: string | null; planName: string | null } | null;
  lastService: string | null; lastTechnician: string | null;
  lastReview: { at: string; satisfactionScore: number | null; technicianScore: number | null } | null;
}
interface Customer {
  id: string; code: string; fullName: string;
  gender?: string | null; dob?: string | null; phone?: string | null; email?: string | null;
  address?: string | null; source?: string | null; group?: string | null; assignedTo?: string | null;
  goals?: string | null; note?: string | null; legacyId?: string | null; legacySource?: string | null;
  isActive?: boolean;
  financials: { totalPaid: number; totalBilled: number; debt: number };
  summary: Summary;
  timeline: { id: string; at: string; kind: string; title: string; detail?: string; status?: string; href?: string }[];
  bookings: any[]; assessments: any[]; plans: any[]; sessions: any[]; proposals: any[];
  payments: any[]; activities: any[]; tasks: any[]; deposits?: any[];
  canSeeFinance: boolean;
}

/* ====================== Tab configuration ====================== */
const TABS = [
  "overview", "timeline", "visits", "plans", "reviews", "recommendations",
  "materials", "care", "proposals", "billing", "forms",
] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Tổng quan",
  timeline: "Timeline",
  visits: "Booking & Lần thực hiện",
  plans: "Phác đồ",
  reviews: "Đánh giá & Before/After",
  recommendations: "Sản phẩm đề xuất",
  materials: "Vật tư khách hàng",
  care: "Chăm sóc khách hàng",
  proposals: "Báo giá",
  billing: "Hóa đơn & Thanh toán",
  forms: "Biểu mẫu & Tài liệu",
};

/* ============================ Page ============================ */
export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const canCrm = useCan(PERMISSIONS.CRM_WRITE);
  const canPay = useCan(PERMISSIONS.PAYMENT_WRITE);
  const canTreat = useCan(PERMISSIONS.TREATMENT_WRITE);
  const canRecommend = useCan(PERMISSIONS.RECOMMEND_WRITE);
  const canCare = useCan(PERMISSIONS.CARE_WRITE);
  const canBook = useCan(PERMISSIONS.BOOKING_WRITE);
  const canProposal = useCan(PERMISSIONS.PROPOSAL_WRITE);
  const canTask = useCan(PERMISSIONS.TASK_WRITE);
  const canCustomerWrite = useCan(PERMISSIONS.CUSTOMER_WRITE);

  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<null | "crm" | "payment" | "assessment" | "recommend" | "applyForm" | "care" | "portal" | "booking" | "followup">(null);
  const [error, setError] = useState<string | null>(null);

  // Dữ liệu phụ (tải lười theo tab / dùng cho Tổng quan)
  const [recs, setRecs] = useState<any[] | null>(null);
  const [beforeAfter, setBeforeAfter] = useState<any[] | null>(null);
  const [custMaterials, setCustMaterials] = useState<any[] | null>(null);
  const [forms, setForms] = useState<any[] | null>(null);
  const [careItems, setCareItems] = useState<any[] | null>(null);
  const [invoices, setInvoices] = useState<any[] | null>(null);
  // Danh mục cho modal
  const [spaProducts, setSpaProducts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [careTemplates, setCareTemplates] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setC(await apiFetch<Customer>(`/api/customers/${id}`)); }
    finally { setLoading(false); }
  }, [id]);

  // Tổng quan cần: đề xuất SP gần nhất + Before/After gần nhất
  useEffect(() => {
    load();
    apiFetch<any[]>(`/api/product-recommendations?customerId=${id}`).then(setRecs).catch(() => setRecs([]));
    apiFetch<any[]>(`/api/before-after?customerId=${id}`).then(setBeforeAfter).catch(() => setBeforeAfter([]));
  }, [id, load]);

  // Danh mục cho các modal (một lần)
  useEffect(() => {
    apiFetch<any[]>("/api/spa-products").then(setSpaProducts).catch(() => {});
    apiFetch<any[]>("/api/form-templates").then(setTemplates).catch(() => {});
    apiFetch<any[]>("/api/care-instructions").then(setCareTemplates).catch(() => {});
    apiFetch<any[]>("/api/services").then(setServices).catch(() => {});
  }, []);

  // Tải lười theo tab
  useEffect(() => {
    if (tab === "materials" && custMaterials === null) apiFetch<any[]>(`/api/customer-materials?customerId=${id}`).then(setCustMaterials).catch(() => setCustMaterials([]));
    if (tab === "forms" && forms === null) apiFetch<any[]>(`/api/form-instances?customerId=${id}`).then(setForms).catch(() => setForms([]));
    if (tab === "care" && careItems === null) apiFetch<any[]>(`/api/care-instances?customerId=${id}`).then(setCareItems).catch(() => setCareItems([]));
    if (tab === "billing" && invoices === null) apiFetch<any[]>(`/api/invoices?customerId=${id}`).then(setInvoices).catch(() => setInvoices([]));
  }, [tab, id, custMaterials, forms, careItems, invoices]);

  function reloadAfterWrite() {
    load();
    setRecs(null); apiFetch<any[]>(`/api/product-recommendations?customerId=${id}`).then(setRecs).catch(() => {});
    setCareItems(null); setForms(null); setInvoices(null); setCustMaterials(null);
    apiFetch<any[]>(`/api/before-after?customerId=${id}`).then(setBeforeAfter).catch(() => {});
  }

  async function submit(url: string, body: unknown) {
    setError(null);
    try {
      await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      reloadAfterWrite();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!c) return <p className="text-destructive">Không tìm thấy khách hàng.</p>;

  const age = computeAge(c.dob);
  const s = c.summary;

  return (
    <div>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách khách hàng
      </Link>

      {/* ---------- HEADER ---------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{c.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{c.code}</span>
            {c.group && <Badge tone="muted">{c.group}</Badge>}
            {c.isActive === false && <Badge tone="muted">Đã lưu trữ</Badge>}
            {c.legacySource && <span className="text-xs">Nguồn cũ: {c.legacySource}{c.legacyId ? ` · ${c.legacyId}` : ""}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <HeaderField icon={User} value={c.gender ? GENDER_LABEL[c.gender] : "—"} />
            <HeaderField icon={User} value={c.dob ? `${formatDate(c.dob)}${age != null ? ` · ${age} tuổi` : ""}` : "Chưa có ngày sinh"} />
            <HeaderField icon={Phone} value={c.phone ?? "—"} />
            {c.email && <HeaderField icon={Mail} value={c.email} />}
            <HeaderField icon={MapPin} value={`Nguồn: ${c.source ?? "—"}`} />
            <HeaderField icon={User} value={`Phụ trách: ${c.assignedTo ?? "—"}`} />
          </div>
        </div>
        {/* Quick actions */}
        <QuickActions
          canBook={canBook} canCrm={canCrm} canProposal={canProposal} canTask={canTask}
          canTreat={canTreat} canRecommend={canRecommend} canCare={canCare} canPay={canPay}
          canCustomerWrite={canCustomerWrite}
          customerId={id} activePlanId={s.activePlan?.id ?? null}
          onOpen={(m) => setModal(m)}
        />
      </div>

      {/* ---------- KPI ROW ---------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTwo icon={Activity} label="Lịch sử dịch vụ" lines={[["Lần thực hiện", String(s.totalSessions)], ["Booking", String(s.totalBookings)]]} />
        <Kpi icon={TrendingUp} label="Tổng giá trị" value={formatCurrency(c.financials.totalBilled)} />
        <Kpi icon={Wallet} label="Đã thanh toán" value={formatCurrency(c.financials.totalPaid)} tone="emerald" />
        <Kpi icon={Wallet} label="Công nợ" value={formatCurrency(c.financials.debt)} tone={c.financials.debt > 0 ? "red" : "emerald"} />
        <Kpi icon={CalendarPlus} label="Booking tiếp theo" value={s.nextBooking ? formatDateTime(s.nextBooking.scheduledAt) : "—"} sub={s.nextBooking?.serviceName ?? undefined} />
        <Kpi icon={BellRing} label="Follow-up tiếp theo" value={s.nextFollowUp?.dueDate ? formatDate(s.nextFollowUp.dueDate) : "—"} sub={s.nextFollowUp?.title} />
        <Kpi icon={FileText} label="Phác đồ đang thực hiện" value={s.activePlan ? s.activePlan.name : "—"} sub={s.activePlan ? `${s.activePlan.doneSessions}/${s.activePlan.totalSessions} buổi` : undefined} />
        <Kpi icon={User} label="KTV gần nhất" value={s.lastTechnician ?? "—"} sub={s.lastService ?? undefined} />
      </div>

      {/* ---------- TABS ---------- */}
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab c={c} recs={recs} beforeAfter={beforeAfter} onOpenImage={setLightbox} onGoTab={setTab} />}
      {tab === "timeline" && <TimelineTab timeline={c.timeline} />}
      {tab === "visits" && <VisitsTab bookings={c.bookings} sessions={c.sessions} />}
      {tab === "plans" && <PlansTab plans={c.plans} />}
      {tab === "reviews" && <ReviewsTab sessions={c.sessions} beforeAfter={beforeAfter} services={services} onOpenImage={setLightbox} />}
      {tab === "recommendations" && <RecommendationsTab recs={recs} />}
      {tab === "materials" && <MaterialsTab materials={custMaterials} />}
      {tab === "care" && <CareTab activities={c.activities} tasks={c.tasks} careItems={careItems} />}
      {tab === "proposals" && <ProposalsTab proposals={c.proposals} />}
      {tab === "billing" && <BillingTab invoices={invoices} payments={c.payments} deposits={c.deposits ?? []} financials={c.financials} />}
      {tab === "forms" && <FormsTab forms={forms} />}

      {/* ---------- Modals ---------- */}
      <CrmModal open={modal === "crm"} onClose={() => setModal(null)} error={error} onSubmit={(body) => submit("/api/crm-activities", { ...body, customerId: id })} />
      <PaymentModal open={modal === "payment"} onClose={() => setModal(null)} error={error} debt={c.financials.debt} onSubmit={(body) => submit("/api/payments", { ...body, customerId: id })} />
      <AssessmentModal open={modal === "assessment"} onClose={() => setModal(null)} error={error} onSubmit={(body) => submit("/api/assessments", { ...body, customerId: id })} />
      <RecommendModal open={modal === "recommend"} onClose={() => setModal(null)} error={error} products={spaProducts} onSubmit={(body) => submit("/api/product-recommendations", { ...body, customerId: id })} />
      <ApplyFormModal open={modal === "applyForm"} onClose={() => setModal(null)} error={error} templates={templates} onSubmit={(body) => submit("/api/form-instances", { ...body, customerId: id })} />
      <SendCareModal open={modal === "care"} onClose={() => setModal(null)} error={error} templates={careTemplates} onSubmit={(body) => submit("/api/care-instances", { ...body, customerId: id })} />
      <FollowUpModal open={modal === "followup"} onClose={() => setModal(null)} error={error} onSubmit={(body) => submit("/api/tasks", { ...body, customerId: id })} />
      <BookingModal open={modal === "booking"} onClose={() => setModal(null)} customerId={id} services={services} onDone={() => { setModal(null); reloadAfterWrite(); }} />
      <PortalAccountModal open={modal === "portal"} onClose={() => setModal(null)} customerId={id} defaultEmail={c.email ?? ""} />

      {lightbox && (
        <Modal open onClose={() => setLightbox(null)} title="Ảnh" className="max-w-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(lightbox)} alt="Ảnh Before/After" className="mx-auto max-h-[70vh] rounded" />
        </Modal>
      )}
    </div>
  );
}

/* ====================== Header / KPI bits ====================== */
function HeaderField({ icon: Icon, value }: { icon: any; value: string }) {
  return <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5 text-muted-foreground" /> {value}</span>;
}
function KpiTwo({ icon: Icon, label, lines }: { icon: any; label: string; lines: [string, string][] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className="mt-1.5 space-y-0.5">
          {lines.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="text-lg font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "emerald" | "red" }) {
  const valueColor = tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className={`mt-1 truncate text-lg font-semibold ${valueColor}`} title={value}>{value}</div>
        {sub && <div className="truncate text-xs text-muted-foreground" title={sub}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ====================== Quick actions ====================== */
function QuickActions(props: {
  canBook: boolean; canCrm: boolean; canProposal: boolean; canTask: boolean;
  canTreat: boolean; canRecommend: boolean; canCare: boolean; canPay: boolean; canCustomerWrite: boolean;
  customerId: string; activePlanId: string | null; onOpen: (m: any) => void;
}) {
  const [menu, setMenu] = useState(false);
  const more = [
    props.canTreat && { key: "assessment", label: "Đánh giá", onClick: () => props.onOpen("assessment") },
    props.canRecommend && { key: "recommend", label: "Đề xuất sản phẩm", onClick: () => props.onOpen("recommend") },
    props.canCare && { key: "care", label: "Gửi hướng dẫn", onClick: () => props.onOpen("care") },
    props.activePlanId && { key: "ba", label: "Thêm Before/After", href: `/treatment-plans/${props.activePlanId}` },
    props.canTreat && { key: "applyForm", label: "Áp biểu mẫu", onClick: () => props.onOpen("applyForm") },
    props.canPay && { key: "payment", label: "Ghi nhận thanh toán", onClick: () => props.onOpen("payment") },
    props.canCustomerWrite && { key: "portal", label: "Cấp tài khoản Cổng khách", onClick: () => props.onOpen("portal") },
  ].filter(Boolean) as { key: string; label: string; onClick?: () => void; href?: string }[];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.canBook && <Button onClick={() => props.onOpen("booking")}><CalendarPlus className="h-4 w-4" /> Tạo Booking</Button>}
      {props.canCrm && <Button variant="outline" onClick={() => props.onOpen("crm")}><MessageSquarePlus className="h-4 w-4" /> Nhật ký CSKH</Button>}
      {props.canProposal && <Link href={`/proposals?customerId=${props.customerId}&new=1`}><Button variant="outline"><FileText className="h-4 w-4" /> Báo giá</Button></Link>}
      {props.canTask && <Button variant="outline" onClick={() => props.onOpen("followup")}><BellRing className="h-4 w-4" /> Follow-up</Button>}
      {more.length > 0 && (
        <div className="relative">
          <Button variant="outline" onClick={() => setMenu((m) => !m)}>Thêm thao tác <ChevronDown className="h-4 w-4" /></Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-card p-1 shadow-lg">
                {more.map((it) => it.href ? (
                  <Link key={it.key} href={it.href} className="block rounded px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenu(false)}>{it.label}</Link>
                ) : (
                  <button key={it.key} onClick={() => { setMenu(false); it.onClick?.(); }} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted">{it.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ Tabs ============================ */
function SubTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-3 flex gap-1">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`rounded-full px-3 py-1 text-sm font-medium ${active === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Stars({ score }: { score: number | null | undefined }) {
  if (!score) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${score}/5`}>
      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < score ? "fill-current" : "text-muted-foreground/30"}`} />)}
    </span>
  );
}

/* ---- Overview ---- */
function OverviewTab({ c, recs, beforeAfter, onOpenImage, onGoTab }: { c: Customer; recs: any[] | null; beforeAfter: any[] | null; onOpenImage: (id: string) => void; onGoTab: (t: Tab) => void }) {
  const s = c.summary;
  const latestBA = (beforeAfter ?? []).slice(0, 1);
  const latestRecs = (recs ?? []).slice(0, 3);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Thông tin hiện tại">
        <Row label="Tình trạng khách" value={c.isActive === false ? "Đã lưu trữ" : "Đang hoạt động"} />
        <Row label="Mục tiêu / mong muốn" value={c.goals ?? "—"} />
        <Row label="Phác đồ đang thực hiện" value={s.activePlan ? `${s.activePlan.name} (v${s.activePlan.version})` : "—"} />
        <Row label="Giai đoạn hiện tại" value={s.activePlan?.currentStage ?? "—"} />
        <Row label="Tiến độ" value={s.activePlan ? `${s.activePlan.doneSessions}/${s.activePlan.totalSessions} buổi` : "—"} />
        <Row label="Trạng thái" value={s.activePlan ? (PLAN_STATUS_LABEL[s.activePlan.status] ?? s.activePlan.status) : "—"} />
      </Panel>

      <Panel title="Hành động tiếp theo">
        <Row label="Booking tiếp theo" value={s.nextBooking ? `${formatDateTime(s.nextBooking.scheduledAt)}${s.nextBooking.serviceName ? " · " + s.nextBooking.serviceName : ""}` : "Chưa có lịch"} />
        <Row label="Follow-up tiếp theo" value={s.nextFollowUp ? `${s.nextFollowUp.title}${s.nextFollowUp.dueDate ? " · " + formatDate(s.nextFollowUp.dueDate) : ""}` : "Không có"} />
        <Row label="Việc CSKH đang chờ" value={`${s.pendingCareTasks} việc`} />
        <Row label="Buổi tiếp theo trong phác đồ" value={s.activePlan?.nextSessionAt ? formatDateTime(s.activePlan.nextSessionAt) : "—"} />
      </Panel>

      <Panel title="Lịch sử gần nhất">
        <Row label="Dịch vụ gần nhất" value={s.lastService ?? "—"} />
        <Row label="Lần thực hiện gần nhất" value={s.lastSession?.at ? formatDateTime(s.lastSession.at) : "—"} />
        <Row label="Kỹ thuật viên gần nhất" value={s.lastTechnician ?? "—"} />
        <Row label="Đánh giá gần nhất" value={s.lastReview ? `Hài lòng ${s.lastReview.satisfactionScore ?? "—"}/5${s.lastReview.technicianScore ? `, KTV ${s.lastReview.technicianScore}/5` : ""}` : "—"} />
      </Panel>

      <Panel title="Tài chính">
        <Row label="Tổng giá trị" value={formatCurrency(c.financials.totalBilled)} />
        <Row label="Đã thanh toán" value={formatCurrency(c.financials.totalPaid)} valueClass="text-emerald-600" />
        <Row label="Công nợ" value={formatCurrency(c.financials.debt)} valueClass={c.financials.debt > 0 ? "text-red-600 font-semibold" : "text-emerald-600"} />
      </Panel>

      <Panel title="Before/After gần nhất" action={<button onClick={() => onGoTab("reviews")} className="text-xs text-primary hover:underline">Xem tất cả</button>}>
        {latestBA.length === 0 ? <Empty>Chưa có ảnh Before/After</Empty> : latestBA.map((g: any) => (
          <div key={g.sessionId}>
            <div className="mb-1 text-xs text-muted-foreground">Buổi {g.sessionNumber}{g.serviceName ? " · " + g.serviceName : ""}{g.performedAt ? " · " + formatDate(g.performedAt) : ""}</div>
            <div className="flex gap-2">
              {[...g.before.map((m: any) => ({ ...m, tag: "Trước" })), ...g.after.map((m: any) => ({ ...m, tag: "Sau" }))].slice(0, 4).map((m: any) => (
                <button key={m.id} onClick={() => onOpenImage(m.id)} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaSrc(m.id)} alt={m.tag} className="h-16 w-16 rounded object-cover" />
                  <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 text-[10px] text-white">{m.tag}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <Panel title="Sản phẩm đề xuất gần nhất" action={<button onClick={() => onGoTab("recommendations")} className="text-xs text-primary hover:underline">Xem tất cả</button>}>
        {latestRecs.length === 0 ? <Empty>Chưa có đề xuất</Empty> : (
          <ul className="space-y-2">
            {latestRecs.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate"><Package className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />{r.product?.name ?? "—"}</span>
                <Badge tone={RECOMMENDATION_PRIORITY_TONE[r.priority]}>{RECOMMENDATION_PRIORITY_LABEL[r.priority]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}
function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

/* ---- Timeline ---- */
function TimelineTab({ timeline }: { timeline: Customer["timeline"] }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [kind, setKind] = useState(""); const [text, setText] = useState("");
  const kinds = useMemo(() => [...new Set(timeline.map((e) => e.kind))], [timeline]);
  const filtered = timeline.filter((e) => {
    if (kind && e.kind !== kind) return false;
    if (from && e.at < from) return false;
    if (to && e.at > `${to}T23:59:59`) return false;
    if (text) {
      const hay = `${e.title} ${e.detail ?? ""}`.toLowerCase();
      if (!hay.includes(text.toLowerCase())) return false;
    }
    return true;
  });
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Từ ngày</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>Đến ngày</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Loại sự kiện</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">— Tất cả —</option>
              {kinds.map((k) => <option key={k} value={k}>{TIMELINE_KIND_LABEL[k] ?? k}</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label>Lọc theo dịch vụ/KTV/phác đồ</Label><Input placeholder="Từ khóa..." value={text} onChange={(e) => setText(e.target.value)} /></div>
        </div>
        {filtered.length === 0 ? <Empty>Không có sự kiện phù hợp</Empty> : (
          <ol className="relative space-y-4 border-l pl-6">
            {filtered.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TIMELINE_KIND_TONE[e.kind] ?? "muted"}>{TIMELINE_KIND_LABEL[e.kind] ?? e.kind}</Badge>
                  {e.href ? <Link href={e.href} className="font-medium text-primary hover:underline">{e.title}</Link> : <span className="font-medium">{e.title}</span>}
                  {e.status && <span className="text-xs text-muted-foreground">· {statusLabel(e.status)}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                </div>
                {e.detail && <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/* ---- Visits (bookings + sessions) ---- */
function VisitsTab({ bookings, sessions }: { bookings: any[]; sessions: any[] }) {
  const [sub, setSub] = useState<"bookings" | "sessions">("bookings");
  return (
    <div>
      <SubTabs tabs={[{ key: "bookings", label: `Booking (${bookings.length})` }, { key: "sessions", label: `Lần thực hiện (${sessions.length})` }]} active={sub} onChange={setSub} />
      {sub === "bookings" ? (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Ngày giờ</TH><TH>Dịch vụ</TH><TH>KTV</TH><TH>Phòng/Máy</TH><TH>Trạng thái</TH><TH className="text-right">Giá</TH></TR></THead>
          <TBody>
            {bookings.length === 0 ? <TR><TD colSpan={6}><Empty>Chưa có booking</Empty></TD></TR> : bookings.map((b) => (
              <TR key={b.id}>
                <TD>{formatDateTime(b.scheduledAt)}</TD>
                <TD>{b.service?.name ?? "—"}</TD>
                <TD>{b.technician ?? "—"}</TD>
                <TD>{[b.room, b.machine].filter(Boolean).join(" / ") || "—"}</TD>
                <TD><Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge></TD>
                <TD className="text-right">{b.price ? formatCurrency(Number(b.price)) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Ngày</TH><TH>Dịch vụ</TH><TH>Phác đồ</TH><TH>KTV chính</TH><TH>Master</TH><TH>Trạng thái</TH><TH>Đánh giá</TH><TH></TH></TR></THead>
          <TBody>
            {sessions.length === 0 ? <TR><TD colSpan={8}><Empty>Chưa có lần thực hiện</Empty></TD></TR> : sessions.map((se) => {
              const primary = (se.staff ?? []).find((x: any) => x.role === "PRIMARY") ?? (se.staff ?? [])[0];
              const master = (se.staff ?? []).find((x: any) => x.role === "MASTER");
              return (
                <TR key={se.id}>
                  <TD>{formatDate(se.performedAt ?? se.scheduledAt ?? se.createdAt)}</TD>
                  <TD>{se.service?.name ?? se.name ?? "—"}</TD>
                  <TD>{se.plan?.name ?? "—"}</TD>
                  <TD>{se.performer ?? primary?.staffName ?? "—"}</TD>
                  <TD>{master?.staffName ?? "—"}</TD>
                  <TD><Badge tone={SESSION_STATUS_TONE[se.status]}>{SESSION_STATUS_LABEL[se.status]}</Badge></TD>
                  <TD>{se.review ? <Stars score={se.review.satisfactionScore} /> : "—"}</TD>
                  <TD><Link href={`/treatment-plans/${se.planId}`} className="text-sm text-primary hover:underline">Mở</Link></TD>
                </TR>
              );
            })}
          </TBody>
        </Table></div></CardContent></Card>
      )}
    </div>
  );
}

/* ---- Plans ---- */
function PlansTab({ plans }: { plans: any[] }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Mã</TH><TH>Tên phác đồ</TH><TH>Ver</TH><TH>Trạng thái</TH><TH className="text-right">Buổi đã/tổng</TH><TH>Ngày tạo</TH><TH className="text-right">Giá dự kiến</TH><TH></TH></TR></THead>
      <TBody>
        {plans.length === 0 ? <TR><TD colSpan={8}><Empty>Chưa có phác đồ</Empty></TD></TR> : plans.map((p) => {
          const done = (p.sessions ?? []).filter((x: any) => x.status === "COMPLETED").length;
          const total = p._count?.sessions ?? (p.sessions?.length ?? 0);
          return (
            <TR key={p.id}>
              <TD className="font-mono">{p.code}</TD>
              <TD className="font-medium">{p.name}</TD>
              <TD>v{p.version}</TD>
              <TD><Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge></TD>
              <TD className="text-right tabular-nums">{done}/{total}</TD>
              <TD>{formatDate(p.createdAt)}</TD>
              <TD className="text-right">{p.totalPrice != null ? formatCurrency(Number(p.totalPrice)) : "—"}</TD>
              <TD><Link href={`/treatment-plans/${p.id}`} className="text-sm text-primary hover:underline">Mở</Link></TD>
            </TR>
          );
        })}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

/* ---- Reviews & Before/After ---- */
function ReviewsTab({ sessions, beforeAfter, services, onOpenImage }: { sessions: any[]; beforeAfter: any[] | null; services: any[]; onOpenImage: (id: string) => void }) {
  const [sub, setSub] = useState<"reviews" | "ba">("reviews");
  const reviewed = sessions.filter((s) => s.review && (s.review.satisfactionScore || s.review.technicianScore || s.review.comment));
  const [svc, setSvc] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const groups = (beforeAfter ?? []).filter((g) => {
    if (svc && g.serviceName !== svc) return false;
    if (from && g.performedAt && g.performedAt < from) return false;
    if (to && g.performedAt && g.performedAt > `${to}T23:59:59`) return false;
    return true;
  });
  const svcNames = [...new Set((beforeAfter ?? []).map((g) => g.serviceName).filter(Boolean))];
  return (
    <div>
      <SubTabs tabs={[{ key: "reviews", label: `Đánh giá (${reviewed.length})` }, { key: "ba", label: `Before/After (${(beforeAfter ?? []).length})` }]} active={sub} onChange={setSub} />
      {sub === "reviews" ? (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Ngày</TH><TH>Buổi</TH><TH>Hài lòng</TH><TH>KTV</TH><TH>Điểm KTV</TH><TH>Sẽ quay lại</TH><TH>Nhận xét</TH></TR></THead>
          <TBody>
            {reviewed.length === 0 ? <TR><TD colSpan={7}><Empty>Chưa có đánh giá</Empty></TD></TR> : reviewed.map((se) => (
              <TR key={se.id}>
                <TD>{formatDate(se.performedAt ?? se.createdAt)}</TD>
                <TD>Buổi {se.sessionNumber}{se.name ? " · " + se.name : ""}</TD>
                <TD><Stars score={se.review.satisfactionScore} /></TD>
                <TD>{se.review.technicianName ?? se.performer ?? "—"}</TD>
                <TD><Stars score={se.review.technicianScore} /></TD>
                <TD>{se.review.wouldReturn == null ? "—" : se.review.wouldReturn ? "Có" : "Không"}</TD>
                <TD className="max-w-[240px] truncate" title={se.review.comment ?? ""}>{se.review.comment ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      ) : (
        <Card><CardContent className="p-4">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label>Dịch vụ</Label>
              <Select value={svc} onChange={(e) => setSvc(e.target.value)}><option value="">— Tất cả —</option>{svcNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select>
            </div>
            <div className="space-y-1"><Label>Từ ngày</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>Đến ngày</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {beforeAfter === null ? <Empty>Đang tải...</Empty> : groups.length === 0 ? <Empty>Chưa có ảnh Before/After</Empty> : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.sessionId}>
                  <div className="mb-2 text-sm font-medium">Buổi {g.sessionNumber}{g.serviceName ? " · " + g.serviceName : ""}{g.performedAt ? " · " + formatDate(g.performedAt) : ""}{g.technicianName ? " · KTV " + g.technicianName : ""}</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImgGroup title="Trước" items={g.before} onOpen={onOpenImage} />
                    <ImgGroup title="Sau" items={g.after} onOpen={onOpenImage} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}
function ImgGroup({ title, items, onOpen }: { title: string; items: any[]; onOpen: (id: string) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Images className="h-3.5 w-3.5" /> {title}</div>
      {items.length === 0 ? <div className="text-xs text-muted-foreground">—</div> : (
        <div className="flex flex-wrap gap-2">
          {items.map((m) => (
            <button key={m.id} onClick={() => onOpen(m.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(m.id)} alt={title} className="h-24 w-24 rounded object-cover ring-1 ring-border" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Recommendations ---- */
function RecommendationsTab({ recs }: { recs: any[] | null }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Sản phẩm</TH><TH>Brand</TH><TH>Lý do</TH><TH>Ưu tiên</TH><TH className="text-right">Giá</TH><TH className="text-right">SL</TH><TH>Ngày</TH><TH>Người đề xuất</TH></TR></THead>
      <TBody>
        {recs === null ? <TR><TD colSpan={8}><Empty>Đang tải...</Empty></TD></TR> : recs.length === 0 ? <TR><TD colSpan={8}><Empty>Chưa có đề xuất sản phẩm</Empty></TD></TR> : recs.map((r) => (
          <TR key={r.id}>
            <TD className="font-medium">{r.product?.name ?? "—"}</TD>
            <TD>{r.product?.brand?.name ?? "—"}</TD>
            <TD className="max-w-[220px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TD>
            <TD><Badge tone={RECOMMENDATION_PRIORITY_TONE[r.priority]}>{RECOMMENDATION_PRIORITY_LABEL[r.priority]}</Badge></TD>
            <TD className="text-right">{r.price != null ? formatCurrency(Number(r.price)) : "—"}</TD>
            <TD className="text-right">{r.quantity}</TD>
            <TD>{formatDate(r.createdAt)}</TD>
            <TD>{r.createdBy ?? "—"}</TD>
          </TR>
        ))}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

/* ---- Materials ---- */
function MaterialsTab({ materials }: { materials: any[] | null }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Vật tư</TH><TH>Ngày cấp</TH><TH>Phác đồ</TH><TH className="text-right">Đã cấp</TH><TH className="text-right">Đã dùng</TH><TH className="text-right">Còn lại</TH><TH>Đơn vị</TH><TH>Lần dùng gần nhất</TH><TH>Trạng thái</TH></TR></THead>
      <TBody>
        {materials === null ? <TR><TD colSpan={9}><Empty>Đang tải...</Empty></TD></TR> : materials.length === 0 ? <TR><TD colSpan={9}><Empty>Khách chưa có vật tư riêng. Cấp ở menu &quot;Vật tư khách hàng&quot;.</Empty></TD></TR> : materials.map((m) => (
          <TR key={m.id}>
            <TD className="font-medium">{m.name}</TD>
            <TD>{formatDate(m.createdAt)}</TD>
            <TD>{m.planName ?? "—"}</TD>
            <TD className="text-right tabular-nums">{Number(m.allocatedQty)}</TD>
            <TD className="text-right tabular-nums">{Number(m.usedQty)}</TD>
            <TD className="text-right font-medium tabular-nums">{Number(m.remainingQty)}</TD>
            <TD>{m.unit}</TD>
            <TD>{m.lastUsedAt ? formatDate(m.lastUsedAt) : "—"}</TD>
            <TD><Badge tone={m.status === "ACTIVE" ? "success" : m.status === "USED_UP" ? "muted" : "danger"}>{statusLabel(m.status)}</Badge></TD>
          </TR>
        ))}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

/* ---- Care (crm log + follow-up tasks + care instructions) ---- */
function CareTab({ activities, tasks, careItems }: { activities: any[]; tasks: any[]; careItems: any[] | null }) {
  const [sub, setSub] = useState<"log" | "followups" | "guides">("log");
  return (
    <div>
      <SubTabs tabs={[{ key: "log", label: `Nhật ký (${activities.length})` }, { key: "followups", label: `Follow-up (${tasks.length})` }, { key: "guides", label: `Hướng dẫn chăm sóc${careItems ? ` (${careItems.length})` : ""}` }]} active={sub} onChange={setSub} />
      {sub === "log" && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Thời gian</TH><TH>Loại</TH><TH>Nội dung</TH><TH>Kết quả</TH><TH>Follow-up</TH></TR></THead>
          <TBody>
            {activities.length === 0 ? <TR><TD colSpan={5}><Empty>Chưa có nhật ký</Empty></TD></TR> : activities.map((a) => (
              <TR key={a.id}>
                <TD>{formatDateTime(a.occurredAt)}</TD>
                <TD><Badge tone="default">{CRM_TYPE_LABEL[a.type] ?? a.type}</Badge></TD>
                <TD>{a.content}</TD>
                <TD>{a.result ?? "—"}</TD>
                <TD>{a.followUpDate ? formatDate(a.followUpDate) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      )}
      {sub === "followups" && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Nội dung</TH><TH>Ngày cần làm</TH><TH>Người phụ trách</TH><TH>Kênh</TH><TH>Trạng thái</TH></TR></THead>
          <TBody>
            {tasks.length === 0 ? <TR><TD colSpan={5}><Empty>Không có việc follow-up</Empty></TD></TR> : tasks.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium">{t.title}</TD>
                <TD>{t.dueDate ? formatDate(t.dueDate) : "—"}</TD>
                <TD>{t.assignee ?? "—"}</TD>
                <TD>{t.channel ? DELIVERY_CHANNEL_LABEL[t.channel] ?? t.channel : "—"}</TD>
                <TD><Badge tone={t.status === "DONE" ? "success" : t.status === "CANCELLED" ? "muted" : "warning"}>{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      )}
      {sub === "guides" && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Loại</TH><TH>Tiêu đề</TH><TH>Kênh gửi</TH><TH>Ngày gửi</TH><TH>Người gửi</TH></TR></THead>
          <TBody>
            {careItems === null ? <TR><TD colSpan={5}><Empty>Đang tải...</Empty></TD></TR> : careItems.length === 0 ? <TR><TD colSpan={5}><Empty>Chưa gửi hướng dẫn nào</Empty></TD></TR> : careItems.map((ci) => (
              <TR key={ci.id}>
                <TD><Badge tone={CARE_KIND_TONE[ci.kind]}>{CARE_KIND_LABEL[ci.kind]}</Badge></TD>
                <TD className="font-medium">{ci.title}</TD>
                <TD>{DELIVERY_CHANNEL_LABEL[ci.deliveredVia] ?? ci.deliveredVia}</TD>
                <TD>{ci.deliveredAt ? formatDate(ci.deliveredAt) : "Chưa gửi"}</TD>
                <TD>{ci.providedBy ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      )}
    </div>
  );
}

/* ---- Proposals ---- */
function ProposalsTab({ proposals }: { proposals: any[] }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Mã</TH><TH>Tiêu đề</TH><TH>Ngày</TH><TH className="text-right">Số PA</TH><TH className="text-right">Giá đã chốt</TH><TH>Trạng thái</TH><TH>Người tư vấn</TH><TH></TH></TR></THead>
      <TBody>
        {proposals.length === 0 ? <TR><TD colSpan={8}><Empty>Chưa có báo giá</Empty></TD></TR> : proposals.map((p) => (
          <TR key={p.id}>
            <TD className="font-mono">{p.code}</TD>
            <TD className="font-medium">{p.title}</TD>
            <TD>{formatDate(p.createdAt)}</TD>
            <TD className="text-right">{p._count?.options ?? 0}</TD>
            <TD className="text-right">{p.agreedPrice != null ? formatCurrency(Number(p.agreedPrice)) : "—"}</TD>
            <TD><Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge></TD>
            <TD>{p.createdBy ?? "—"}</TD>
            <TD><Link href={`/proposals/${p.id}`} className="text-sm text-primary hover:underline">Mở</Link></TD>
          </TR>
        ))}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

/* ---- Billing (invoices + payments + deposits) ---- */
function BillingTab({ invoices, payments, deposits, financials }: { invoices: any[] | null; payments: any[]; deposits: any[]; financials: Customer["financials"] }) {
  const [sub, setSub] = useState<"invoices" | "payments" | "deposits">("invoices");
  const validPaid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + Number(p.amount), 0);
  const allocatedDep = deposits.filter((d) => d.status === "ALLOCATED").reduce((s, d) => s + Number(d.amount), 0);
  const activeDep = deposits.filter((d) => d.status === "ACTIVE").reduce((s, d) => s + Number(d.amount), 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Kpi icon={TrendingUp} label="Tổng phải thu" value={formatCurrency(financials.totalBilled)} />
        <Kpi icon={Wallet} label="Đã thanh toán" value={formatCurrency(financials.totalPaid)} tone="emerald" />
        <Kpi icon={Wallet} label="Công nợ" value={formatCurrency(financials.debt)} tone={financials.debt > 0 ? "red" : "emerald"} />
      </div>
      {/* Đối soát: công nợ chỉ từ hóa đơn; đã trả = phiếu thu hợp lệ + cọc đã phân bổ. */}
      <div className="mb-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Đối soát: </span>
        Đã thanh toán {formatCurrency(financials.totalPaid)} = phiếu thu hợp lệ {formatCurrency(validPaid)} + cọc đã phân bổ {formatCurrency(allocatedDep)}.
        {activeDep > 0 && <> Còn <span className="font-medium text-amber-600">cọc đang giữ {formatCurrency(activeDep)}</span> (chưa trừ công nợ tới khi phân bổ vào hóa đơn).</>}
      </div>
      <SubTabs tabs={[
        { key: "invoices", label: `Hóa đơn${invoices ? ` (${invoices.length})` : ""}` },
        { key: "payments", label: `Thanh toán (${payments.length})` },
        { key: "deposits", label: `Tiền cọc (${deposits.length})` },
      ]} active={sub} onChange={setSub as any} />
      {sub === "invoices" ? (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Mã HĐ</TH><TH>Ngày</TH><TH className="text-right">Tổng</TH><TH className="text-right">Đã trả</TH><TH className="text-right">Còn thu</TH><TH>Trạng thái</TH></TR></THead>
          <TBody>
            {invoices === null ? <TR><TD colSpan={6}><Empty>Đang tải...</Empty></TD></TR> : invoices.length === 0 ? <TR><TD colSpan={6}><Empty>Chưa có hóa đơn. Tạo từ một báo giá đã chốt.</Empty></TD></TR> : invoices.map((iv) => (
              <TR key={iv.id}>
                <TD className="font-mono"><Link href={`/invoices/${iv.id}`} className="text-primary hover:underline">{iv.code}</Link></TD>
                <TD>{formatDate(iv.issuedAt)}</TD>
                <TD className="text-right">{formatCurrency(Number(iv.total))}</TD>
                <TD className="text-right text-emerald-600">{formatCurrency(Number(iv.paidAmount ?? 0))}</TD>
                <TD className="text-right font-medium text-amber-600">{formatCurrency(Number(iv.outstanding ?? 0))}</TD>
                <TD><Badge tone={INVOICE_STATUS_TONE[iv.status]}>{INVOICE_STATUS_LABEL[iv.status]}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      ) : sub === "payments" ? (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Ngày</TH><TH>Hóa đơn</TH><TH>Hình thức</TH><TH>Người thu</TH><TH>Trạng thái</TH><TH className="text-right">Số tiền</TH></TR></THead>
          <TBody>
            {payments.length === 0 ? <TR><TD colSpan={6}><Empty>Chưa có thanh toán</Empty></TD></TR> : payments.map((p) => (
              <TR key={p.id} className={p.voidedAt ? "opacity-60" : ""}>
                <TD>{formatDate(p.paidAt)}</TD>
                <TD className="font-mono">{p.invoice?.code ?? "—"}</TD>
                <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TD>
                <TD>{p.receivedBy ?? "—"}</TD>
                <TD>{p.voidedAt ? <Badge tone="muted">Đã hủy</Badge> : <Badge tone="success">Hợp lệ</Badge>}</TD>
                <TD className={`text-right font-medium ${p.voidedAt ? "line-through" : ""}`}>{formatCurrency(Number(p.amount))}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <THead><TR><TH>Mã cọc</TH><TH>Ngày thu</TH><TH>Nguồn</TH><TH>Hóa đơn</TH><TH>Trạng thái</TH><TH className="text-right">Số tiền</TH></TR></THead>
          <TBody>
            {deposits.length === 0 ? <TR><TD colSpan={6}><Empty>Chưa có tiền cọc</Empty></TD></TR> : deposits.map((d) => (
              <TR key={d.id}>
                <TD className="font-mono">{d.code}</TD>
                <TD>{formatDate(d.receivedAt)}</TD>
                <TD>{d.booking?.code ? `Lịch ${d.booking.code}` : "—"}</TD>
                <TD className="font-mono">{d.invoice?.code ?? "—"}</TD>
                <TD><Badge tone={DEPOSIT_STATUS_TONE[d.status]}>{DEPOSIT_STATUS_LABEL[d.status]}</Badge></TD>
                <TD className="text-right font-medium">{formatCurrency(Number(d.amount))}</TD>
              </TR>
            ))}
          </TBody>
        </Table></div></CardContent></Card>
      )}
    </div>
  );
}

/* ---- Forms & documents ---- */
function FormsTab({ forms }: { forms: any[] | null }) {
  return (
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <THead><TR><TH>Biểu mẫu</TH><TH>Mã mẫu</TH><TH>Ver</TH><TH>Trạng thái</TH><TH>Ngày tạo</TH><TH></TH></TR></THead>
      <TBody>
        {forms === null ? <TR><TD colSpan={6}><Empty>Đang tải...</Empty></TD></TR> : forms.length === 0 ? <TR><TD colSpan={6}><Empty>Chưa áp biểu mẫu / tài liệu nào</Empty></TD></TR> : forms.map((fm) => (
          <TR key={fm.id}>
            <TD className="font-medium">{fm.name ?? fm.template?.name}</TD>
            <TD className="font-mono">{fm.template?.code}</TD>
            <TD>v{fm.templateVersion}</TD>
            <TD>{fm.status ? <Badge tone={fm.status === "COMPLETED" ? "success" : "muted"}>{statusLabel(fm.status)}</Badge> : "—"}</TD>
            <TD>{formatDate(fm.createdAt)}</TD>
            <TD><Link href={`/form-instances/${fm.id}`} className="text-sm text-primary hover:underline">Mở / điền</Link></TD>
          </TR>
        ))}
      </TBody>
    </Table></div></CardContent></Card>
  );
}

/* ============================ Modals ============================ */
function BookingModal({ open, onClose, customerId, services, onDone }: { open: boolean; onClose: () => void; customerId: string; services: any[]; onDone: () => void }) {
  const [f, setF] = useState({ scheduledAt: "", durationMinutes: "60", serviceId: "", technician: "", room: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function doSubmit(override: boolean) {
    setSaving(true); setError(null);
    const body: any = {
      customerId, scheduledAt: new Date(f.scheduledAt).toISOString(),
      durationMinutes: Number(f.durationMinutes) || 60,
      serviceId: f.serviceId || null, technician: f.technician || null, room: f.room || null, note: f.note || null,
    };
    if (override) { body.allowConflict = true; body.allowBelowFloor = true; }
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setWarn(json?.error ?? "Trùng lịch / dưới giá sàn — xác nhận vẫn đặt?");
        setSaving(false);
        return;
      }
      if (!res.ok) throw new Error(json?.error ?? "Lỗi tạo booking");
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo Booking cho khách">
      <form onSubmit={(e) => { e.preventDefault(); setWarn(null); doSubmit(false); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Ngày giờ *</Label><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Dịch vụ</Label>
          <Select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
            <option value="">— Chọn dịch vụ —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kỹ thuật viên</Label><Input value={f.technician} onChange={(e) => setF({ ...f, technician: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phòng</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {warn && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">
            {warn}
            <div className="mt-2"><Button type="button" size="sm" onClick={() => doSubmit(true)} disabled={saving}>Vẫn đặt (bỏ qua cảnh báo)</Button></div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !f.scheduledAt}>{saving ? "Đang lưu..." : "Tạo booking"}</Button></div>
      </form>
    </Modal>
  );
}

function FollowUpModal({ open, onClose, onSubmit, error }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null }) {
  const [f, setF] = useState({ title: "", dueDate: "", assignee: "", priority: "NORMAL" });
  return (
    <Modal open={open} onClose={onClose} title="Tạo việc Follow-up">
      <form onSubmit={(e) => { e.preventDefault(); const b: any = { ...f }; if (!b.dueDate) delete b.dueDate; onSubmit(b); }} className="space-y-4">
        <div className="space-y-1.5"><Label>Nội dung cần làm *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required placeholder="Gọi hỏi thăm sau buổi..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Ngày cần làm</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Người phụ trách</Label><Input value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Ưu tiên</Label>
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn</option>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Việc sẽ hiển thị ở tab Chăm sóc khách hàng và mục /tasks.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

function PortalAccountModal({ open, onClose, customerId, defaultEmail }: { open: boolean; onClose: () => void; customerId: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null);
    try {
      await apiFetch(`/api/customers/${customerId}/portal-account`, { method: "POST", body: JSON.stringify({ email, password }) });
      setMsg("Đã cấp tài khoản Cổng khách. Gửi thông tin đăng nhập cho khách qua kênh an toàn.");
      setPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Cấp tài khoản Cổng khách hàng">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted-foreground">Khách đăng nhập tại <b>/portal</b> để xem báo giá, phác đồ, lịch hẹn, hướng dẫn và tự chốt phương án.</p>
        <div className="space-y-1.5"><Label>Email đăng nhập *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Mật khẩu * (≥ 6 ký tự)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Đóng</Button><Button type="submit">Lưu tài khoản</Button></div>
      </form>
    </Modal>
  );
}

function SendCareModal({ open, onClose, onSubmit, error, templates }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null; templates: any[] }) {
  const [f, setF] = useState({ templateId: "", kind: "PRE_CARE", title: "", content: "", deliveredVia: "IN_PERSON", markDelivered: true });
  const usable = templates.filter((t) => t.status === "ACTIVE" || t.status === "APPROVED");
  function applyTemplate(tid: string) {
    const t = templates.find((x) => x.id === tid);
    setF((prev) => ({ ...prev, templateId: tid, ...(t ? { kind: t.kind, title: t.title, content: t.content } : {}) }));
  }
  return (
    <Modal open={open} onClose={onClose} title="Gửi hướng dẫn cho khách" className="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, templateId: f.templateId || undefined }); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mẫu (tùy chọn)</Label>
            <Select value={f.templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Soạn tự do —</option>
              {usable.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loại</Label>
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(CARE_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Tiêu đề *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
        <div className="space-y-1.5">
          <Label>Nội dung (cá nhân hóa được, không đổi mẫu gốc) *</Label>
          <textarea className="min-h-[140px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kênh gửi</Label>
            <Select value={f.deliveredVia} onChange={(e) => setF({ ...f, deliveredVia: e.target.value })}>
              {Object.entries(DELIVERY_CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.markDelivered} onChange={(e) => setF({ ...f, markDelivered: e.target.checked })} /> Đánh dấu đã gửi</label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Gửi</Button></div>
      </form>
    </Modal>
  );
}

function RecommendModal({ open, onClose, onSubmit, error, products }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null; products: any[] }) {
  const [f, setF] = useState({ spaProductId: "", priority: "RECOMMENDED", reason: "", goal: "", usage: "", quantity: "1", price: "" });
  return (
    <Modal open={open} onClose={onClose} title="Đề xuất sản phẩm">
      <form onSubmit={(e) => { e.preventDefault(); const b: any = { ...f, quantity: Number(f.quantity || 1) }; if (f.price) b.price = Number(f.price); else delete b.price; onSubmit(b); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Sản phẩm *</Label>
          <Select value={f.spaProductId} onChange={(e) => setF({ ...f, spaProductId: e.target.value })} required>
            <option value="">— Chọn sản phẩm —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.brand ? ` · ${p.brand.name}` : ""}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mức ưu tiên</Label>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              {Object.entries(RECOMMENDATION_PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Số lượng</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Lý do đề xuất</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Mục tiêu sử dụng</Label><Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Giá (bỏ trống = giá bán)</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Hướng dẫn sử dụng</Label><Input value={f.usage} onChange={(e) => setF({ ...f, usage: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

function ApplyFormModal({ open, onClose, onSubmit, error, templates }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null; templates: any[] }) {
  const [templateId, setTemplateId] = useState("");
  const usable = templates.filter((t) => t.status === "ACTIVE" || t.status === "APPROVED");
  return (
    <Modal open={open} onClose={onClose} title="Áp biểu mẫu cho khách">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ templateId }); }} className="space-y-4">
        <p className="text-xs text-muted-foreground">Tạo một phiếu riêng cho khách (snapshot mẫu, không đổi bản gốc). Chỉ mẫu đã duyệt/đang dùng.</p>
        <div className="space-y-1.5">
          <Label>Biểu mẫu *</Label>
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="">— Chọn biểu mẫu —</option>
            {usable.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
          </Select>
          {usable.length === 0 && <p className="text-xs text-amber-600">Chưa có biểu mẫu ở trạng thái Đã duyệt/Đang dùng.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={!templateId}>Áp dụng</Button></div>
      </form>
    </Modal>
  );
}

function CrmModal({ open, onClose, onSubmit, error }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null }) {
  const [f, setF] = useState({ type: "CALL", content: "", result: "", nextAction: "", followUpDate: "", followUpOwner: "" });
  return (
    <Modal open={open} onClose={onClose} title="Thêm nhật ký CSKH">
      <form onSubmit={(e) => { e.preventDefault(); const b: any = { ...f }; if (!b.followUpDate) delete b.followUpDate; onSubmit(b); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Loại tương tác *</Label>
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {Object.entries(CRM_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nội dung *</Label>
          <textarea className="min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Kết quả</Label><Input value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Việc tiếp theo</Label><Input value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Ngày follow-up</Label><Input type="date" value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Người follow-up</Label><Input value={f.followUpOwner} onChange={(e) => setF({ ...f, followUpOwner: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Có ngày follow-up sẽ tự tạo công việc nhắc lịch.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, onSubmit, error, debt }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null; debt: number }) {
  const [f, setF] = useState({ amount: "", method: "CASH", note: "" });
  return (
    <Modal open={open} onClose={onClose} title="Ghi nhận thanh toán">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, amount: Number(f.amount) }); }} className="space-y-4">
        <p className="text-sm text-muted-foreground">Công nợ hiện tại: <span className="font-medium text-foreground">{formatCurrency(debt)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Số tiền *</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          <div className="space-y-1.5">
            <Label>Hình thức</Label>
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

function AssessmentModal({ open, onClose, onSubmit, error }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null }) {
  const [f, setF] = useState({ name: "", area: "", severity: "", description: "", note: "" });
  return (
    <Modal open={open} onClose={onClose} title="Đánh giá tình trạng">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-4">
        <div className="space-y-1.5"><Label>Tình trạng *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Vùng</Label><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Mức độ</Label><Input value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} placeholder="Nhẹ / Vừa / Nặng" /></div>
        </div>
        <div className="space-y-1.5"><Label>Mô tả</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Nhận xét chuyên viên</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}
