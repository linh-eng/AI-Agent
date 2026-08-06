"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useSession, useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS, REQUEST_TYPES,
  REJECT_REASON_GROUPS, SUPPLEMENT_FIELDS,
} from "@/lib/requests";

const STATUS_TONE: Record<string, any> = {
  DRAFT: "muted", PENDING_RECEIPT: "warning", RECEIVED: "default", IN_PROGRESS: "default",
  PENDING_SUPPLEMENT: "warning", PENDING_ACCEPTANCE: "warning", DONE: "success", REJECTED: "danger", CANCELLED: "muted",
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useSession();
  const canReceive = useCan(PERMISSIONS.REQUEST_RECEIVE);
  const [data, setData] = useState<any>(null);
  const [users, setUsers] = useState<{ id: string; name: string; department?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  // modals
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [conflict, setConflict] = useState({ resolution: "", reason: "" });
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ fields: [] as string[], note: "" });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm, setRejectForm] = useState({ reasonGroup: "", note: "" });
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptForm, setAcceptForm] = useState({ stars: 5, note: "" });

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<any>(`/api/requests/${id}`);
      setData(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<any[]>("/api/directory/users").then(setUsers).catch(() => {}); }, []);

  if (!data) return <div className="text-muted-foreground">{error ?? "Đang tải..."}</div>;
  const r = data.request;
  const def = REQUEST_TYPES[r.type as keyof typeof REQUEST_TYPES];
  const userName = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? data.users?.find((u: any) => u.id === uid)?.name ?? "—";
  const isOwner = r.requesterId === me.userId;

  async function act(action: string, body: any = {}) {
    setBusy(true); setError(null);
    try {
      await apiFetch(`/api/requests/${id}/transition`, { method: "POST", body: JSON.stringify({ action, ...body }) });
      setReceiveOpen(false); setReturnOpen(false); setRejectOpen(false); setAcceptOpen(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const mentions = Array.from(comment.matchAll(/@(\w+)/g)).map((m) => m[1]);
    try {
      await apiFetch(`/api/requests/${id}/comments`, { method: "POST", body: JSON.stringify({ content: comment, mentions }) });
      setComment(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }

  // Đèn SLA
  let slaBadge = null;
  if (r.slaDeadline && !["DONE", "CANCELLED", "REJECTED"].includes(r.status)) {
    const overdue = new Date(r.slaDeadline).getTime() < Date.now();
    const paused = r.status === "PENDING_SUPPLEMENT";
    slaBadge = paused
      ? <Badge tone="muted">SLA tạm dừng</Badge>
      : <Badge tone={overdue ? "danger" : "success"}>Hạn: {formatDateTime(r.slaDeadline)}</Badge>;
  }

  return (
    <div>
      <Link href="/requests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Danh sách yêu cầu</Link>
      <PageHeader
        title={`${r.code}`}
        description={`${def?.label ?? r.type} · ${def?.produces ?? ""}`}
        action={<div className="flex items-center gap-2">{slaBadge}<Badge tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</Badge></div>}
      />

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Thanh hành động hai chiều */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          {r.status === "DRAFT" && isOwner && <Button onClick={() => act("submit")} disabled={busy}><Send className="h-4 w-4" /> Gửi yêu cầu</Button>}
          {r.status === "PENDING_RECEIPT" && canReceive && <Button onClick={() => setReceiveOpen(true)}>Tiếp nhận + gán phụ trách</Button>}
          {r.status === "RECEIVED" && canReceive && <Button onClick={() => act("start")} disabled={busy}>Bắt đầu thực hiện</Button>}
          {r.status === "IN_PROGRESS" && canReceive && <Button onClick={() => act("complete")} disabled={busy}>Kho báo xong</Button>}
          {["PENDING_RECEIPT", "RECEIVED", "IN_PROGRESS"].includes(r.status) && canReceive && (
            <>
              <Button variant="outline" onClick={() => setReturnOpen(true)}>Trả lại bổ sung</Button>
              <Button variant="outline" onClick={() => setRejectOpen(true)}>Từ chối</Button>
            </>
          )}
          {r.status === "PENDING_SUPPLEMENT" && isOwner && <Button onClick={() => act("resubmit")} disabled={busy}>Bổ sung xong — gửi lại</Button>}
          {r.status === "REJECTED" && isOwner && <Button onClick={() => act("review")} disabled={busy}>Yêu cầu xem lại</Button>}
          {r.status === "PENDING_ACCEPTANCE" && isOwner && <Button onClick={() => setAcceptOpen(true)}>Nghiệm thu + chấm điểm</Button>}
          {!["DONE", "CANCELLED"].includes(r.status) && (isOwner || canReceive) && (
            <Button variant="outline" onClick={() => act("cancel", { reason: "Hủy theo yêu cầu" })} disabled={busy}>Hủy</Button>
          )}
          {r.status === "DONE" && r.ratingStars && <span className="text-sm text-muted-foreground">Đánh giá: {"★".repeat(r.ratingStars)}</span>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Thông tin */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Thông tin yêu cầu</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Ưu tiên" value={REQUEST_PRIORITY_LABELS[r.priority as keyof typeof REQUEST_PRIORITY_LABELS]} />
            {r.p1Reason && <Info label="Lý do P1" value={r.p1Reason} />}
            <Info label="Người yêu cầu" value={`${userName(r.requesterId)}${r.requesterDept ? " · " + r.requesterDept : ""}`} />
            <Info label="Người phụ trách" value={r.assigneeId ? userName(r.assigneeId) : "Chưa gán"} />
            {data.partner && <Info label="NCC/Khách" value={`${data.partner.code} · ${data.partner.name}`} />}
            {data.project && <Info label="Dự án" value={`${data.project.code} · ${data.project.name}`} />}
            {r.isCommercialStock && <Info label="Hàng thương mại" value="Có" />}
            <Info label="Địa điểm giao" value={r.deliveryLocation || "—"} />
            <Info label="Thời gian cần có" value={formatDate(r.neededBy)} />
            <Info label="Nội dung" value={r.content || "—"} />
            <Info label="Chứng từ liên quan" value={r.relatedDocCode || "—"} />
            {r.supplementReason && <Info label="Cần bổ sung" value={r.supplementReason} />}
            {r.rejectReasonNote && <Info label="Lý do từ chối" value={`[${r.rejectReasonGroup}] ${r.rejectReasonNote}`} />}
            {r.slaPausedTotalMinutes > 0 && <Info label="Tổng thời gian tạm dừng" value={`${r.slaPausedTotalMinutes} phút (tính cho người gửi)`} />}
          </CardContent>
        </Card>

        {/* Dòng hàng */}
        <Card>
          <CardHeader><CardTitle>Dòng hàng ({r.lines.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Sản phẩm</TH><TH>SL</TH></TR></THead>
              <TBody>
                {r.lines.length === 0 ? <TR><TD colSpan={2} className="py-4 text-center text-muted-foreground">—</TD></TR> :
                  r.lines.map((l: any) => (
                    <TR key={l.id}>
                      <TD>{l.product ? `${l.product.sku} · ${l.product.name}` : l.productText}{l.designatedSerial && <div className="text-xs text-muted-foreground">SN: {l.designatedSerial}</div>}</TD>
                      <TD>{l.quantity}</TD>
                    </TR>
                  ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Dòng thời gian */}
        <Card>
          <CardHeader><CardTitle>Dòng thời gian</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {r.events.map((e: any) => (
              <div key={e.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">
                    {e.fromStatus ? `${REQUEST_STATUS_LABELS[e.fromStatus as keyof typeof REQUEST_STATUS_LABELS]} → ` : ""}{e.toStatus ? REQUEST_STATUS_LABELS[e.toStatus as keyof typeof REQUEST_STATUS_LABELS] : ""}
                  </div>
                  <div className="text-muted-foreground">{e.reason}</div>
                  <div className="text-xs text-muted-foreground">{userName(e.userId)} · {formatDateTime(e.createdAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trao đổi */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Trao đổi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {r.comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có trao đổi. Dùng @tên để nhắc người liên quan.</p>}
            {r.comments.map((c: any) => (
              <div key={c.id} className="rounded-md border p-2 text-sm">
                <div className="text-xs text-muted-foreground">{userName(c.userId)} · {formatDateTime(c.createdAt)}</div>
                <div>{c.content}</div>
              </div>
            ))}
            <form onSubmit={sendComment} className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhập trao đổi, @tên để nhắc..." />
              <Button type="submit" size="sm">Gửi</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Modal tiếp nhận */}
      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Tiếp nhận & gán người phụ trách">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Người phụ trách *</Label>
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Chọn —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` · ${u.department}` : ""}</option>)}
            </Select>
          </div>
          {r.priority === "P1" && (
            <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-2">
              <Label>Xử lý xung đột P1 (nếu người này đã có P1 hôm nay)</Label>
              <Select value={conflict.resolution} onChange={(e) => setConflict({ ...conflict, resolution: e.target.value })}>
                <option value="">— Không xung đột —</option>
                <option value="đổi người phụ trách">Đổi người phụ trách</option>
                <option value="hạ ưu tiên một yêu cầu">Hạ ưu tiên một yêu cầu</option>
                <option value="giãn thời hạn">Giãn thời hạn</option>
                <option value="chấp nhận và chịu trách nhiệm">Chấp nhận và chịu trách nhiệm</option>
              </Select>
              <Input placeholder="Lý do" value={conflict.reason} onChange={(e) => setConflict({ ...conflict, reason: e.target.value })} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Hủy</Button>
            <Button disabled={busy || !assignee} onClick={() => act("receive", { assigneeId: assignee, conflictResolution: conflict.resolution || undefined, conflictReason: conflict.reason || undefined })}>Tiếp nhận</Button>
          </div>
        </div>
      </Modal>

      {/* Modal trả lại bổ sung */}
      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Trả lại bổ sung">
        <div className="space-y-3">
          <Label>Trường còn thiếu</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {SUPPLEMENT_FIELDS.map((f) => (
              <label key={f.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={returnForm.fields.includes(f.code)} onChange={() => setReturnForm((s) => ({ ...s, fields: s.fields.includes(f.code) ? s.fields.filter((x) => x !== f.code) : [...s.fields, f.code] }))} />
                {f.label}
              </label>
            ))}
          </div>
          <Input placeholder="Cần bổ sung gì (bắt buộc)" value={returnForm.note} onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })} />
          <p className="text-xs text-muted-foreground">Đồng hồ SLA sẽ tạm dừng, thời gian chờ tính cho người gửi.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Hủy</Button>
            <Button disabled={busy || !returnForm.note} onClick={() => act("return", returnForm)}>Trả lại bổ sung</Button>
          </div>
        </div>
      </Modal>

      {/* Modal từ chối */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Từ chối yêu cầu">
        <div className="space-y-3">
          <Label>Nhóm lý do *</Label>
          <Select value={rejectForm.reasonGroup} onChange={(e) => setRejectForm({ ...rejectForm, reasonGroup: e.target.value })}>
            <option value="">— Chọn —</option>
            {REJECT_REASON_GROUPS.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </Select>
          <Input placeholder="Diễn giải (bắt buộc)" value={rejectForm.note} onChange={(e) => setRejectForm({ ...rejectForm, note: e.target.value })} />
          <p className="text-xs text-muted-foreground">Người gửi sẽ có nút "Yêu cầu xem lại" để quay lại Chờ tiếp nhận (cùng mã).</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Hủy</Button>
            <Button disabled={busy || !rejectForm.reasonGroup || !rejectForm.note} onClick={() => act("reject", rejectForm)}>Từ chối</Button>
          </div>
        </div>
      </Modal>

      {/* Modal nghiệm thu */}
      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title="Nghiệm thu & chấm điểm phục vụ">
        <div className="space-y-3">
          <Label>Đánh giá (1–5 sao)</Label>
          <Select value={String(acceptForm.stars)} onChange={(e) => setAcceptForm({ ...acceptForm, stars: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
          </Select>
          <Input placeholder="Nhận xét (tùy chọn)" value={acceptForm.note} onChange={(e) => setAcceptForm({ ...acceptForm, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Hủy</Button>
            <Button disabled={busy} onClick={() => act("accept", acceptForm)}>Xác nhận hoàn tất</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
