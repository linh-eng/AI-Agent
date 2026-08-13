"use client";
import { Fragment, useEffect, useState } from "react";
import { Plus, Pencil, Send, Cake, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { FOLLOWUP_TRIGGER_LABEL, DELIVERY_CHANNEL_LABEL } from "@/lib/clinic-labels";

const TRIGGERS = ["MANUAL", "AFTER_SERVICE", "AFTER_SESSION", "BIRTHDAY"];
const CHANNELS = ["IN_PERSON", "PORTAL", "EMAIL", "ZALO", "WHATSAPP", "SMS"];

interface Step { orderIndex?: number; dayOffset: number; channel: string; title: string; script?: string | null; checklist: string[] }
interface Template { id: string; code: string; name: string; description?: string | null; trigger: string; isActive: boolean; steps: Step[] }
interface Birthday { id: string; code: string; fullName: string; phone: string | null; day: number; month: number; turningAge: number | null; inDays: number }
interface Cust { id: string; code?: string; fullName?: string }

export default function FollowUpsPage() {
  const canWrite = useCan(PERMISSIONS.FOLLOWUP_WRITE);
  const canApply = useCan(PERMISSIONS.TASK_WRITE);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [edit, setEdit] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyFor, setApplyFor] = useState<{ template: Template; customerId?: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setTemplates(await apiFetch<Template[]>("/api/followup-templates"));
    apiFetch<Birthday[]>("/api/crm/birthdays?days=30").then(setBirthdays).catch(() => {});
  }
  useEffect(() => { load(); apiFetch<Cust[]>("/api/customers").then(setCustomers).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CSKH · Follow-up"
        description="Quy trình chăm sóc nhiều bước (mốc + kênh + kịch bản + checklist) → áp cho khách sinh việc theo lịch. Kèm chương trình sinh nhật."
        action={canWrite && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Tạo quy trình</Button>}
      />

      {/* Sinh nhật sắp tới */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 font-medium"><Cake className="h-4 w-4 text-pink-500" /> Sinh nhật 30 ngày tới ({birthdays.length})</div>
          {birthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có khách sinh nhật trong 30 ngày tới (cần nhập ngày sinh trong hồ sơ khách).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {birthdays.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="font-medium">{b.fullName}</span>
                  <span className="text-xs text-muted-foreground">{String(b.day).padStart(2, "0")}/{String(b.month).padStart(2, "0")}{b.turningAge ? ` · ${b.turningAge} tuổi` : ""} · {b.inDays === 0 ? "hôm nay" : `còn ${b.inDays} ngày`}</span>
                  {canApply && templates.some((t) => t.trigger === "BIRTHDAY" && t.isActive) && (
                    <button className="text-primary hover:underline" onClick={() => { const t = templates.find((x) => x.trigger === "BIRTHDAY" && x.isActive)!; setApplyFor({ template: t, customerId: b.id }); }}>Chúc mừng</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quy trình CSKH */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH></TH><TH>Mã</TH><TH>Tên quy trình</TH><TH>Kích hoạt</TH><TH>Số bước</TH><TH>Trạng thái</TH><TH></TH></TR>
            </THead>
            <TBody>
              {templates.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có quy trình. Tạo mới để bắt đầu.</TD></TR>
              ) : templates.map((t) => (
                <Fragment key={t.id}>
                  <TR className={t.isActive ? "" : "opacity-50"}>
                    <TD><button onClick={() => setExpanded(expanded === t.id ? null : t.id)}>{expanded === t.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TD>
                    <TD className="font-mono">{t.code}</TD>
                    <TD className="font-medium">{t.name}</TD>
                    <TD><Badge tone="muted">{FOLLOWUP_TRIGGER_LABEL[t.trigger]}</Badge></TD>
                    <TD>{t.steps.length}</TD>
                    <TD>{t.isActive ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="muted">Ngưng</Badge>}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        {canApply && t.isActive && <Button size="sm" variant="outline" onClick={() => setApplyFor({ template: t })}><Send className="h-4 w-4" /> Áp</Button>}
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => setEdit(t)}><Pencil className="h-4 w-4" /></Button>}
                      </div>
                    </TD>
                  </TR>
                  {expanded === t.id && (
                    <TR>
                      <TD colSpan={7} className="bg-muted/30">
                        <ol className="space-y-1 py-1 text-sm">
                          {t.steps.map((s, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2">
                              <Badge tone="default">+{s.dayOffset} ngày</Badge>
                              <Badge tone="muted">{DELIVERY_CHANNEL_LABEL[s.channel] ?? s.channel}</Badge>
                              <span className="font-medium">{s.title}</span>
                              {s.checklist?.length > 0 && <span className="text-xs text-muted-foreground">· {s.checklist.length} mục checklist</span>}
                            </li>
                          ))}
                        </ol>
                      </TD>
                    </TR>
                  )}
                </Fragment>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || edit) && <TemplateModal template={edit} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); load(); }} />}
      {applyFor && <ApplyModal apply={applyFor} customers={customers} onClose={() => setApplyFor(null)} onDone={() => { setApplyFor(null); load(); }} />}
    </div>
  );
}

function TemplateModal({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!template;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [trigger, setTrigger] = useState(template?.trigger ?? "MANUAL");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [steps, setSteps] = useState<Step[]>(template?.steps ?? [{ dayOffset: 1, channel: "ZALO", title: "", script: "", checklist: [] }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function upd(i: number, patch: Partial<Step>) { setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const body = { name, description: description || null, trigger, isActive, steps: steps.map((s, i) => ({ ...s, orderIndex: i })) };
    try {
      if (editing) await apiFetch(`/api/followup-templates/${template!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await apiFetch("/api/followup-templates", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Sửa quy trình ${template!.code}` : "Tạo quy trình CSKH"} className="max-w-2xl">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tên quy trình *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Kích hoạt theo</Label><Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>{TRIGGERS.map((t) => <option key={t} value={t}>{FOLLOWUP_TRIGGER_LABEL[t]}</option>)}</Select></div>
        </div>
        <div className="space-y-1.5"><Label>Mô tả</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>

        <div className="space-y-2">
          <Label>Các bước follow-up</Label>
          {steps.map((s, i) => (
            <div key={i} className="space-y-2 rounded-md border p-2">
              <div className="flex gap-2">
                <div className="w-24"><Label className="text-xs">Sau (ngày)</Label><Input className="h-8" type="number" value={s.dayOffset} onChange={(e) => upd(i, { dayOffset: Number(e.target.value) })} /></div>
                <div className="w-32"><Label className="text-xs">Kênh</Label><Select className="h-8" value={s.channel} onChange={(e) => upd(i, { channel: e.target.value })}>{CHANNELS.map((c) => <option key={c} value={c}>{DELIVERY_CHANNEL_LABEL[c]}</option>)}</Select></div>
                <div className="flex-1"><Label className="text-xs">Việc cần làm</Label><Input className="h-8" value={s.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="VD: Gọi hỏi thăm sau 1 ngày" /></div>
                <Button type="button" size="icon" variant="ghost" className="mt-5" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div><Label className="text-xs">Kịch bản/nội dung mẫu</Label><Input className="h-8" value={s.script ?? ""} onChange={(e) => upd(i, { script: e.target.value })} placeholder="Lời thoại gợi ý cho nhân viên" /></div>
              <div><Label className="text-xs">Checklist (mỗi dòng 1 mục)</Label><textarea className="min-h-[52px] w-full rounded-md border bg-background p-2 text-sm" value={(s.checklist ?? []).join("\n")} onChange={(e) => upd(i, { checklist: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></div>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, { dayOffset: (steps.at(-1)?.dayOffset ?? 0) + 3, channel: "ZALO", title: "", script: "", checklist: [] }])}><Plus className="h-4 w-4" /> Thêm bước</Button>
        </div>

        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Đang sử dụng</label>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !name}>{saving ? "Đang lưu..." : "Lưu"}</Button></div>
      </form>
    </Modal>
  );
}

function ApplyModal({ apply, customers, onClose, onDone }: { apply: { template: Template; customerId?: string }; customers: Cust[]; onClose: () => void; onDone: () => void }) {
  const [customerId, setCustomerId] = useState(apply.customerId ?? "");
  const [anchorDate, setAnchorDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const r = await apiFetch<{ count: number }>(`/api/followup-templates/${apply.template.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ customerId, anchorDate: anchorDate || undefined, assignee: assignee || undefined }),
      });
      setResult(r.count);
      setTimeout(onDone, 900);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Áp quy trình: ${apply.template.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted-foreground">Sẽ sinh {apply.template.steps.length} việc follow-up theo lịch (mốc = ngày áp + số ngày mỗi bước).</p>
        <div className="space-y-1.5"><Label>Khách hàng *</Label><Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required><option value="">— Chọn khách —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}</Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Mốc bắt đầu</Label><Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Người phụ trách</Label><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="mặc định: bạn" /></div>
        </div>
        {result != null && <p className="text-sm text-emerald-600">✓ Đã tạo {result} việc follow-up.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Đóng</Button><Button type="submit" disabled={saving || !customerId}>{saving ? "Đang áp..." : "Áp quy trình"}</Button></div>
      </form>
    </Modal>
  );
}
