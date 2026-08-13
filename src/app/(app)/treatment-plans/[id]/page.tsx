"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft, GitBranch, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { MediaUpload } from "@/components/media-upload";
import { SessionMediaShare } from "@/components/session-media-share";
import { SpaMaterialConsume } from "@/components/spa-material-consume";
import { SessionStaff } from "@/components/session-staff";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  PLAN_STATUS_LABEL,
  PLAN_STATUS_TONE,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
} from "@/lib/clinic-labels";

interface Plan {
  id: string;
  code: string;
  name: string;
  version: number;
  status: string;
  diagnosis?: string | null;
  goals?: string | null;
  totalPrice?: string | number | null;
  customer: { id?: string; code: string; fullName: string };
  stages: { id: string; name: string; orderIndex: number }[];
  sessions: any[];
  canSeeFinance: boolean;
}
interface Opt { id: string; name: string }

const PLAN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
const SESSION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default function TreatmentPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const canMedia = useCan(PERMISSIONS.MEDIA_WRITE);
  const canMaterial = useCan(PERMISSIONS.MATERIAL_WRITE);
  const [p, setP] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Opt[]>([]);
  const [technologies, setTechnologies] = useState<Opt[]>([]);
  const [protocols, setProtocols] = useState<Opt[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [record, setRecord] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
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
    apiFetch<Opt[]>("/api/brand-protocols").then(setProtocols).catch(() => {});
    apiFetch<any[]>("/api/form-templates").then(setFormTemplates).catch(() => {});
    apiFetch<any[]>("/api/spa-products").then(setSpaProducts).catch(() => {});
  }, [load]);

  async function openMaterials(s: any) {
    setMatsFor(s);
    setError(null);
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
    if (!matsFor) return;
    setError(null);
    try {
      await apiFetch("/api/session-materials", { method: "POST", body: JSON.stringify({ ...body, sessionId: matsFor.id }) });
      refreshMaterials();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function moveMaterial(matId: string, type: string, quantity: number) {
    setError(null);
    try {
      await apiFetch(`/api/session-materials/${matId}/move`, { method: "POST", body: JSON.stringify({ type, quantity }) });
      refreshMaterials();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
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
    await apiFetch("/api/form-instances", {
      method: "POST",
      body: JSON.stringify({ templateId, sessionId: formsFor.id, customerId: (p as any).customerId, planId: id }),
    }).catch(() => {});
    setSessionForms(await apiFetch<any[]>(`/api/form-instances?sessionId=${formsFor.id}`).catch(() => []));
  }

  // Kéo–thả sắp xếp buổi -> lưu orderIndex
  async function reorder(fromId: string, toId: string) {
    if (!p || fromId === toId) return;
    const ids = p.sessions.map((s) => s.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const order = ids.map((sid, i) => ({ id: sid, orderIndex: i }));
    // cập nhật lạc quan
    setP({ ...p, sessions: order.map((o) => p.sessions.find((s) => s.id === o.id)!).filter(Boolean) });
    await apiFetch("/api/treatment-sessions/reorder", { method: "PATCH", body: JSON.stringify({ order }) }).catch(() => {});
    load();
  }

  async function setStatus(status: string) {
    await apiFetch(`/api/treatment-plans/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }
  async function bumpVersion() {
    const reason = window.prompt("Lý do tạo version mới của phác đồ?");
    if (reason === null) return;
    await apiFetch(`/api/treatment-plans/${id}`, { method: "PATCH", body: JSON.stringify({ bumpVersion: true, changeReason: reason }) }).catch(() => {});
    load();
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!p) return <p className="text-destructive">Không tìm thấy phác đồ.</p>;

  const nextNumber = (p.sessions.reduce((m, s) => Math.max(m, s.sessionNumber), 0) || 0) + 1;

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
              <Button variant="outline" onClick={bumpVersion}><GitBranch className="h-4 w-4" /> Version mới</Button>
              <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Thêm buổi</Button>
            </div>
          )
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="space-y-2 p-5 text-sm">
            <div><span className="text-muted-foreground">Tình trạng chính: </span>{p.diagnosis ?? "—"}</div>
            <div><span className="text-muted-foreground">Mục tiêu: </span>{p.goals ?? "—"}</div>
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="mr-1 text-muted-foreground">Giai đoạn:</span>
              {p.stages.length ? p.stages.map((s) => <Badge key={s.id} tone="muted">{s.name}</Badge>) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trạng thái</span>
              {canWrite ? (
                <Select className="h-8 w-40" value={p.status} onChange={(e) => setStatus(e.target.value)}>
                  {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>)}
                </Select>
              ) : (
                <Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge>
              )}
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Tổng giá</span>
              <span className="font-medium">{p.totalPrice ? formatNumber(Number(p.totalPrice)) + " ₫" : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                {canWrite && <TH></TH>}
                <TH>Buổi</TH><TH>Tên / mục tiêu</TH><TH>Giai đoạn</TH><TH>Dịch vụ</TH>
                <TH>Công nghệ</TH><TH>Protocol</TH>
                <TH>Lịch</TH><TH>Thực hiện</TH>
                {p.canSeeFinance && <TH className="text-right">Chi phí TT</TH>}
                <TH>Trạng thái</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {p.sessions.length === 0 ? (
                <TR><TD colSpan={p.canSeeFinance ? 12 : 11} className="py-8 text-center text-muted-foreground">Chưa có buổi nào</TD></TR>
              ) : (
                p.sessions.map((s) => (
                  <TR
                    key={s.id}
                    draggable={canWrite}
                    onDragStart={() => setDragId(s.id)}
                    onDragOver={(e) => canWrite && e.preventDefault()}
                    onDrop={() => { if (dragId) reorder(dragId, s.id); setDragId(null); }}
                    className={dragId === s.id ? "opacity-50" : ""}
                  >
                    {canWrite && <TD className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></TD>}
                    <TD className="font-medium">#{s.sessionNumber}</TD>
                    <TD>{s.name ?? s.objective ?? "—"}</TD>
                    <TD>{s.stage?.name ?? "—"}</TD>
                    <TD>{s.service?.name ?? "—"}</TD>
                    <TD>{s.technology?.name ?? "—"}</TD>
                    <TD>{s.brandProtocol?.name ?? "—"}</TD>
                    <TD>{s.scheduledAt ? formatDate(s.scheduledAt) : "—"}</TD>
                    <TD>{s.performedAt ? formatDate(s.performedAt) : "—"}</TD>
                    {p.canSeeFinance && <TD className="text-right text-muted-foreground">{s.actualCost != null ? formatNumber(Number(s.actualCost)) + " ₫" : "—"}</TD>}
                    <TD><Badge tone={SESSION_STATUS_TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge></TD>
                    <TD>
                      <div className="flex gap-1">
                        {canWrite && <Button size="sm" variant="outline" onClick={() => setRecord(s)}>Ghi nhận</Button>}
                        <Button size="sm" variant="ghost" onClick={() => openForms(s)}>Phiếu</Button>
                        <Button size="sm" variant="ghost" onClick={() => openMaterials(s)}>Vật tư</Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      {canWrite && p.sessions.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Kéo–thả các dòng để sắp xếp lại thứ tự buổi.</p>}

      {/* Thêm buổi */}
      <AddSessionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        error={error}
        stages={p.stages}
        services={services}
        technologies={technologies}
        protocols={protocols}
        nextNumber={nextNumber}
        onSubmit={async (body: any) => {
          setError(null);
          try {
            await apiFetch("/api/treatment-sessions", { method: "POST", body: JSON.stringify({ ...body, planId: id }) });
            setAddOpen(false); load();
          } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
        }}
      />

      {/* Biểu mẫu/protocol của buổi (mục 7) */}
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

      {/* Vật tư buổi (mục 8) */}
      {matsFor && (
        <MaterialsModal
          session={matsFor}
          materials={materials}
          spaProducts={spaProducts}
          lots={lots}
          error={error}
          canFinance={p.canSeeFinance}
          canWrite={canWrite}
          onClose={() => { setMatsFor(null); setError(null); }}
          onAdd={addMaterial}
          onMove={moveMaterial}
          onDelete={delMaterial}
        />
      )}

      {/* Ghi nhận buổi */}
      {record && (
        <RecordSessionModal
          session={record}
          canFinance={p.canSeeFinance}
          canShare={canMedia}
          canMaterial={canMaterial}
          canWrite={canWrite}
          error={error}
          onClose={() => setRecord(null)}
          onSubmit={async (body: any) => {
            setError(null);
            try {
              await apiFetch(`/api/treatment-sessions/${record.id}`, { method: "PATCH", body: JSON.stringify(body) });
              setRecord(null); load();
            } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
          }}
        />
      )}
    </div>
  );
}

function AddSessionModal({ open, onClose, onSubmit, error, stages, services, technologies, protocols, nextNumber }: any) {
  const empty = { sessionNumber: nextNumber, name: "", stageId: "", serviceId: "", technologyId: "", brandProtocolId: "", objective: "", scheduledAt: "", plannedCost: "", price: "", preCare: "", postCare: "", professionalProductsText: "" };
  const [f, setF] = useState<any>(empty);
  const [steps, setSteps] = useState<string[]>([]);
  useEffect(() => { setF((p: any) => ({ ...p, sessionNumber: nextNumber })); }, [nextNumber, open]);
  return (
    <Modal open={open} onClose={onClose} title="Thêm buổi thực hiện" className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const b: any = { ...f, sessionNumber: Number(f.sessionNumber) };
          ["stageId", "serviceId", "technologyId", "brandProtocolId", "name", "objective", "scheduledAt", "preCare", "postCare"].forEach((k) => { if (!b[k]) delete b[k]; });
          b.plannedCost = f.plannedCost ? Number(f.plannedCost) : undefined;
          b.price = f.price ? Number(f.price) : undefined;
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
          <div className="space-y-1.5">
            <Label>Giai đoạn</Label>
            <Select value={f.stageId} onChange={(e) => setF({ ...f, stageId: e.target.value })}>
              <option value="">—</option>
              {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dịch vụ</Label>
            <Select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
              <option value="">—</option>
              {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Công nghệ</Label>
            <Select value={f.technologyId} onChange={(e) => setF({ ...f, technologyId: e.target.value })}>
              <option value="">—</option>
              {(technologies ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Brand Protocol</Label>
            <Select value={f.brandProtocolId} onChange={(e) => setF({ ...f, brandProtocolId: e.target.value })}>
              <option value="">—</option>
              {(protocols ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Mục tiêu buổi</Label><Input value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Các bước thực hiện</Label>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-5 pt-2 text-sm text-muted-foreground">{i + 1}.</span>
              <Input value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button type="button" variant="outline" size="sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, ""])}>+ Bước</Button>
        </div>
        <div className="space-y-1.5"><Label>Sản phẩm chuyên nghiệp dùng trong buổi</Label><Input value={f.professionalProductsText} onChange={(e) => setF({ ...f, professionalProductsText: e.target.value })} placeholder="VD: DMK Enzyme, serum..." /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Lịch dự kiến</Label><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Chi phí dự kiến</Label><Input type="number" value={f.plannedCost} onChange={(e) => setF({ ...f, plannedCost: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Giá dự kiến</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Dặn dò trước</Label><Input value={f.preCare} onChange={(e) => setF({ ...f, preCare: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Dặn dò sau</Label><Input value={f.postCare} onChange={(e) => setF({ ...f, postCare: e.target.value })} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Trạng thái</Label>
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
          <div className="space-y-1.5">
            <Label>Ảnh trước</Label>
            <MediaUpload kind="BEFORE_IMAGE" customerId={session.customerId} sessionId={session.id} value={f.beforeImages} onChange={(ids) => setF({ ...f, beforeImages: ids })} />
          </div>
          <div className="space-y-1.5">
            <Label>Ảnh sau</Label>
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
            <p className="text-[11px] text-muted-foreground">Phân công đa vai trò (chính/hỗ trợ/master/kiểm tra/tư vấn) kèm phí. Nhân sự & phí lưu theo buổi, thể hiện trong hồ sơ khách.</p>
            <SessionStaff sessionId={session.id} canWrite={canWrite} />
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
function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
