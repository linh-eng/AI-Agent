"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, CheckCircle2, Pencil, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime, mediaSrc } from "@/lib/utils";
import { MediaUpload } from "@/components/media-upload";
import { SessionMediaShare } from "@/components/session-media-share";
import { SpaMaterialConsume } from "@/components/spa-material-consume";
import { SessionExecutions } from "@/components/session-executions";
import { SessionStaff } from "@/components/session-staff";
import { SessionContributions } from "@/components/session-contributions";
import { SessionReview } from "@/components/session-review";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { SESSION_STATUS_LABEL, SESSION_STATUS_TONE } from "@/lib/clinic-labels";
import { deriveSessionStatus, comparePlannedActual, isSessionDone } from "@/lib/treatment-plan";

interface Opt { id: string; name: string }

function txt(v: any): string {
  if (!v) return "";
  if (typeof v === "object" && "text" in v) return String(v.text ?? "");
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Nhãn khối */
function Block({ letter, title, children, hint }: { letter: string; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">{letter}</span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {hint && <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>}
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Field: input khi edit, text khi read-only */
function F({ label, value, onChange, edit, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {edit ? (
        <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <div className="min-h-[20px] text-sm">{value ? (type === "date" ? formatDate(value) : value) : <span className="text-muted-foreground">—</span>}</div>
      )}
    </div>
  );
}

export default function SessionExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const canEditCompleted = useCan(PERMISSIONS.TREATMENT_EDIT_COMPLETED);
  const canMedia = useCan(PERMISSIONS.MEDIA_WRITE);
  const canMaterial = useCan(PERMISSIONS.MATERIAL_WRITE);

  const [s, setS] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Opt[]>([]);
  const [technologies, setTechnologies] = useState<Opt[]>([]);
  const [protocols, setProtocols] = useState<Opt[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [sessionForms, setSessionForms] = useState<any[]>([]);
  const [careTemplates, setCareTemplates] = useState<any[]>([]);
  const [careInstances, setCareInstances] = useState<any[]>([]);
  const [edit, setEdit] = useState(false); // đang bật chế độ sửa (cho buổi đã hoàn thành)
  const [editReason, setEditReason] = useState("");
  const [f, setF] = useState<any>({});
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const seed = useCallback((sess: any) => {
    setF({
      serviceId: sess.serviceId ?? "", technologyId: sess.technologyId ?? "", brandProtocolId: sess.brandProtocolId ?? "",
      treatmentArea: sess.treatmentArea ?? "", actualParamsText: txt(sess.actualParams), actualMaterialsText: txt(sess.actualMaterials),
      actualStartAt: sess.actualStartAt ? String(sess.actualStartAt).slice(0, 16) : "", actualEndAt: sess.actualEndAt ? String(sess.actualEndAt).slice(0, 16) : "",
      conditionBefore: sess.conditionBefore ?? "", prevReaction: sess.prevReaction ?? "", todayWish: sess.todayWish ?? "",
      contraindications: sess.contraindications ?? "", warnings: sess.warnings ?? "", currentMeds: sess.currentMeds ?? "",
      conditionAfter: sess.conditionAfter ?? "", incident: sess.incident ?? "", handledAction: sess.handledAction ?? "",
      customerFeedback: sess.customerFeedback ?? "", postCare: sess.postCare ?? "", nextSuggestion: sess.nextSuggestion ?? "",
      followUpDate: sess.followUpDate ? String(sess.followUpDate).slice(0, 10) : "",
      performer: sess.performer ?? "", note: sess.note ?? "",
      beforeImages: sess.beforeImages ?? [], afterImages: sess.afterImages ?? [],
    });
    setSteps(Array.isArray(sess.steps?.items) ? sess.steps.items.map((x: any) => x.name ?? "") : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await apiFetch<any>(`/api/treatment-sessions/${id}`);
      setS(sess); seed(sess);
    } finally { setLoading(false); }
  }, [id, seed]);

  useEffect(() => {
    load();
    apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {});
    apiFetch<Opt[]>("/api/technologies").then(setTechnologies).catch(() => {});
    apiFetch<any[]>("/api/brand-protocols").then(setProtocols).catch(() => {});
    apiFetch<any[]>("/api/form-templates").then(setFormTemplates).catch(() => {});
    apiFetch<any[]>(`/api/form-instances?sessionId=${id}`).then(setSessionForms).catch(() => {});
  }, [load, id]);

  // Gợi ý hướng dẫn chăm sóc theo dịch vụ/protocol (mục 23) — tải khi biết session.
  useEffect(() => {
    if (!s) return;
    const q = new URLSearchParams({ kind: "POST_CARE", status: "ACTIVE" });
    if (s.serviceId) q.set("serviceId", s.serviceId);
    apiFetch<any[]>(`/api/care-instructions?${q.toString()}`).then(setCareTemplates).catch(() => {});
    apiFetch<any[]>(`/api/care-instances?customerId=${s.customerId}`).then((r) => setCareInstances(r.filter((x: any) => x.sessionId === id))).catch(() => {});
  }, [s, id]);

  const nameOf = useCallback((kind: "service" | "technology" | "protocol", tid?: string | null) => {
    if (!tid) return "—";
    const list = kind === "service" ? services : kind === "technology" ? technologies : protocols;
    return list.find((x) => x.id === tid)?.name ?? "—";
  }, [services, technologies, protocols]);

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!s) return <p className="text-destructive">Không tìm thấy lần thực hiện.</p>;

  const completed = s.status === "COMPLETED";
  const editable = canWrite && (!completed || edit); // được sửa field khi chưa hoàn thành, hoặc đã bật "Sửa ghi nhận"
  const ds = deriveSessionStatus(s, s.booking);

  function buildBody(extra: Record<string, any> = {}) {
    const b: any = {
      serviceId: f.serviceId || null, technologyId: f.technologyId || null, brandProtocolId: f.brandProtocolId || null,
      treatmentArea: f.treatmentArea || null, treatmentAreaTouched: undefined,
      actualStartAt: f.actualStartAt || null, actualEndAt: f.actualEndAt || null,
      conditionBefore: f.conditionBefore || null, prevReaction: f.prevReaction || null, todayWish: f.todayWish || null,
      contraindications: f.contraindications || null, warnings: f.warnings || null, currentMeds: f.currentMeds || null,
      conditionAfter: f.conditionAfter || null, incident: f.incident || null, handledAction: f.handledAction || null,
      customerFeedback: f.customerFeedback || null, postCare: f.postCare || null, nextSuggestion: f.nextSuggestion || null,
      followUpDate: f.followUpDate || null, performer: f.performer || null, note: f.note || null,
      beforeImages: f.beforeImages, afterImages: f.afterImages,
      ...extra,
    };
    if (f.actualParamsText) b.actualParams = { text: f.actualParamsText }; else b.actualParams = null;
    if (f.actualMaterialsText) b.actualMaterials = { text: f.actualMaterialsText }; else b.actualMaterials = null;
    const items = steps.filter(Boolean);
    if (items.length) b.steps = { items: items.map((name) => ({ name })) };
    if (completed && editReason) b.editReason = editReason;
    delete b.treatmentAreaTouched;
    return b;
  }

  async function save(extra: Record<string, any> = {}, opts: { successMsg?: string } = {}) {
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/treatment-sessions/${id}`, { method: "PATCH", body: JSON.stringify(buildBody(extra)) });
      setEdit(false); setEditReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu");
    } finally { setSaving(false); }
  }

  async function attachForm(templateId: string) {
    await apiFetch("/api/form-instances", { method: "POST", body: JSON.stringify({ templateId, sessionId: id, customerId: s.customerId, planId: s.planId }) }).catch(() => {});
    setSessionForms(await apiFetch<any[]>(`/api/form-instances?sessionId=${id}`).catch(() => []));
  }
  async function attachCare(tpl: any) {
    await apiFetch("/api/care-instances", { method: "POST", body: JSON.stringify({ templateId: tpl.id, kind: tpl.kind, title: tpl.title, content: tpl.content, customerId: s.customerId, sessionId: id }) }).catch(() => {});
    apiFetch<any[]>(`/api/care-instances?customerId=${s.customerId}`).then((r) => setCareInstances(r.filter((x: any) => x.sessionId === id))).catch(() => {});
  }
  async function createFollowUp() {
    const due = f.followUpDate || null;
    await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ title: `Follow-up sau buổi ${s.sessionNumber}${s.service ? " · " + s.service.name : ""}`, customerId: s.customerId, planId: s.planId, sessionId: id, dueDate: due, priority: "NORMAL" }) }).catch((e) => setError(e.message));
    alert("Đã tạo việc follow-up trong danh sách Công việc.");
  }

  const pva = comparePlannedActual(s, nameOf, (d: any) => (d ? formatDate(d) : "—"));
  const hasWarning = !!(f.contraindications || f.warnings || s.brandProtocol?.contraindications);

  return (
    <div className="pb-10">
      <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>
      <PageHeader
        title={`Lần thực hiện ${s.code ?? "#" + s.sessionNumber}`}
        description={`${s.customer?.fullName ?? ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SESSION_STATUS_TONE[ds]}>{SESSION_STATUS_LABEL[ds]}</Badge>
            {canWrite && (s.status === "PLANNED" || ds === "SCHEDULED" || ds === "ARRIVED") && (
              <Button variant="outline" onClick={() => save({ status: "IN_PROGRESS", actualStartAt: f.actualStartAt || new Date().toISOString().slice(0, 16) }, {})}><Play className="h-4 w-4" /> Bắt đầu thực hiện</Button>
            )}
            {canWrite && s.status === "IN_PROGRESS" && (
              <Button onClick={() => save({ status: "COMPLETED" })}><CheckCircle2 className="h-4 w-4" /> Hoàn thành buổi</Button>
            )}
            {completed && canEditCompleted && !edit && (
              <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Sửa ghi nhận</Button>
            )}
          </div>
        }
      />

      {completed && !edit && (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Buổi đã <b>Hoàn thành</b> — dữ liệu ở chế độ chỉ xem. {canEditCompleted ? "Bấm \"Sửa ghi nhận\" (cần nhập lý do, có lưu vết) để chỉnh." : "Bạn không có quyền sửa buổi đã hoàn thành."}
        </div>
      )}
      {edit && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1.5">
          <div>⚠ Đang sửa buổi đã hoàn thành — bắt buộc nhập <b>lý do</b>; thay đổi sẽ được lưu vết (ai/khi/field).</div>
          <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Lý do sửa..." />
        </div>
      )}

      <div className="space-y-4">
        {/* A — Thông tin buổi */}
        <Block letter="A" title="Thông tin buổi">
          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Khách hàng" value={<Link className="text-primary hover:underline" href={`/customers/${s.customerId}`}>{s.customer?.fullName} ({s.customer?.code})</Link>} />
            <Info label="Dịch vụ dự kiến" value={nameOf("service", s.plannedServiceId ?? s.serviceId)} />
            <Info label="Phác đồ" value={s.plan ? <Link className="text-primary hover:underline" href={`/treatment-plans/${s.plan.id}`}>{s.plan.name} (v{s.plan.version})</Link> : "—"} />
            <Info label="Giai đoạn" value={s.stage?.name ?? "—"} />
            <Info label="Buổi số" value={`#${s.sessionNumber}`} />
            <Info label="Version thực hiện" value={s.versionAtExecution ? `V${s.versionAtExecution}` : "—"} />
            <Info label="Lịch hẹn" value={s.booking ? `${s.booking.code ?? ""} · ${formatDateTime(s.booking.scheduledAt)}` : "Chưa gắn lịch hẹn"} />
            <Info label="Ngày dự kiến" value={s.plannedDate ? formatDate(s.plannedDate) : "—"} />
            <Info label="KTV dự kiến" value={s.booking?.technician ?? "—"} />
            <Info label="Bắt đầu thực tế" value={s.actualStartAt ? formatDateTime(s.actualStartAt) : "—"} />
            <Info label="Kết thúc thực tế" value={s.actualEndAt ? formatDateTime(s.actualEndAt) : (s.performedAt ? formatDateTime(s.performedAt) : "—")} />
            <Info label="Trạng thái" value={<Badge tone={SESSION_STATUS_TONE[ds]}>{SESSION_STATUS_LABEL[ds]}</Badge>} />
          </div>
        </Block>

        {/* B — Trước khi thực hiện */}
        <Block letter="B" title="Trước khi thực hiện" hint="Không bắt buộc mọi trường; thông số chuyên môn nền do Biểu mẫu/Protocol quyết định (khối C).">
          {hasWarning && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <b>Cảnh báo trước khi thực hiện:</b>
                {f.contraindications && <div>• Chống chỉ định: {f.contraindications}</div>}
                {f.warnings && <div>• Cảnh báo: {f.warnings}</div>}
                {s.brandProtocol?.contraindications && <div>• Chống chỉ định của Protocol: {s.brandProtocol.contraindications}</div>}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Tình trạng hiện tại" value={f.conditionBefore} edit={editable} onChange={(v: string) => setF({ ...f, conditionBefore: v })} />
            <F label="Phản ứng sau buổi trước" value={f.prevReaction} edit={editable} onChange={(v: string) => setF({ ...f, prevReaction: v })} />
            <F label="Mong muốn hôm nay" value={f.todayWish} edit={editable} onChange={(v: string) => setF({ ...f, todayWish: v })} />
            <F label="Thuốc/sản phẩm đang dùng" value={f.currentMeds} edit={editable} onChange={(v: string) => setF({ ...f, currentMeds: v })} />
            <F label="Chống chỉ định" value={f.contraindications} edit={editable} onChange={(v: string) => setF({ ...f, contraindications: v })} />
            <F label="Cảnh báo chuyên môn/nguy cơ" value={f.warnings} edit={editable} onChange={(v: string) => setF({ ...f, warnings: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Ảnh Before</Label>
            <MediaUpload kind="BEFORE_IMAGE" customerId={s.customerId} sessionId={id} value={f.beforeImages} onChange={(ids) => setF({ ...f, beforeImages: ids })} disabled={!editable} />
          </div>
        </Block>

        {/* C — Thực hiện thực tế */}
        <Block letter="C" title="Thực hiện thực tế" hint="Ghi dữ liệu THỰC TẾ — không ghi đè kế hoạch. Form chuyên môn tùy Protocol/Công nghệ ở phần Biểu mẫu bên dưới.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Dịch vụ thực tế</Label>
              {editable ? <Select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">—</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select> : <div className="text-sm">{nameOf("service", f.serviceId)}</div>}
            </div>
            <div className="space-y-1.5"><Label>Công nghệ thực tế</Label>
              {editable ? <Select value={f.technologyId} onChange={(e) => setF({ ...f, technologyId: e.target.value })}><option value="">—</option>{technologies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select> : <div className="text-sm">{nameOf("technology", f.technologyId)}</div>}
            </div>
            <div className="space-y-1.5"><Label>Protocol thực tế</Label>
              {editable ? <Select value={f.brandProtocolId} onChange={(e) => setF({ ...f, brandProtocolId: e.target.value })}><option value="">—</option>{protocols.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select> : <div className="text-sm">{nameOf("protocol", f.brandProtocolId)}</div>}
            </div>
          </div>

          {/* Redesign P4 — dịch vụ thực tế đã làm (execution items) + phương án + đông cứng snapshot */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dịch vụ thực hiện thực tế · phương án · snapshot</div>
            <SessionExecutions sessionId={id} canWrite={canWrite && (!completed || edit)} bookingItems={(s as any).executionItems} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Vùng thực hiện" value={f.treatmentArea} edit={editable} onChange={(v: string) => setF({ ...f, treatmentArea: v })} />
            <F label="Bắt đầu thực tế" type="datetime-local" value={f.actualStartAt} edit={editable} onChange={(v: string) => setF({ ...f, actualStartAt: v })} />
            <F label="Kết thúc thực tế" type="datetime-local" value={f.actualEndAt} edit={editable} onChange={(v: string) => setF({ ...f, actualEndAt: v })} />
          </div>
          <F label="Thông số thiết bị thực tế" value={f.actualParamsText} edit={editable} onChange={(v: string) => setF({ ...f, actualParamsText: v })} placeholder="VD: HIFU 4.5mm, 3 line, mức 1.0J" />
          <div className="space-y-1.5">
            <Label>Các bước thực tế{s.brandProtocol?.steps ? " (có thể tham chiếu Protocol)" : ""}</Label>
            {editable ? (
              <>
                {steps.map((st, i) => (
                  <div key={i} className="flex gap-2"><span className="w-5 pt-2 text-sm text-muted-foreground">{i + 1}.</span><Input value={st} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} /><Button type="button" variant="outline" size="sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</Button></div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, ""])}>+ Bước</Button>
                  {Array.isArray(s.brandProtocol?.steps?.items) && s.brandProtocol.steps.items.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSteps(s.brandProtocol.steps.items.map((x: any) => x.name ?? ""))}>Nạp bước từ Protocol</Button>
                  )}
                </div>
              </>
            ) : (
              <ol className="list-decimal pl-5 text-sm">{steps.length ? steps.map((st, i) => <li key={i}>{st}</li>) : <span className="text-muted-foreground">—</span>}</ol>
            )}
          </div>
          <F label="Ghi chú chuyên môn" value={f.note} edit={editable} onChange={(v: string) => setF({ ...f, note: v })} />

          {/* Biểu mẫu chuyên môn động (mục 11–12) — snapshot version tại thời điểm áp */}
          <div className="rounded-lg border p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biểu mẫu chuyên môn (theo Protocol/Công nghệ)</div>
            {sessionForms.length === 0 ? <p className="text-xs text-muted-foreground">Chưa gắn biểu mẫu chuyên môn.</p> : (
              <div className="space-y-1.5">
                {sessionForms.map((fm) => (
                  <div key={fm.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div><div className="font-medium">{fm.name ?? fm.template?.name}</div><div className="text-xs text-muted-foreground">{fm.template?.code} · v{fm.templateVersion} · {fm.status === "COMPLETED" ? "Đã hoàn thành" : "Đang điền"}</div></div>
                    <Link href={`/form-instances/${fm.id}`} className="text-primary hover:underline">Mở / điền</Link>
                  </div>
                ))}
              </div>
            )}
            {canWrite && (
              <Select className="mt-2" defaultValue="" onChange={(e) => { if (e.target.value) { attachForm(e.target.value); e.target.value = ""; } }}>
                <option value="">— Gắn biểu mẫu chuyên môn (snapshot theo version) —</option>
                {formTemplates.filter((t) => t.status === "ACTIVE" || t.status === "APPROVED").map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
              </Select>
            )}
          </div>

          {/* Kế hoạch vs Thực tế (mục 10) */}
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><div>Hạng mục</div><div>Kế hoạch</div><div>Thực tế</div></div>
            {pva.map((r) => (
              <div key={r.label} className={`grid grid-cols-3 border-t px-3 py-2 text-sm ${r.differs ? "bg-amber-50" : ""}`}>
                <div className="text-muted-foreground">{r.label}</div><div>{r.planned}</div>
                <div className={r.differs ? "font-medium text-amber-700" : ""}>{r.actual}{r.differs && <span className="ml-1 text-[10px] text-amber-600">(khác KH)</span>}</div>
              </div>
            ))}
          </div>
        </Block>

        {/* D — Nhân sự thực hiện */}
        <Block letter="D" title="Nhân sự thực hiện" hint="Phân công đa vai trò (chính/hỗ trợ/master/kiểm tra/tư vấn) kèm phí. Phí là snapshot của buổi; chỉ người có quyền tài chính thấy phí.">
          <SessionStaff sessionId={id} canWrite={canWrite && (!completed || edit)} />
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">Đóng góp thực tế (bằng chứng công việc)</div>
            <SessionContributions sessionId={id} canWrite={canWrite && (!completed || edit)} executionItems={(s as any).executionItems} />
          </div>
        </Block>

        {/* E — Vật tư sử dụng */}
        <Block letter="E" title="Vật tư sử dụng" hint="Vật tư DỰ KIẾN lấy từ dịch vụ/phác đồ; vật tư THỰC TẾ trừ tồn khi ghi nhận (không trừ khi tạo Booking). Nguồn: Kho vật tư sử dụng | Vật tư khách hàng.">
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vật tư dự kiến</div>
            <div className="mt-1">{txt(s.plannedMaterials) || <span className="text-muted-foreground">—</span>}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vật tư thực tế (trừ tồn)</div>
            <SpaMaterialConsume sessionId={id} customerId={s.customerId} canWrite={canMaterial && (!completed || edit)} />
          </div>
        </Block>

        {/* F — Sau khi thực hiện */}
        <Block letter="F" title="Sau khi thực hiện">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Tình trạng sau" value={f.conditionAfter} edit={editable} onChange={(v: string) => setF({ ...f, conditionAfter: v })} />
            <F label="Phản ứng ngay sau buổi" value={f.customerFeedback} edit={editable} onChange={(v: string) => setF({ ...f, customerFeedback: v })} />
            <F label="Sự cố/bất thường" value={f.incident} edit={editable} onChange={(v: string) => setF({ ...f, incident: v })} />
            <F label="Xử lý đã thực hiện" value={f.handledAction} edit={editable} onChange={(v: string) => setF({ ...f, handledAction: v })} />
            <F label="Dặn dò sau" value={f.postCare} edit={editable} onChange={(v: string) => setF({ ...f, postCare: v })} />
            <F label="Đề xuất buổi tiếp theo" value={f.nextSuggestion} edit={editable} onChange={(v: string) => setF({ ...f, nextSuggestion: v })} />
            <F label="Ngày follow-up" type="date" value={f.followUpDate} edit={editable} onChange={(v: string) => setF({ ...f, followUpDate: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Ảnh After</Label>
            <MediaUpload kind="AFTER_IMAGE" customerId={s.customerId} sessionId={id} value={f.afterImages} onChange={(ids) => setF({ ...f, afterImages: ids })} disabled={!editable} />
          </div>
          <div className="space-y-1.5">
            <Label>Chia sẻ ảnh cho khách (Cổng khách)</Label>
            <p className="text-[11px] text-muted-foreground">Mặc định ảnh RIÊNG TƯ; chỉ ảnh bật &quot;Khách thấy&quot; mới hiển thị trên Cổng khách.</p>
            <SessionMediaShare sessionId={id} canShare={canMedia} />
          </div>
          {/* Hướng dẫn chăm sóc (mục 23) + Follow-up (mục 24) */}
          <div className="rounded-lg border p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hướng dẫn chăm sóc</div>
            {careInstances.length > 0 && <div className="mb-2 space-y-1">{careInstances.map((c) => <div key={c.id} className="rounded border bg-muted/30 px-2 py-1 text-xs"><b>{c.title}</b> — đã gắn cho khách</div>)}</div>}
            {careTemplates.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có mẫu hướng dẫn phù hợp cho dịch vụ này.</p> : (
              <div className="space-y-1">
                {careTemplates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded border p-2 text-xs">
                    <div><b>{t.title}</b><div className="text-muted-foreground line-clamp-1">{t.content}</div></div>
                    {canWrite && <Button size="sm" variant="outline" onClick={() => attachCare(t)}>Gắn cho khách</Button>}
                  </div>
                ))}
              </div>
            )}
            {canWrite && <Button size="sm" variant="ghost" className="mt-2" onClick={createFollowUp}>+ Tạo việc follow-up</Button>}
          </div>
        </Block>

        {/* G — Đánh giá & Báo cáo */}
        <Block letter="G" title="Đánh giá & Báo cáo" hint="Đánh giá của KHÁCH (hài lòng, KTV, nhận xét) tách riêng với BÁO CÁO nội bộ của KTV. Báo cáo nội bộ không hiển thị cho khách.">
          <SessionReview sessionId={id} canWrite={canWrite && (!completed || edit)} defaultTechnician={s.performer ?? ""} />
        </Block>

        {/* Lịch sử chỉnh sửa sau hoàn thành (mục 29, 32) */}
        {Array.isArray(s.editLog) && s.editLog.length > 0 && (
          <Block letter="✎" title="Lịch sử chỉnh sửa (sau hoàn thành)">
            <div className="space-y-2 text-xs">
              {s.editLog.map((e: any, i: number) => (
                <div key={i} className="rounded border p-2">
                  <div className="font-medium">{e.by} · {formatDateTime(e.at)}</div>
                  <div className="text-muted-foreground">Lý do: {e.reason}</div>
                  {Array.isArray(e.changes) && e.changes.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">{e.changes.map((c: any, j: number) => <li key={j}>{c.field}: &quot;{c.before || "—"}&quot; → &quot;{c.after || "—"}&quot;</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </Block>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {editable && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
            {s.status === "IN_PROGRESS" && <Button variant="outline" disabled={saving} onClick={() => save()}>Lưu tạm</Button>}
            {s.status !== "COMPLETED" && <Button disabled={saving} onClick={() => save({ status: "COMPLETED" })}><CheckCircle2 className="h-4 w-4" /> Hoàn thành buổi</Button>}
            {completed && edit && <Button disabled={saving || !editReason.trim()} onClick={() => save()}>Lưu chỉnh sửa</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
