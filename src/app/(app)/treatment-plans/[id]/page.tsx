"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft, GitBranch, Calendar, Layers, Clock, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { MediaUpload } from "@/components/media-upload";
import { SessionMediaShare } from "@/components/session-media-share";
import { SpaMaterialConsume } from "@/components/spa-material-consume";
import { SessionStaff } from "@/components/session-staff";
import { SessionReview } from "@/components/session-review";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  PLAN_STATUS_LABEL,
  PLAN_STATUS_TONE,
  STAGE_STATUS_LABEL,
  STAGE_STATUS_TONE,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
  FREQUENCY_UNIT_LABEL,
} from "@/lib/clinic-labels";
import {
  computePlanProgress,
  deriveSessionStatus,
  deriveStageStatus,
  isSessionDateInStage,
  frequencyLabel,
  comparePlannedActual,
  isSessionDone,
} from "@/lib/treatment-plan";

interface Opt { id: string; name: string }
interface Plan {
  id: string;
  code: string;
  name: string;
  version: number;
  status: string;
  diagnosis?: string | null;
  goals?: string | null;
  totalPrice?: string | number | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  designer?: string | null;
  approver?: string | null;
  approvedAt?: string | null;
  note?: string | null;
  changeLog?: any;
  customerId?: string;
  customer: { id?: string; code: string; fullName: string };
  stages: any[];
  sessions: any[];
  versions?: any[];
  canSeeFinance: boolean;
}

const PLAN_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
const SESSION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED"];
const STAGE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const FREQ_UNITS = ["DAY", "WEEK", "MONTH"];

type TabKey = "overview" | "stages" | "timeline" | "versions";
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "overview", label: "Tổng quan", icon: Layers },
  { key: "stages", label: "Kế hoạch theo giai đoạn", icon: Calendar },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "versions", label: "Phiên bản", icon: History },
];

export default function TreatmentPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const canMedia = useCan(PERMISSIONS.MEDIA_WRITE);
  const canMaterial = useCan(PERMISSIONS.MATERIAL_WRITE);
  const [p, setP] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [services, setServices] = useState<Opt[]>([]);
  const [technologies, setTechnologies] = useState<Opt[]>([]);
  const [protocols, setProtocols] = useState<Opt[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addStageFor, setAddStageFor] = useState<string | null>(null); // stageId hoặc "" (chưa gán)
  const [record, setRecord] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [editStage, setEditStage] = useState<any | null>(null);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formsFor, setFormsFor] = useState<any | null>(null);
  const [sessionForms, setSessionForms] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [matsFor, setMatsFor] = useState<any | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [spaProducts, setSpaProducts] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setP(await apiFetch<Plan>(`/api/treatment-plans/${id}`)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => {
    load();
    apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {});
    apiFetch<Opt[]>("/api/technologies").then(setTechnologies).catch(() => {});
    apiFetch<any[]>("/api/brand-protocols").then(setProtocols).catch(() => {});
    apiFetch<any[]>("/api/form-templates").then(setFormTemplates).catch(() => {});
    apiFetch<any[]>("/api/spa-products").then(setSpaProducts).catch(() => {});
  }, [load]);

  // Bộ giải tên id → tên (dịch vụ / công nghệ / protocol) để hiển thị Kế hoạch vs Thực tế.
  const nameOf = useCallback(
    (kind: "service" | "technology" | "protocol", tid?: string | null): string => {
      if (!tid) return "—";
      const list = kind === "service" ? services : kind === "technology" ? technologies : protocols;
      return list.find((x) => x.id === tid)?.name ?? "—";
    },
    [services, technologies, protocols],
  );

  async function openMaterials(s: any) {
    setMatsFor(s); setError(null);
    setMaterials(await apiFetch<any[]>(`/api/session-materials?sessionId=${s.id}`).catch(() => []));
    setLots(await apiFetch<any[]>(`/api/inventory/lots`).catch(() => []));
  }
  async function refreshMaterials() {
    if (!matsFor) return;
    setMaterials(await apiFetch<any[]>(`/api/session-materials?sessionId=${matsFor.id}`).catch(() => []));
    setLots(await apiFetch<any[]>(`/api/inventory/lots`).catch(() => []));
    load();
  }
  async function addMaterial(body: any) {
    if (!matsFor) return; setError(null);
    try { await apiFetch("/api/session-materials", { method: "POST", body: JSON.stringify({ ...body, sessionId: matsFor.id }) }); refreshMaterials(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function moveMaterial(matId: string, type: string, quantity: number) {
    setError(null);
    try { await apiFetch(`/api/session-materials/${matId}/move`, { method: "POST", body: JSON.stringify({ type, quantity }) }); refreshMaterials(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function delMaterial(matId: string) {
    await apiFetch(`/api/session-materials/${matId}`, { method: "DELETE" }).catch((e) => setError(e.message));
    refreshMaterials();
  }
  async function openForms(s: any) {
    setFormsFor(s);
    setSessionForms(await apiFetch<any[]>(`/api/form-instances?sessionId=${s.id}`).catch(() => []));
  }
  async function attachForm(templateId: string) {
    if (!formsFor || !p) return;
    await apiFetch("/api/form-instances", { method: "POST", body: JSON.stringify({ templateId, sessionId: formsFor.id, customerId: p.customerId, planId: id }) }).catch(() => {});
    setSessionForms(await apiFetch<any[]>(`/api/form-instances?sessionId=${formsFor.id}`).catch(() => []));
  }

  async function setStatus(status: string) {
    await apiFetch(`/api/treatment-plans/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }

  // Tạo lịch hẹn từ 1 buổi (mục 11): mở form Lịch hẹn đã nghiệm thu, prefill sẵn.
  function createBookingFromSession(s: any) {
    if (!p) return;
    const q = new URLSearchParams();
    q.set("new", "1");
    q.set("customerId", p.customerId ?? "");
    const svc = s.plannedServiceId ?? s.serviceId ?? "";
    if (svc) q.set("serviceId", svc);
    q.set("planId", p.id);
    if (s.stageId) q.set("stageId", s.stageId);
    if (s.sessionNumber) q.set("sessionNumber", String(s.sessionNumber));
    q.set("sessionId", s.id);
    router.push(`/bookings?${q.toString()}`);
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!p) return <p className="text-destructive">Không tìm thấy phác đồ.</p>;

  const nextNumber = (p.sessions.reduce((m, s) => Math.max(m, s.sessionNumber), 0) || 0) + 1;
  const progress = computePlanProgress(p.stages, p.sessions);

  return (
    <div>
      <Link href="/treatment-plans" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách phác đồ
      </Link>
      <PageHeader
        title={`${p.name} (v${p.version})`}
        description={`${p.code} · Khách: ${p.customer.fullName}`}
        action={
          canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setVersionOpen(true)}><GitBranch className="h-4 w-4" /> Tạo phiên bản mới</Button>
              <Button onClick={() => { setAddStageFor(null); setAddOpen(true); }}><Plus className="h-4 w-4" /> Thêm buổi</Button>
            </div>
          )
        }
      />

      {/* Thanh trạng thái + tiến độ nhanh */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {canWrite ? (
          <Select className="h-8 w-44" value={p.status} onChange={(e) => setStatus(e.target.value)}>
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>)}
          </Select>
        ) : (
          <Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge>
        )}
        <span className="text-muted-foreground">Tiến độ:</span>
        <b>{progress.overallProgress.done}/{progress.overallProgress.total} buổi</b>
        {progress.currentStage && <span className="text-muted-foreground">· Giai đoạn hiện tại: <b className="text-foreground">{progress.currentStage.name}</b></span>}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab p={p} progress={progress} />}
      {tab === "stages" && (
        <StagesTab
          p={p}
          progress={progress}
          canWrite={canWrite}
          nameOf={nameOf}
          onAddStage={() => setAddStageOpen(true)}
          onEditStage={setEditStage}
          onAddSession={(stageId: string | null) => { setAddStageFor(stageId); setAddOpen(true); }}
          onDetail={setDetail}
          onRecord={setRecord}
          onCreateBooking={createBookingFromSession}
        />
      )}
      {tab === "timeline" && <TimelineTab stages={p.stages} sessions={p.sessions} />}
      {tab === "versions" && <VersionsTab p={p} canWrite={canWrite} onCreate={() => setVersionOpen(true)} />}

      {/* ---------- Modals ---------- */}
      <AddSessionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        error={error}
        stages={p.stages}
        services={services}
        technologies={technologies}
        protocols={protocols}
        nextNumber={nextNumber}
        defaultStageId={addStageFor}
        onSubmit={async (body: any) => {
          setError(null);
          try { await apiFetch("/api/treatment-sessions", { method: "POST", body: JSON.stringify({ ...body, planId: id }) }); setAddOpen(false); load(); }
          catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
        }}
      />

      {addStageOpen && (
        <StageModal
          title="Thêm giai đoạn"
          onClose={() => setAddStageOpen(false)}
          onSubmit={async (body: any) => {
            try { await apiFetch("/api/treatment-stages", { method: "POST", body: JSON.stringify({ ...body, planId: id }) }); setAddStageOpen(false); load(); }
            catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
          }}
        />
      )}
      {editStage && (
        <StageModal
          title={`Sửa giai đoạn: ${editStage.name}`}
          stage={editStage}
          onClose={() => setEditStage(null)}
          onSubmit={async (body: any) => {
            try { await apiFetch(`/api/treatment-stages/${editStage.id}`, { method: "PATCH", body: JSON.stringify(body) }); setEditStage(null); load(); }
            catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
          }}
        />
      )}

      {versionOpen && (
        <VersionModal
          currentVersion={p.version}
          onClose={() => setVersionOpen(false)}
          onSubmit={async (body: any) => {
            try { await apiFetch(`/api/treatment-plans/${id}/version`, { method: "POST", body: JSON.stringify(body) }); setVersionOpen(false); load(); }
            catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
          }}
        />
      )}

      {detail && (
        <SessionDetailModal
          session={detail}
          canWrite={canWrite}
          nameOf={nameOf}
          onClose={() => setDetail(null)}
          onRecord={(s: any) => { setDetail(null); setRecord(s); }}
          onForms={(s: any) => { setDetail(null); openForms(s); }}
          onMaterials={(s: any) => { setDetail(null); openMaterials(s); }}
          onCreateBooking={(s: any) => { setDetail(null); createBookingFromSession(s); }}
        />
      )}

      {formsFor && (
        <Modal open onClose={() => setFormsFor(null)} title={`Biểu mẫu buổi #${formsFor.sessionNumber}`}>
          <div className="space-y-4">
            <div className="space-y-2">
              {sessionForms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có phiếu nào cho buổi này.</p>
              ) : (
                sessionForms.map((fm) => (
                  <div key={fm.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <div className="font-medium">{fm.name ?? fm.template?.name}</div>
                      <div className="text-xs text-muted-foreground">{fm.template?.code} · {fm.status === "COMPLETED" ? "Đã hoàn thành" : "Đang điền"}</div>
                    </div>
                    <Link href={`/form-instances/${fm.id}`} className="text-primary hover:underline">Mở / điền</Link>
                  </div>
                ))
              )}
            </div>
            {canWrite && (
              <div className="space-y-1.5 border-t pt-3">
                <Label>Gắn biểu mẫu (mẫu đã duyệt/đang dùng)</Label>
                <Select defaultValue="" onChange={(e) => { if (e.target.value) { attachForm(e.target.value); e.target.value = ""; } }}>
                  <option value="">— Chọn mẫu để gắn vào buổi —</option>
                  {formTemplates.filter((t) => t.status === "ACTIVE" || t.status === "APPROVED").map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
                </Select>
                <p className="text-xs text-muted-foreground">Phiếu được snapshot theo phiên bản mẫu tại thời điểm gắn — sửa mẫu về sau không ảnh hưởng.</p>
              </div>
            )}
            <div className="flex justify-end"><Button variant="outline" onClick={() => setFormsFor(null)}>Đóng</Button></div>
          </div>
        </Modal>
      )}

      {matsFor && (
        <MaterialsModal
          session={matsFor} materials={materials} spaProducts={spaProducts} lots={lots} error={error}
          canFinance={p.canSeeFinance} canWrite={canWrite}
          onClose={() => { setMatsFor(null); setError(null); }}
          onAdd={addMaterial} onMove={moveMaterial} onDelete={delMaterial}
        />
      )}

      {record && (
        <RecordSessionModal
          session={record} canFinance={p.canSeeFinance} canShare={canMedia} canMaterial={canMaterial} canWrite={canWrite} error={error}
          onClose={() => setRecord(null)}
          onSubmit={async (body: any) => {
            setError(null);
            try { await apiFetch(`/api/treatment-sessions/${record.id}`, { method: "PATCH", body: JSON.stringify(body) }); setRecord(null); load(); }
            catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
          }}
        />
      )}
    </div>
  );
}

/* ===================== Tổng quan ===================== */
function OverviewTab({ p, progress }: any) {
  const totalDays = p.plannedStartDate && p.plannedEndDate
    ? Math.max(0, Math.round((new Date(p.plannedEndDate).getTime() - new Date(p.plannedStartDate).getTime()) / 86400000))
    : null;
  const kpis: { label: string; value: React.ReactNode }[] = [
    { label: "Phiên bản", value: `V${p.version}` },
    { label: "Trạng thái", value: <Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge> },
    { label: "Ngày bắt đầu", value: p.plannedStartDate ? formatDate(p.plannedStartDate) : "—" },
    { label: "Dự kiến hoàn thành", value: p.plannedEndDate ? formatDate(p.plannedEndDate) : "—" },
    { label: "Tổng thời gian dự kiến", value: totalDays != null ? `${totalDays} ngày` : "—" },
    { label: "Giai đoạn hiện tại", value: progress.currentStage?.name ?? "—" },
    { label: "Tiến độ giai đoạn", value: progress.stageProgress ? `${progress.stageProgress.done}/${progress.stageProgress.total} buổi` : "—" },
    { label: "Tiến độ toàn phác đồ", value: `${progress.overallProgress.done}/${progress.overallProgress.total} buổi` },
    { label: "Tổng số giai đoạn", value: p.stages.length },
    { label: "Tổng giá dự kiến", value: p.totalPrice ? formatNumber(Number(p.totalPrice)) + " ₫" : "—" },
    { label: "Buổi tiếp theo", value: progress.nextSession ? `#${progress.nextSession.sessionNumber}${progress.nextSession.date ? " · " + formatDate(progress.nextSession.date) : ""}` : "—" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="mt-0.5 font-medium">{k.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="space-y-2 p-5 text-sm">
          <div><span className="text-muted-foreground">Tình trạng chính: </span>{p.diagnosis ?? "—"}</div>
          <div><span className="text-muted-foreground">Mục tiêu / mong muốn: </span>{p.goals ?? "—"}</div>
          <div><span className="text-muted-foreground">Ghi chú: </span>{p.note ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="space-y-2 p-5 text-sm">
          <div><span className="text-muted-foreground">Người thiết kế: </span>{p.designer ?? "—"}</div>
          <div><span className="text-muted-foreground">Người duyệt: </span>{p.approver ?? "—"}{p.approvedAt ? ` · ${formatDate(p.approvedAt)}` : ""}</div>
          <div><span className="text-muted-foreground">Khách hàng: </span>{p.customer.fullName} ({p.customer.code})</div>
        </CardContent></Card>
      </div>
    </div>
  );
}

/* ===================== Kế hoạch theo giai đoạn ===================== */
function StagesTab({ p, canWrite, nameOf, onAddStage, onEditStage, onAddSession, onDetail, onRecord, onCreateBooking }: any) {
  const stages = [...p.stages].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  const ungrouped = p.sessions.filter((s: any) => !s.stageId);
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onAddStage}><Plus className="h-4 w-4" /> Thêm giai đoạn</Button>
          <Button size="sm" onClick={() => onAddSession(null)}><Plus className="h-4 w-4" /> Thêm buổi</Button>
        </div>
      )}
      {stages.map((st: any) => {
        const sess = p.sessions.filter((s: any) => s.stageId === st.id).sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);
        return (
          <StageCard key={st.id} stage={st} sessions={sess} canWrite={canWrite} nameOf={nameOf}
            onEdit={() => onEditStage(st)} onAddSession={() => onAddSession(st.id)}
            onDetail={onDetail} onRecord={onRecord} onCreateBooking={onCreateBooking} finance={p.canSeeFinance} />
        );
      })}
      {ungrouped.length > 0 && (
        <StageCard stage={{ name: "Chưa gán giai đoạn", status: null }} sessions={ungrouped} canWrite={canWrite} nameOf={nameOf}
          onEdit={null} onAddSession={() => onAddSession(null)} onDetail={onDetail} onRecord={onRecord} onCreateBooking={onCreateBooking} finance={p.canSeeFinance} />
      )}
      {stages.length === 0 && ungrouped.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Chưa có giai đoạn/buổi nào. {canWrite && "Bấm \"Thêm giai đoạn\" để bắt đầu."}</CardContent></Card>
      )}
    </div>
  );
}

function StageCard({ stage, sessions, canWrite, nameOf, onEdit, onAddSession, onDetail, onRecord, onCreateBooking, finance }: any) {
  const done = sessions.filter(isSessionDone).length;
  const freq = frequencyLabel(stage.frequencyValue, stage.frequencyUnit);
  const dateRange = stage.plannedStartDate || stage.plannedEndDate
    ? `${stage.plannedStartDate ? formatDate(stage.plannedStartDate) : "?"} – ${stage.plannedEndDate ? formatDate(stage.plannedEndDate) : "?"}`
    : null;
  // Trạng thái giai đoạn tự suy khi đủ buổi (mục 2); chỉ hiện cho giai đoạn thật (có id).
  const derivedStatus: string | null = stage.id ? deriveStageStatus(stage, sessions) : null;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{stage.name}</span>
              {derivedStatus && <Badge tone={STAGE_STATUS_TONE[derivedStatus]}>{STAGE_STATUS_LABEL[derivedStatus]}</Badge>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {dateRange && <span>{dateRange}</span>}
              {freq && <span>{dateRange ? " · " : ""}{freq}</span>}
              {stage.plannedSessions != null && <span> · KH {stage.plannedSessions} buổi</span>}
              <span> · Đã thực hiện {done}/{sessions.length || stage.plannedSessions || 0}</span>
            </div>
            {stage.description && <div className="mt-0.5 text-xs text-muted-foreground">Mục tiêu: {stage.description}</div>}
          </div>
          {canWrite && (
            <div className="flex gap-1">
              {onEdit && <Button variant="ghost" size="sm" onClick={onEdit}>Sửa giai đoạn</Button>}
              <Button variant="outline" size="sm" onClick={onAddSession}><Plus className="h-4 w-4" /> Buổi</Button>
            </div>
          )}
        </div>
        {sessions.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Chưa có buổi trong giai đoạn này.</div>
        ) : (
          <Table>
            <THead><TR>
              <TH>Buổi</TH><TH>Tên / mục tiêu</TH><TH>Dịch vụ (dự kiến)</TH><TH>Ngày dự kiến</TH>
              <TH>Lịch hẹn</TH><TH>Trạng thái</TH><TH></TH>
            </TR></THead>
            <TBody>
              {sessions.map((s: any) => {
                const ds = deriveSessionStatus(s, s.booking);
                const done = isSessionDone(s);
                const planDate = s.plannedDate ?? s.scheduledAt;
                return (
                  <TR key={s.id}>
                    <TD className="font-medium">#{s.sessionNumber}</TD>
                    <TD>{s.name ?? s.objective ?? "—"}</TD>
                    <TD>{nameOf("service", s.plannedServiceId ?? s.serviceId)}</TD>
                    <TD>{planDate ? formatDate(planDate) : "—"}</TD>
                    <TD>
                      {s.booking ? (
                        <span className="text-xs">{formatDateTime(s.booking.scheduledAt)}{s.booking.technician ? ` · ${s.booking.technician}` : ""}</span>
                      ) : <span className="text-xs text-muted-foreground">chưa có</span>}
                    </TD>
                    <TD><Badge tone={SESSION_STATUS_TONE[ds]}>{SESSION_STATUS_LABEL[ds]}</Badge></TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onDetail(s)}>{done ? "Xem kết quả" : "Chi tiết"}</Button>
                        {canWrite && !s.booking && !done && ds !== "CANCELLED" && ds !== "SKIPPED" && (
                          <Button size="sm" variant="outline" onClick={() => onCreateBooking(s)}>Tạo lịch hẹn</Button>
                        )}
                        {canWrite && (
                          <Button size="sm" variant="outline" onClick={() => onRecord(s)}>{done ? "Sửa ghi nhận" : "Ghi nhận"}</Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ===================== Timeline ===================== */
function TimelineTab({ stages, sessions }: any) {
  const withDates = [...stages].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  const dates = withDates.flatMap((s: any) => [s.plannedStartDate, s.plannedEndDate]).filter(Boolean).map((d: any) => new Date(d).getTime());
  const min = dates.length ? Math.min(...dates) : 0;
  const max = dates.length ? Math.max(...dates) : 0;
  const span = max - min || 1;
  return (
    <Card><CardContent className="space-y-3 p-5">
      {withDates.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giai đoạn để hiển thị timeline.</p>}
      {withDates.map((st: any) => {
        const done = sessions.filter((s: any) => s.stageId === st.id && isSessionDone(s)).length;
        const total = sessions.filter((s: any) => s.stageId === st.id).length || st.plannedSessions || 0;
        const hasRange = st.plannedStartDate && st.plannedEndDate && dates.length;
        const left = hasRange ? ((new Date(st.plannedStartDate).getTime() - min) / span) * 100 : 0;
        const width = hasRange ? Math.max(4, ((new Date(st.plannedEndDate).getTime() - new Date(st.plannedStartDate).getTime()) / span) * 100) : 100;
        return (
          <div key={st.id} className="text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{st.name}</span>
              <span className="text-xs text-muted-foreground">
                {st.plannedStartDate ? formatDate(st.plannedStartDate) : "?"} → {st.plannedEndDate ? formatDate(st.plannedEndDate) : "?"} · {done}/{total} buổi
              </span>
            </div>
            <div className="h-3 w-full rounded bg-muted">
              <div className="h-3 rounded bg-primary/70" style={{ marginLeft: `${left}%`, width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </CardContent></Card>
  );
}

/* ===================== Phiên bản ===================== */
function VersionsTab({ p, canWrite, onCreate }: any) {
  // Ưu tiên bảng versions; fallback changeLog (dữ liệu cũ).
  const rows: any[] = p.versions?.length
    ? p.versions
    : Array.isArray(p.changeLog)
    ? [...p.changeLog].reverse().map((c: any) => ({ fromVersion: c.fromVersion, toVersion: c.toVersion, reason: c.reason, createdBy: c.changedBy, createdAt: c.at, summary: c.summary }))
    : [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm">Phiên bản hiện tại: <b>V{p.version}</b></div>
        {canWrite && <Button variant="outline" size="sm" onClick={onCreate}><GitBranch className="h-4 w-4" /> Tạo phiên bản mới</Button>}
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <THead><TR><TH>Phiên bản</TH><TH>Ngày tạo</TH><TH>Người tạo</TH><TH>Lý do</TH><TH>Tóm tắt thay đổi</TH></TR></THead>
          <TBody>
            {rows.length === 0 ? (
              <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">Chưa có thay đổi phiên bản. Phác đồ đang ở V{p.version} (bản gốc).</TD></TR>
            ) : rows.map((r, i) => (
              <TR key={i}>
                <TD className="font-medium">V{r.fromVersion ?? "?"} → V{r.toVersion}</TD>
                <TD>{r.createdAt ? formatDateTime(r.createdAt) : "—"}</TD>
                <TD>{r.createdBy ?? "—"}</TD>
                <TD>{r.reason ?? "—"}</TD>
                <TD className="text-muted-foreground">{r.summary ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">Tạo phiên bản mới KHÔNG ghi đè bản cũ. Các buổi đã hoàn thành được ghim theo phiên bản tại thời điểm thực hiện — bản cũ giữ đúng lịch sử.</p>
    </div>
  );
}

/* ===================== Session detail: Kế hoạch vs Thực tế ===================== */
function SessionDetailModal({ session: s, canWrite, nameOf, onClose, onRecord, onForms, onMaterials, onCreateBooking }: any) {
  const rows = comparePlannedActual(s, nameOf, (d: any) => (d ? formatDate(d) : "—"));
  const ds = deriveSessionStatus(s, s.booking);
  return (
    <Modal open onClose={onClose} title={`Buổi #${s.sessionNumber}${s.name ? " · " + s.name : ""}`} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SESSION_STATUS_TONE[ds]}>{SESSION_STATUS_LABEL[ds]}</Badge>
          {s.stage?.name && <span className="text-muted-foreground">Giai đoạn: {s.stage.name}</span>}
          {s.versionAtExecution && <span className="text-muted-foreground">· Thực hiện ở V{s.versionAtExecution}</span>}
        </div>
        {s.objective && <div><span className="text-muted-foreground">Mục tiêu buổi: </span>{s.objective}</div>}

        {/* Liên kết lịch hẹn (mục 12) */}
        <div className="rounded-lg border p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lịch hẹn</div>
          {s.booking ? (
            <div className="space-y-0.5">
              <div>{formatDateTime(s.booking.scheduledAt)} · {SESSION_STATUS_LABEL[deriveSessionStatus(s, s.booking)] ?? s.booking.status}</div>
              <div className="text-xs text-muted-foreground">
                {s.booking.technician ? `KTV: ${s.booking.technician}` : ""}
                {s.booking.room ? ` · Phòng: ${s.booking.room}` : ""}
                {s.booking.machine ? ` · Máy: ${s.booking.machine}` : ""}
              </div>
              <Link href="/bookings" className="text-xs text-primary hover:underline">Xem lịch hẹn →</Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Buổi chưa có lịch hẹn.</span>
              {canWrite && ds !== "CANCELLED" && !isSessionDone(s) && <Button size="sm" variant="outline" onClick={() => onCreateBooking(s)}>Tạo lịch hẹn</Button>}
            </div>
          )}
        </div>

        {/* Kế hoạch vs Thực tế (mục 14–15) */}
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Hạng mục</div><div>Kế hoạch</div><div>Thực tế</div>
          </div>
          {rows.map((r) => (
            <div key={r.label} className={`grid grid-cols-3 border-t px-3 py-2 ${r.differs ? "bg-amber-50" : ""}`}>
              <div className="text-muted-foreground">{r.label}</div>
              <div>{r.planned}</div>
              <div className={r.differs ? "font-medium text-amber-700" : ""}>{r.actual}{r.differs && <span className="ml-1 text-[10px] text-amber-600">(khác KH)</span>}</div>
            </div>
          ))}
        </div>

        {(s.conditionBefore || s.conditionAfter || s.customerFeedback) && (
          <div className="rounded-lg border p-3 text-xs">
            {s.conditionBefore && <div><span className="text-muted-foreground">Tình trạng trước: </span>{s.conditionBefore}</div>}
            {s.conditionAfter && <div><span className="text-muted-foreground">Tình trạng sau: </span>{s.conditionAfter}</div>}
            {s.customerFeedback && <div><span className="text-muted-foreground">Phản hồi khách: </span>{s.customerFeedback}</div>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={() => onForms(s)}>Phiếu</Button>
          <Button variant="ghost" size="sm" onClick={() => onMaterials(s)}>Vật tư</Button>
          {canWrite && <Button size="sm" onClick={() => onRecord(s)}>{isSessionDone(s) ? "Sửa ghi nhận" : "Ghi nhận lần thực hiện"}</Button>}
          <Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ===================== Stage modal (thêm/sửa) ===================== */
function StageModal({ title, stage, onClose, onSubmit }: any) {
  const [f, setF] = useState<any>({
    name: stage?.name ?? "",
    description: stage?.description ?? "",
    status: stage?.status ?? "PENDING",
    plannedStartDate: stage?.plannedStartDate ? String(stage.plannedStartDate).slice(0, 10) : "",
    plannedEndDate: stage?.plannedEndDate ? String(stage.plannedEndDate).slice(0, 10) : "",
    plannedSessions: stage?.plannedSessions ?? "",
    frequencyValue: stage?.frequencyValue ?? "",
    frequencyUnit: stage?.frequencyUnit ?? "DAY",
    note: stage?.note ?? "",
  });
  return (
    <Modal open onClose={onClose} title={title} className="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const b: any = {
            name: f.name,
            description: f.description || null,
            status: f.status,
            plannedStartDate: f.plannedStartDate || null,
            plannedEndDate: f.plannedEndDate || null,
            plannedSessions: f.plannedSessions ? Number(f.plannedSessions) : null,
            frequencyValue: f.frequencyValue ? Number(f.frequencyValue) : null,
            frequencyUnit: f.frequencyValue ? f.frequencyUnit : null,
            note: f.note || null,
          };
          onSubmit(b);
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5"><Label>Tên giai đoạn *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="VD: Chuẩn bị / Can thiệp / Phục hồi / Duy trì" /></div>
        <div className="space-y-1.5"><Label>Mục tiêu giai đoạn</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Ngày bắt đầu dự kiến</Label><Input type="date" value={f.plannedStartDate} onChange={(e) => setF({ ...f, plannedStartDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Ngày kết thúc dự kiến</Label><Input type="date" value={f.plannedEndDate} onChange={(e) => setF({ ...f, plannedEndDate: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Số buổi dự kiến</Label><Input type="number" value={f.plannedSessions} onChange={(e) => setF({ ...f, plannedSessions: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tần suất (mỗi)</Label><Input type="number" value={f.frequencyValue} onChange={(e) => setF({ ...f, frequencyValue: e.target.value })} placeholder="VD: 7" /></div>
          <div className="space-y-1.5"><Label>Đơn vị</Label>
            <Select value={f.frequencyUnit} onChange={(e) => setF({ ...f, frequencyUnit: e.target.value })}>
              {FREQ_UNITS.map((u) => <option key={u} value={u}>{FREQUENCY_UNIT_LABEL[u]}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Trạng thái</Label>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {STAGE_STATUSES.map((s) => <option key={s} value={s}>{STAGE_STATUS_LABEL[s]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

/* ===================== Version modal ===================== */
function VersionModal({ currentVersion, onClose, onSubmit }: any) {
  const [f, setF] = useState({ reason: "", summary: "", note: "" });
  return (
    <Modal open onClose={onClose} title={`Tạo phiên bản mới (V${currentVersion} → V${currentVersion + 1})`} className="max-w-lg">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ reason: f.reason, summary: f.summary || null, note: f.note || null }); }} className="space-y-3">
        <div className="space-y-1.5"><Label>Lý do thay đổi *</Label><textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required placeholder="VD: Khách đáp ứng chậm hơn dự kiến, cần kéo dài giai đoạn phục hồi." /></div>
        <div className="space-y-1.5"><Label>Tóm tắt thay đổi</Label><Input value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="VD: Thêm 1 buổi phục hồi; đổi Protocol buổi 4" /></div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Bản cũ được giữ nguyên; các buổi đã hoàn thành được ghim theo phiên bản hiện tại. Sau khi tạo, hãy chỉnh kế hoạch (giai đoạn/buổi) cho phiên bản mới.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Tạo phiên bản</Button></div>
      </form>
    </Modal>
  );
}

/* ===================== Add session (giữ nguyên, bổ sung ngày dự kiến + khoảng cách) ===================== */
function AddSessionModal({ open, onClose, onSubmit, error, stages, services, technologies, protocols, nextNumber, defaultStageId }: any) {
  const empty = { sessionNumber: nextNumber, name: "", stageId: "", serviceId: "", technologyId: "", brandProtocolId: "", objective: "", plannedDate: "", intervalDays: "", plannedCost: "", price: "", preCare: "", postCare: "", professionalProductsText: "" };
  const [f, setF] = useState<any>(empty);
  const [steps, setSteps] = useState<string[]>([]);
  const [allowOutside, setAllowOutside] = useState(false);
  useEffect(() => { setF((p: any) => ({ ...p, sessionNumber: nextNumber, stageId: defaultStageId ?? "" })); setAllowOutside(false); }, [nextNumber, open, defaultStageId]);
  // Kiểm tra ngày buổi có nằm trong khoảng thời gian của giai đoạn (mục 3).
  const selStage = stages.find((s: any) => s.id === f.stageId) ?? null;
  const outOfRange = isSessionDateInStage(f.plannedDate, selStage) === false;
  return (
    <Modal open={open} onClose={onClose} title="Thêm buổi dự kiến" className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (outOfRange && !allowOutside) return; // chặn cho tới khi xác nhận
          const b: any = { ...f, sessionNumber: Number(f.sessionNumber) };
          ["stageId", "serviceId", "technologyId", "brandProtocolId", "name", "objective", "plannedDate", "preCare", "postCare"].forEach((k) => { if (!b[k]) delete b[k]; });
          b.plannedCost = f.plannedCost ? Number(f.plannedCost) : undefined;
          b.price = f.price ? Number(f.price) : undefined;
          b.intervalDays = f.intervalDays ? Number(f.intervalDays) : undefined;
          const stepItems = steps.filter(Boolean);
          if (stepItems.length) b.steps = { items: stepItems.map((name) => ({ name })) };
          if (f.professionalProductsText) b.professionalProducts = { text: f.professionalProductsText };
          delete b.professionalProductsText;
          onSubmit(b);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Buổi số *</Label><Input type="number" value={f.sessionNumber} onChange={(e) => setF({ ...f, sessionNumber: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Tên buổi</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Giai đoạn</Label>
            <Select value={f.stageId} onChange={(e) => setF({ ...f, stageId: e.target.value })}>
              <option value="">—</option>
              {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Dịch vụ dự kiến</Label>
            <Select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
              <option value="">—</option>
              {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Công nghệ dự kiến</Label>
            <Select value={f.technologyId} onChange={(e) => setF({ ...f, technologyId: e.target.value })}>
              <option value="">—</option>
              {(technologies ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Protocol dự kiến</Label>
            <Select value={f.brandProtocolId} onChange={(e) => setF({ ...f, brandProtocolId: e.target.value })}>
              <option value="">—</option>
              {(protocols ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Mục tiêu buổi</Label><Input value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Các bước dự kiến</Label>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-5 pt-2 text-sm text-muted-foreground">{i + 1}.</span>
              <Input value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button type="button" variant="outline" size="sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, ""])}>+ Bước</Button>
        </div>
        <div className="space-y-1.5"><Label>Vật tư dự kiến / sản phẩm chuyên nghiệp</Label><Input value={f.professionalProductsText} onChange={(e) => setF({ ...f, professionalProductsText: e.target.value })} placeholder="VD: DMK Enzyme, serum..." /></div>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1.5"><Label>Ngày dự kiến</Label><Input type="date" value={f.plannedDate} onChange={(e) => setF({ ...f, plannedDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Cách buổi trước (ngày)</Label><Input type="number" value={f.intervalDays} onChange={(e) => setF({ ...f, intervalDays: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Chi phí dự kiến</Label><Input type="number" value={f.plannedCost} onChange={(e) => setF({ ...f, plannedCost: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Giá dự kiến</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        </div>
        {outOfRange && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div>⚠ Ngày dự kiến <b>{f.plannedDate ? formatDate(f.plannedDate) : ""}</b> nằm <b>ngoài khoảng</b> giai đoạn &quot;{selStage?.name}&quot; ({selStage?.plannedStartDate ? formatDate(selStage.plannedStartDate) : "?"} – {selStage?.plannedEndDate ? formatDate(selStage.plannedEndDate) : "?"}).</div>
            <label className="mt-1 flex items-center gap-1.5"><Checkbox checked={allowOutside} onChange={(e) => setAllowOutside(e.target.checked)} /> Vẫn lưu dù ngoài khoảng giai đoạn</label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Dặn dò trước</Label><Input value={f.preCare} onChange={(e) => setF({ ...f, preCare: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Dặn dò sau</Label><Input value={f.postCare} onChange={(e) => setF({ ...f, postCare: e.target.value })} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={outOfRange && !allowOutside}>Lưu</Button></div>
      </form>
    </Modal>
  );
}

/* ===================== Record session (giữ nguyên) ===================== */
function RecordSessionModal({ session, onClose, onSubmit, error, canFinance, canShare, canMaterial, canWrite }: any) {
  const [f, setF] = useState<any>({
    status: session.status,
    performer: session.performer ?? "",
    conditionBefore: session.conditionBefore ?? "",
    conditionAfter: session.conditionAfter ?? "",
    actualParamsText: paramsToText(session.actualParams),
    actualMaterialsText: paramsToText(session.actualMaterials),
    beforeImages: session.beforeImages ?? [],
    afterImages: session.afterImages ?? [],
    customerFeedback: session.customerFeedback ?? "",
    postCare: session.postCare ?? "",
    actualCost: session.actualCost ?? "",
    note: session.note ?? "",
  });
  return (
    <Modal open onClose={onClose} title={`Ghi nhận buổi #${session.sessionNumber}`} className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const b: any = {
            status: f.status,
            performer: f.performer || undefined,
            conditionBefore: f.conditionBefore || undefined,
            conditionAfter: f.conditionAfter || undefined,
            customerFeedback: f.customerFeedback || undefined,
            postCare: f.postCare || undefined,
            note: f.note || undefined,
            beforeImages: f.beforeImages,
            afterImages: f.afterImages,
          };
          if (f.actualParamsText) b.actualParams = { text: f.actualParamsText };
          if (f.actualMaterialsText) b.actualMaterials = { text: f.actualMaterialsText };
          if (canFinance && f.actualCost) b.actualCost = Number(f.actualCost);
          onSubmit(b);
        }}
        className="space-y-4"
      >
        <p className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Đây là dữ liệu <b>THỰC TẾ</b> của buổi — không ghi đè kế hoạch. Xem đối chiếu Kế hoạch/Thực tế ở nút &quot;Chi tiết&quot;.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Trạng thái</Label>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {SESSION_STATUSES.map((s) => <option key={s} value={s}>{SESSION_STATUS_LABEL[s]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Người thực hiện</Label><Input value={f.performer} onChange={(e) => setF({ ...f, performer: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Thông số thực tế</Label><Input value={f.actualParamsText} onChange={(e) => setF({ ...f, actualParamsText: e.target.value })} placeholder="VD: mức năng lượng 3.0J..." /></div>
          <div className="space-y-1.5"><Label>Vật tư thực tế</Label><Input value={f.actualMaterialsText} onChange={(e) => setF({ ...f, actualMaterialsText: e.target.value })} placeholder="VD: 2 mặt nạ, 1 serum..." /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tình trạng trước</Label><Input value={f.conditionBefore} onChange={(e) => setF({ ...f, conditionBefore: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tình trạng sau</Label><Input value={f.conditionAfter} onChange={(e) => setF({ ...f, conditionAfter: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Ảnh trước</Label>
            <MediaUpload kind="BEFORE_IMAGE" customerId={session.customerId} sessionId={session.id} value={f.beforeImages} onChange={(ids) => setF({ ...f, beforeImages: ids })} />
          </div>
          <div className="space-y-1.5"><Label>Ảnh sau</Label>
            <MediaUpload kind="AFTER_IMAGE" customerId={session.customerId} sessionId={session.id} value={f.afterImages} onChange={(ids) => setF({ ...f, afterImages: ids })} />
          </div>
        </div>
        {session.id && (
          <div className="space-y-1.5">
            <Label>Chia sẻ ảnh cho khách (Cổng khách)</Label>
            <p className="text-[11px] text-muted-foreground">Mặc định ảnh là RIÊNG TƯ. Chỉ ảnh được bật &quot;Khách thấy&quot; mới hiển thị trên Cổng khách hàng.</p>
            <SessionMediaShare sessionId={session.id} canShare={canShare} />
          </div>
        )}
        {session.id && (
          <div className="space-y-1.5">
            <Label>Vật tư sử dụng trong buổi</Label>
            <p className="text-[11px] text-muted-foreground">Chọn nguồn (Kho vật tư sử dụng hoặc Vật tư khách hàng) → chọn lọ/vật tư → nhập số lượng thực dùng. Hệ thống trừ tồn còn lại và cộng chi phí buổi.</p>
            <SpaMaterialConsume sessionId={session.id} customerId={session.customerId} canWrite={canMaterial} />
          </div>
        )}
        {session.id && (
          <div className="space-y-1.5">
            <Label>Nhân sự thực hiện buổi</Label>
            <p className="text-[11px] text-muted-foreground">Phân công đa vai trò (chính/hỗ trợ/master/kiểm tra/tư vấn) kèm phí. Nhân sự &amp; phí lưu theo buổi, thể hiện trong hồ sơ khách.</p>
            <SessionStaff sessionId={session.id} canWrite={canWrite} />
          </div>
        )}
        {session.id && (
          <div className="space-y-1.5">
            <Label>Đánh giá &amp; báo cáo sau buổi</Label>
            <p className="text-[11px] text-muted-foreground">Khách chấm hài lòng + đánh giá kỹ thuật viên; kèm báo cáo chuyên môn của KTV. Lưu độc lập với nút Lưu chính.</p>
            <SessionReview sessionId={session.id} canWrite={canWrite} defaultTechnician={session.performer ?? ""} />
          </div>
        )}
        <div className="space-y-1.5"><Label>Phản hồi của khách</Label><Input value={f.customerFeedback} onChange={(e) => setF({ ...f, customerFeedback: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Dặn dò sau</Label><Input value={f.postCare} onChange={(e) => setF({ ...f, postCare: e.target.value })} /></div>
          {canFinance && <div className="space-y-1.5"><Label>Chi phí thực tế (₫)</Label><Input type="number" value={f.actualCost} onChange={(e) => setF({ ...f, actualCost: e.target.value })} /></div>}
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

const MOVE_TYPES: { t: string; label: string }[] = [
  { t: "RESERVE", label: "Giữ" },
  { t: "ISSUE", label: "Xuất" },
  { t: "CONSUME", label: "Tiêu hao" },
  { t: "RETURN", label: "Hoàn" },
  { t: "WASTE", label: "Hao" },
];

function MaterialsModal({ session, materials, spaProducts, lots, error, canFinance, canWrite, onClose, onAdd, onMove, onDelete }: any) {
  const [f, setF] = useState<any>({ name: "", spaProductId: "", lotId: "", isProfessional: false, plannedQty: "1", uom: "", unitCost: "" });
  const [moveQty, setMoveQty] = useState<Record<string, string>>({});
  const totalCost = materials.reduce((s: number, m: any) => s + Number(m.consumedQty || 0) * Number(m.unitCost || 0), 0);
  function pickProduct(pid: string) {
    const sp = spaProducts.find((x: any) => x.id === pid);
    setF((prev: any) => ({ ...prev, spaProductId: pid, ...(sp ? { name: sp.name, isProfessional: sp.productType !== "HOME_CARE", unitCost: sp.cost != null ? String(sp.cost) : prev.unitCost } : {}) }));
  }
  function pickLot(lid: string) {
    const lot = (lots ?? []).find((x: any) => x.id === lid);
    setF((prev: any) => ({ ...prev, lotId: lid, ...(lot ? { name: lot.productName, uom: lot.uom ?? prev.uom } : {}) }));
  }
  return (
    <Modal open onClose={onClose} title={`Vật tư buổi #${session.sessionNumber}`} className="max-w-3xl">
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr><th className="p-1.5 text-left">Vật tư</th><th>Kho/Lô</th><th>ĐVT</th><th>KH</th><th>Giữ</th><th>Xuất</th><th>Tiêu hao</th><th>Hao</th>{canFinance && <th>Giá vốn</th>}{canWrite && <th>Ghi biến động</th>}</tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr><td colSpan={canFinance ? 10 : 9} className="p-3 text-center text-muted-foreground">Chưa có vật tư</td></tr>
              ) : materials.map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="p-1.5">{m.name}{m.isProfessional && <span className="ml-1 text-[10px] text-amber-600">(CN)</span>}</td>
                  <td className="text-center">{m.lotId ? <span className="text-[10px] text-emerald-600">Kho</span> : <span className="text-[10px] text-muted-foreground">—</span>}</td>
                  <td className="text-center">{m.uom ?? "—"}</td>
                  <td className="text-center">{Number(m.plannedQty)}</td>
                  <td className="text-center">{Number(m.reservedQty)}</td>
                  <td className="text-center">{Number(m.issuedQty)}</td>
                  <td className="text-center font-medium">{Number(m.consumedQty)}</td>
                  <td className="text-center">{Number(m.wasteQty)}</td>
                  {canFinance && <td className="text-center">{m.unitCost != null ? formatNumber(Number(m.unitCost)) : "—"}</td>}
                  {canWrite && (
                    <td className="p-1">
                      <div className="flex items-center gap-1">
                        <Input className="h-7 w-14 text-xs" type="number" placeholder="SL" value={moveQty[m.id] ?? ""} onChange={(e) => setMoveQty({ ...moveQty, [m.id]: e.target.value })} />
                        {MOVE_TYPES.map((mt) => (
                          <button key={mt.t} type="button" onClick={() => { const q = Number(moveQty[m.id]); if (q > 0) onMove(m.id, mt.t, q); }} className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-accent">{mt.label}</button>
                        ))}
                        {Number(m.consumedQty) === 0 && <button type="button" onClick={() => onDelete(m.id)} className="text-muted-foreground hover:text-destructive">×</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canFinance && <div className="text-right text-sm">Chi phí vật tư tiêu hao: <span className="font-semibold">{formatNumber(totalCost)} ₫</span></div>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {canWrite && (
          <form onSubmit={(e) => { e.preventDefault(); const b: any = { name: f.name, isProfessional: f.isProfessional, plannedQty: Number(f.plannedQty || 0), uom: f.uom || undefined, spaProductId: f.spaProductId || undefined, lotId: f.lotId || undefined, unitCost: f.unitCost ? Number(f.unitCost) : undefined }; onAdd(b); setF({ name: "", spaProductId: "", lotId: "", isProfessional: false, plannedQty: "1", uom: "", unitCost: "" }); }} className="space-y-2 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground">Thêm vật tư / sản phẩm chuyên nghiệp</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select className="h-8 text-xs" value={f.lotId} onChange={(e) => pickLot(e.target.value)}>
                <option value="">— Lô kho (trừ tồn thật) —</option>
                {(lots ?? []).map((lot: any) => <option key={lot.id} value={lot.id}>{lot.productName} · {lot.warehouse} · KD {lot.available}</option>)}
              </Select>
              <Select className="h-8 text-xs" value={f.spaProductId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">— SP catalog —</option>
                {spaProducts.map((sp: any) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </Select>
              <Input className="h-8 text-xs" placeholder="Tên vật tư *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
              <Input className="h-8 text-xs" type="number" placeholder="SL kế hoạch" value={f.plannedQty} onChange={(e) => setF({ ...f, plannedQty: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Input className="h-8 w-20 text-xs" placeholder="ĐVT" value={f.uom} onChange={(e) => setF({ ...f, uom: e.target.value })} />
              {canFinance && <Input className="h-8 w-36 text-xs" type="number" placeholder="Giá vốn/đv" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />}
              <label className="flex items-center gap-1 text-xs"><Checkbox checked={f.isProfessional} onChange={(e) => setF({ ...f, isProfessional: e.target.checked })} /> SP chuyên nghiệp</label>
              <Button type="submit" size="sm" className="ml-auto">Thêm</Button>
            </div>
          </form>
        )}
        <p className="text-[11px] text-muted-foreground">Gắn <b>Lô kho</b> để trừ tồn thật (Giữ→Xuất→Tiêu hao); không gắn lô = chỉ tính chi phí. Tiêu hao cộng vào chi phí thật của buổi.</p>
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Đóng</Button></div>
      </div>
    </Modal>
  );
}

function paramsToText(v: any): string {
  if (!v) return "";
  if (typeof v === "object" && "text" in v) return String(v.text);
  return JSON.stringify(v);
}
