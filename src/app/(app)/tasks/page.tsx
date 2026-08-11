"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle2 } from "lucide-react";
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
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_TONE, TASK_STATUS_LABEL } from "@/lib/clinic-labels";

interface Task {
  id: string;
  title: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  customerId?: string | null;
  customer?: { code: string; fullName: string } | null;
}

export default function TasksPage() {
  const canWrite = useCan(PERMISSIONS.TASK_WRITE);
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", assignee: "", dueDate: "", priority: "NORMAL" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Task[]>(`/api/tasks${statusFilter ? `?status=${statusFilter}` : ""}`)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

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
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function toggle(t: Task) {
    const status = t.status === "DONE" ? "OPEN" : "DONE";
    await apiFetch(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
    load();
  }

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Công việc / Follow-up"
        description="Nhắc lịch chăm sóc khách, follow-up sau dịch vụ, việc cần làm."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm việc</Button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-muted-foreground">Trạng thái</Label>
        <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH></TH><TH>Nội dung</TH><TH>Khách</TH><TH>Phụ trách</TH><TH>Hạn</TH><TH>Ưu tiên</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Không có công việc</TD></TR>
              ) : (
                rows.map((t) => {
                  const overdue = t.status !== "DONE" && t.dueDate && new Date(t.dueDate).getTime() < now;
                  return (
                    <TR key={t.id}>
                      <TD>
                        {canWrite && (
                          <button onClick={() => toggle(t)} title="Đánh dấu hoàn thành">
                            <CheckCircle2 className={`h-5 w-5 ${t.status === "DONE" ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                          </button>
                        )}
                      </TD>
                      <TD className={t.status === "DONE" ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</TD>
                      <TD>{t.customer ? <Link href={`/customers/${t.customerId}`} className="text-primary hover:underline">{t.customer.fullName}</Link> : "—"}</TD>
                      <TD>{t.assignee ?? "—"}</TD>
                      <TD className={overdue ? "font-medium text-red-600" : ""}>{t.dueDate ? formatDate(t.dueDate) : "—"}</TD>
                      <TD><Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge></TD>
                      <TD>{TASK_STATUS_LABEL[t.status]}</TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
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
    </div>
  );
}
