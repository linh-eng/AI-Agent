"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft, GitBranch } from "lucide-react";
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
  const [p, setP] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Opt[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [record, setRecord] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setP(await apiFetch<Plan>(`/api/treatment-plans/${id}`)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {}); }, [load]);

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
                <TH>Buổi</TH><TH>Tên / mục tiêu</TH><TH>Giai đoạn</TH><TH>Dịch vụ</TH>
                <TH>Lịch</TH><TH>Thực hiện</TH>
                {p.canSeeFinance && <TH className="text-right">Chi phí TT</TH>}
                <TH>Trạng thái</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {p.sessions.length === 0 ? (
                <TR><TD colSpan={p.canSeeFinance ? 9 : 8} className="py-8 text-center text-muted-foreground">Chưa có buổi nào</TD></TR>
              ) : (
                p.sessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">#{s.sessionNumber}</TD>
                    <TD>{s.name ?? s.objective ?? "—"}</TD>
                    <TD>{s.stage?.name ?? "—"}</TD>
                    <TD>{s.service?.name ?? "—"}</TD>
                    <TD>{s.scheduledAt ? formatDate(s.scheduledAt) : "—"}</TD>
                    <TD>{s.performedAt ? formatDate(s.performedAt) : "—"}</TD>
                    {p.canSeeFinance && <TD className="text-right text-muted-foreground">{s.actualCost != null ? formatNumber(Number(s.actualCost)) + " ₫" : "—"}</TD>}
                    <TD><Badge tone={SESSION_STATUS_TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge></TD>
                    <TD>{canWrite && <Button size="sm" variant="outline" onClick={() => setRecord(s)}>Ghi nhận</Button>}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Thêm buổi */}
      <AddSessionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        error={error}
        stages={p.stages}
        services={services}
        nextNumber={nextNumber}
        onSubmit={async (body: any) => {
          setError(null);
          try {
            await apiFetch("/api/treatment-sessions", { method: "POST", body: JSON.stringify({ ...body, planId: id }) });
            setAddOpen(false); load();
          } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
        }}
      />

      {/* Ghi nhận buổi */}
      {record && (
        <RecordSessionModal
          session={record}
          canFinance={p.canSeeFinance}
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

function AddSessionModal({ open, onClose, onSubmit, error, stages, services, nextNumber }: any) {
  const [f, setF] = useState<any>({ sessionNumber: nextNumber, name: "", stageId: "", serviceId: "", objective: "", scheduledAt: "", plannedCost: "", price: "", preCare: "" });
  useEffect(() => { setF((p: any) => ({ ...p, sessionNumber: nextNumber })); }, [nextNumber, open]);
  return (
    <Modal open={open} onClose={onClose} title="Thêm buổi thực hiện">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const b: any = { ...f, sessionNumber: Number(f.sessionNumber) };
          ["stageId", "serviceId", "name", "objective", "scheduledAt", "preCare"].forEach((k) => { if (!b[k]) delete b[k]; });
          b.plannedCost = f.plannedCost ? Number(f.plannedCost) : undefined;
          b.price = f.price ? Number(f.price) : undefined;
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
            <Label>Dịch vụ / công nghệ</Label>
            <Select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
              <option value="">—</option>
              {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Mục tiêu buổi</Label><Input value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Lịch dự kiến</Label><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Chi phí dự kiến</Label><Input type="number" value={f.plannedCost} onChange={(e) => setF({ ...f, plannedCost: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Giá</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Dặn dò trước</Label><Input value={f.preCare} onChange={(e) => setF({ ...f, preCare: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">Lưu</Button></div>
      </form>
    </Modal>
  );
}

function RecordSessionModal({ session, onClose, onSubmit, error, canFinance }: any) {
  const [f, setF] = useState<any>({
    status: session.status,
    performer: session.performer ?? "",
    conditionBefore: session.conditionBefore ?? "",
    conditionAfter: session.conditionAfter ?? "",
    actualParamsText: paramsToText(session.actualParams),
    actualMaterialsText: paramsToText(session.actualMaterials),
    beforeImages: (session.beforeImages ?? []).join(", "),
    afterImages: (session.afterImages ?? []).join(", "),
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
            beforeImages: splitList(f.beforeImages),
            afterImages: splitList(f.afterImages),
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
          <div className="space-y-1.5"><Label>Ảnh trước (URL, phẩy)</Label><Input value={f.beforeImages} onChange={(e) => setF({ ...f, beforeImages: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Ảnh sau (URL, phẩy)</Label><Input value={f.afterImages} onChange={(e) => setF({ ...f, afterImages: e.target.value })} /></div>
        </div>
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

function paramsToText(v: any): string {
  if (!v) return "";
  if (typeof v === "object" && "text" in v) return String(v.text);
  return JSON.stringify(v);
}
function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
