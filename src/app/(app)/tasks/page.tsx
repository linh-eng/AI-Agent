"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Play, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_TONE, TASK_STATUS_LABEL, DELIVERY_CHANNEL_LABEL } from "@/lib/clinic-labels";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  channel?: string | null;
  actualChannel?: string | null;
  checklist?: string[] | null;
  checklistState?: boolean[] | null;
  completedBy?: string | null;
  completedAt?: string | null;
  completionNote?: string | null;
  customerId?: string | null;
  customer?: { code: string; fullName: string } | null;
  followUpTemplateId?: string | null;
  careProcessInstanceId?: string | null;
  careInstance?: { code: string; templateName: string; templateVersion: number; status: string } | null;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "upcoming", label: "Sắp tới" },
  { key: "overdue", label: "Quá hạn" },
  { key: "done", label: "Hoàn thành" },
  { key: "", label: "Tất cả" },
];

export default function TasksPage() {
  const canWrite = useCan(PERMISSIONS.TASK_WRITE);
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("today");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", assignee: "", dueDate: "", priority: "NORMAL" });
  const [completeFor, setCompleteFor] = useState<Task | null>(null);
  const [reasonFor, setReasonFor] = useState<{ task: Task; action: "reopen" | "cancel" } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Task[]>(`/api/tasks?filter=${filter || "all"}`));
    } finally { setLoading(false); }
  }
  async function loadCounts() {
    // Đếm nhanh cho các tab (song song).
    const keys = ["today", "upcoming", "overdue", "done"];
    const res = await Promise.all(keys.map((k) => apiFetch<Task[]>(`/api/tasks?filter=${k}`).catch(() => [])));
    const c: Record<string, number> = {};
    keys.forEach((k, i) => (c[k] = res[i].length));
    setCounts(c);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => { loadCounts(); /* eslint-disable-next-line */ }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      if (!body.assignee) delete body.assignee;
      if (!body.dueDate) delete body.dueDate;
      await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ title: "", assignee: "", dueDate: "", priority: "NORMAL" });
      load(); loadCounts();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function action(t: Task, act: "start") {
    await apiFetch(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ action: act }) }).catch(() => {});
    load(); loadCounts();
  }

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Công việc / Follow-up"
        description="Nhắc lịch chăm sóc khách, follow-up sau dịch vụ, việc cần làm. Việc từ quy trình CSKH mang sẵn kênh/kịch bản/checklist."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm việc</Button>}
      />

      {/* Bộ lọc trạng thái vòng đời */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm transition ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {f.label}
            {counts[f.key] != null && f.key !== "" && <span className="ml-1 opacity-70">({counts[f.key]})</span>}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR><TH>Nội dung</TH><TH>Khách</TH><TH>Nguồn</TH><TH>Kênh</TH><TH>Phụ trách</TH><TH>Hạn</TH><TH>Ưu tiên</TH><TH>Trạng thái</TH><TH></TH></TR>
              </THead>
              <TBody>
                {loading ? (
                  <TR><TD colSpan={9} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                ) : rows.length === 0 ? (
                  <TR><TD colSpan={9} className="py-8 text-center text-muted-foreground">Không có công việc</TD></TR>
                ) : (
                  rows.map((t) => {
                    const openish = t.status === "OPEN" || t.status === "IN_PROGRESS";
                    const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : null;
                    const overdue = openish && dueMs != null && dueMs < now;
                    const overdueDays = overdue && dueMs != null ? Math.floor((now - dueMs) / 86_400_000) : 0;
                    const checklistN = Array.isArray(t.checklist) ? t.checklist.length : 0;
                    return (
                      <TR key={t.id}>
                        <TD className={t.status === "DONE" ? "text-muted-foreground line-through" : t.status === "CANCELLED" ? "text-muted-foreground" : "font-medium"}>
                          {t.title}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {checklistN > 0 && <span className="text-xs text-muted-foreground">☑ {checklistN} mục</span>}
                            {t.description && <span className="max-w-[280px] truncate text-xs text-muted-foreground" title={t.description}>· {t.description}</span>}
                          </div>
                        </TD>
                        <TD>{t.customer ? <Link href={`/customers/${t.customerId}`} className="text-primary hover:underline">{t.customer.fullName}</Link> : "—"}</TD>
                        <TD>{t.careInstance ? <Badge tone="muted" title={`${t.careInstance.templateName} v${t.careInstance.templateVersion}`}>{t.careInstance.code}</Badge> : t.followUpTemplateId ? <Badge tone="muted">CSKH</Badge> : <span className="text-xs text-muted-foreground">Thủ công</span>}</TD>
                        <TD>{t.channel ? <span className="text-xs">{DELIVERY_CHANNEL_LABEL[t.channel] ?? t.channel}</span> : "—"}</TD>
                        <TD>{t.assignee ?? "—"}</TD>
                        <TD className={overdue ? "text-red-600" : ""}>
                          {t.dueDate ? formatDate(t.dueDate) : "—"}
                          {overdue && <div className="text-xs font-medium text-red-600">{overdueDays >= 1 ? `Quá hạn ${overdueDays} ngày` : "Quá hạn"}</div>}
                        </TD>
                        <TD><Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge></TD>
                        <TD>
                          <Badge tone={t.status === "DONE" ? "success" : t.status === "CANCELLED" ? "muted" : t.status === "IN_PROGRESS" ? "default" : "muted"}>{TASK_STATUS_LABEL[t.status]}</Badge>
                          {t.status === "DONE" && t.completedBy && <div className="pt-0.5 text-xs text-muted-foreground">bởi {t.completedBy}</div>}
                        </TD>
                        <TD>
                          {canWrite && (
                            <div className="flex justify-end gap-1">
                              {t.status === "OPEN" && <Button size="sm" variant="ghost" title="Bắt đầu xử lý" onClick={() => action(t, "start")}><Play className="h-4 w-4" /></Button>}
                              {openish && <Button size="sm" variant="outline" title="Hoàn thành" onClick={() => setCompleteFor(t)}><CheckCircle2 className="h-4 w-4" /></Button>}
                              {openish && <Button size="sm" variant="ghost" title="Hủy việc" onClick={() => setReasonFor({ task: t, action: "cancel" })}><XCircle className="h-4 w-4" /></Button>}
                              {t.status === "DONE" && <Button size="sm" variant="ghost" title="Mở lại" onClick={() => setReasonFor({ task: t, action: "reopen" })}><RotateCcw className="h-4 w-4" /></Button>}
                            </div>
                          )}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm công việc">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Nội dung *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Phụ trách</Label><Input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hạn</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Ưu tiên</Label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {Object.entries(TASK_PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>

      {completeFor && <CompleteModal task={completeFor} onClose={() => setCompleteFor(null)} onDone={() => { setCompleteFor(null); load(); loadCounts(); }} />}
      {reasonFor && <ReasonModal ctx={reasonFor} onClose={() => setReasonFor(null)} onDone={() => { setReasonFor(null); load(); loadCounts(); }} />}
    </div>
  );
}

const CHANNELS = ["IN_PERSON", "PORTAL", "EMAIL", "ZALO", "WHATSAPP", "SMS"];

function CompleteModal({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const [ticks, setTicks] = useState<boolean[]>(checklist.map(() => false));
  const [note, setNote] = useState("");
  const [actualChannel, setActualChannel] = useState(task.channel ?? "IN_PERSON");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "complete", completionNote: note || null, checklistState: checklist.length ? ticks : undefined, actualChannel }),
      });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Hoàn thành: ${task.title}`}>
      <form onSubmit={submit} className="space-y-4">
        {checklist.length > 0 && (
          <div className="space-y-1.5">
            <Label>Checklist đã thực hiện</Label>
            <div className="space-y-1 rounded-md border p-2">
              {checklist.map((item, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5"><Label>Kênh liên hệ thực tế</Label><Select value={actualChannel} onChange={(e) => setActualChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c} value={c}>{DELIVERY_CHANNEL_LABEL[c]}</option>)}</Select></div>
        <div className="space-y-1.5"><Label>Kết quả / ghi chú</Label><textarea className="min-h-[64px] w-full rounded-md border bg-background p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vd: Đã gọi, khách hài lòng, hẹn tái khám..." /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Xác nhận hoàn thành"}</Button></div>
      </form>
    </Modal>
  );
}

function ReasonModal({ ctx, onClose, onDone }: { ctx: { task: Task; action: "reopen" | "cancel" }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReopen = ctx.action === "reopen";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      await apiFetch(`/api/tasks/${ctx.task.id}`, { method: "PATCH", body: JSON.stringify({ action: ctx.action, reason }) });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${isReopen ? "Mở lại" : "Hủy"} công việc: ${ctx.task.title}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label>Lý do *</Label><textarea className="min-h-[64px] w-full rounded-md border bg-background p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder={isReopen ? "Vd: Cần liên hệ lại vì khách chưa phản hồi" : "Vd: Khách đã ngưng liệu trình"} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Đóng</Button><Button type="submit" disabled={saving || !reason.trim()}>{saving ? "Đang lưu..." : (isReopen ? "Mở lại" : "Hủy việc")}</Button></div>
      </form>
    </Modal>
  );
}
