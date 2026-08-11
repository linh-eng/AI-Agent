"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, Phone, Mail, MapPin, User, ArrowLeft } from "lucide-react";
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
  GENDER_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_TONE,
  CRM_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  TIMELINE_KIND_LABEL,
  TIMELINE_KIND_TONE,
} from "@/lib/clinic-labels";

interface Customer {
  id: string;
  code: string;
  fullName: string;
  gender?: string | null;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  source?: string | null;
  group?: string | null;
  assignedTo?: string | null;
  goals?: string | null;
  note?: string | null;
  financials: { totalPaid: number; totalBilled: number; debt: number };
  timeline: { id: string; at: string; kind: string; title: string; detail?: string; status?: string }[];
  bookings: any[];
  assessments: any[];
  plans: any[];
  payments: any[];
  activities: any[];
  tasks: any[];
  canSeeFinance: boolean;
}

const TABS = ["timeline", "crm", "bookings", "plans", "assessments", "payments"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  timeline: "Timeline",
  crm: "Nhật ký CSKH",
  bookings: "Booking",
  plans: "Phác đồ",
  assessments: "Đánh giá",
  payments: "Thanh toán",
};

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const canCrm = useCan(PERMISSIONS.CRM_WRITE);
  const canPay = useCan(PERMISSIONS.PAYMENT_WRITE);
  const canTreat = useCan(PERMISSIONS.TREATMENT_WRITE);

  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [modal, setModal] = useState<null | "crm" | "payment" | "assessment">(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setC(await apiFetch<Customer>(`/api/customers/${id}`));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function submit(url: string, body: unknown) {
    setError(null);
    try {
      await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!c) return <p className="text-destructive">Không tìm thấy khách hàng.</p>;

  return (
    <div>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách khách hàng
      </Link>
      <PageHeader
        title={c.fullName}
        description={`Mã ${c.code}${c.group ? " · " + c.group : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canCrm && (
              <Button variant="outline" onClick={() => setModal("crm")}>
                <Plus className="h-4 w-4" /> Nhật ký CSKH
              </Button>
            )}
            {canPay && (
              <Button variant="outline" onClick={() => setModal("payment")}>
                <Plus className="h-4 w-4" /> Thanh toán
              </Button>
            )}
            {canTreat && (
              <Button variant="outline" onClick={() => setModal("assessment")}>
                <Plus className="h-4 w-4" /> Đánh giá
              </Button>
            )}
          </div>
        }
      />

      {/* Thông tin + tài chính */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-3">
            <Info icon={User} label="Giới tính" value={c.gender ? GENDER_LABEL[c.gender] : "—"} />
            <Info icon={Phone} label="Điện thoại" value={c.phone ?? "—"} />
            <Info icon={Mail} label="Email" value={c.email ?? "—"} />
            <Info icon={User} label="Ngày sinh" value={c.dob ? formatDate(c.dob) : "—"} />
            <Info icon={User} label="Phụ trách" value={c.assignedTo ?? "—"} />
            <Info icon={MapPin} label="Nguồn" value={c.source ?? "—"} />
            <div className="col-span-2 sm:col-span-3">
              <div className="text-xs text-muted-foreground">Mong muốn / mục tiêu</div>
              <div>{c.goals ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng giá trị</span>
              <span className="font-medium">{formatNumber(c.financials.totalBilled)} ₫</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đã thanh toán</span>
              <span className="font-medium text-emerald-600">{formatNumber(c.financials.totalPaid)} ₫</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Công nợ</span>
              <span className={`font-semibold ${c.financials.debt > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatNumber(c.financials.debt)} ₫
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <Card>
          <CardContent className="p-5">
            {c.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có sự kiện.</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-6">
                {c.timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TIMELINE_KIND_TONE[e.kind] ?? "muted"}>{TIMELINE_KIND_LABEL[e.kind] ?? e.kind}</Badge>
                      <span className="font-medium">{e.title}</span>
                      {e.status && <span className="text-xs text-muted-foreground">· {e.status}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(e.at)}</span>
                    </div>
                    {e.detail && <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "crm" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Thời gian</TH>
                  <TH>Loại</TH>
                  <TH>Nội dung</TH>
                  <TH>Kết quả</TH>
                  <TH>Follow-up</TH>
                </TR>
              </THead>
              <TBody>
                {c.activities.length === 0 ? (
                  <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có nhật ký</TD></TR>
                ) : (
                  c.activities.map((a) => (
                    <TR key={a.id}>
                      <TD>{formatDate(a.occurredAt)}</TD>
                      <TD><Badge tone="default">{CRM_TYPE_LABEL[a.type] ?? a.type}</Badge></TD>
                      <TD>{a.content}</TD>
                      <TD>{a.result ?? "—"}</TD>
                      <TD>{a.followUpDate ? formatDate(a.followUpDate) : "—"}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "bookings" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>Mã</TH><TH>Thời gian</TH><TH>Dịch vụ</TH><TH>Trạng thái</TH><TH className="text-right">Giá</TH></TR>
              </THead>
              <TBody>
                {c.bookings.length === 0 ? (
                  <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có booking</TD></TR>
                ) : (
                  c.bookings.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-mono">{b.code}</TD>
                      <TD>{formatDate(b.scheduledAt)}</TD>
                      <TD>{b.service?.name ?? "—"}</TD>
                      <TD><Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge></TD>
                      <TD className="text-right">{b.price ? formatNumber(Number(b.price)) + " ₫" : "—"}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "plans" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>Mã</TH><TH>Tên phác đồ</TH><TH>Version</TH><TH>Số buổi</TH><TH>Trạng thái</TH><TH></TH></TR>
              </THead>
              <TBody>
                {c.plans.length === 0 ? (
                  <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">Chưa có phác đồ</TD></TR>
                ) : (
                  c.plans.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-mono">{p.code}</TD>
                      <TD>{p.name}</TD>
                      <TD>v{p.version}</TD>
                      <TD>{p._count?.sessions ?? 0}</TD>
                      <TD><Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge></TD>
                      <TD><Link href={`/treatment-plans/${p.id}`} className="text-sm text-primary hover:underline">Mở</Link></TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "assessments" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>Ngày</TH><TH>Tình trạng</TH><TH>Vùng</TH><TH>Mức độ</TH><TH>Mô tả</TH><TH>Người ĐG</TH></TR>
              </THead>
              <TBody>
                {c.assessments.length === 0 ? (
                  <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">Chưa có đánh giá</TD></TR>
                ) : (
                  c.assessments.map((a) => (
                    <TR key={a.id}>
                      <TD>{formatDate(a.assessedAt)}</TD>
                      <TD className="font-medium">{a.name}</TD>
                      <TD>{a.area ?? "—"}</TD>
                      <TD>{a.severity ?? "—"}</TD>
                      <TD>{a.description ?? "—"}</TD>
                      <TD>{a.assessedBy ?? "—"}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>Ngày</TH><TH>Hình thức</TH><TH>Ghi chú</TH><TH>Người thu</TH><TH className="text-right">Số tiền</TH></TR>
              </THead>
              <TBody>
                {c.payments.length === 0 ? (
                  <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có thanh toán</TD></TR>
                ) : (
                  c.payments.map((p) => (
                    <TR key={p.id}>
                      <TD>{formatDate(p.paidAt)}</TD>
                      <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TD>
                      <TD>{p.note ?? "—"}</TD>
                      <TD>{p.receivedBy ?? "—"}</TD>
                      <TD className="text-right font-medium">{formatNumber(Number(p.amount))} ₫</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CrmModal open={modal === "crm"} onClose={() => setModal(null)} error={error} onSubmit={(body) => submit("/api/crm-activities", { ...body, customerId: id })} />
      <PaymentModal open={modal === "payment"} onClose={() => setModal(null)} error={error} debt={c.financials.debt} onSubmit={(body) => submit("/api/payments", { ...body, customerId: id })} />
      <AssessmentModal open={modal === "assessment"} onClose={() => setModal(null)} error={error} onSubmit={(body) => submit("/api/assessments", { ...body, customerId: id })} />
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function CrmModal({ open, onClose, onSubmit, error }: { open: boolean; onClose: () => void; onSubmit: (b: any) => void; error: string | null }) {
  const [f, setF] = useState({ type: "CALL", content: "", result: "", nextAction: "", followUpDate: "", followUpOwner: "" });
  return (
    <Modal open={open} onClose={onClose} title="Thêm nhật ký CSKH">
      <form
        onSubmit={(e) => { e.preventDefault(); const b: any = { ...f }; if (!b.followUpDate) delete b.followUpDate; onSubmit(b); }}
        className="space-y-4"
      >
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
        <p className="text-sm text-muted-foreground">Công nợ hiện tại: <span className="font-medium text-foreground">{formatNumber(debt)} ₫</span></p>
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
