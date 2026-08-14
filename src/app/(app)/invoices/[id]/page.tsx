"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, Ban, PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_METHOD_LABEL, DEPOSIT_STATUS_LABEL } from "@/lib/clinic-labels";

const METHODS = ["CASH", "CARD", "TRANSFER", "EWALLET", "OTHER"];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canPay = useCan(PERMISSIONS.PAYMENT_WRITE);
  const canVoid = useCan(PERMISSIONS.PAYMENT_VOID);
  const canDeposit = useCan(PERMISSIONS.DEPOSIT_WRITE);
  const canWrite = useCan(PERMISSIONS.INVOICE_WRITE);
  const [inv, setInv] = useState<any>(null);
  const [activeDeposits, setActiveDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/invoices/${id}`);
      setInv(data);
      if (data && data.status !== "CANCELLED") {
        setActiveDeposits(
          await apiFetch<any[]>(`/api/deposits?customerId=${data.customer.id}&status=ACTIVE`).catch(() => [])
        );
      } else setActiveDeposits([]);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (!confirm("Hủy hóa đơn này? Không thể hoàn tác.")) return;
    setError(null);
    try { await apiFetch(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function allocate(depositId: string) {
    setError(null);
    try { await apiFetch(`/api/deposits/${depositId}/allocate`, { method: "POST", body: JSON.stringify({ invoiceId: id }) }); setDepOpen(false); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function voidPayment(reason: string) {
    if (!voidTarget) return;
    setError(null);
    try { await apiFetch(`/api/payments/${voidTarget.id}/void`, { method: "POST", body: JSON.stringify({ reason }) }); setVoidTarget(null); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!inv) return <p className="text-destructive">Không tìm thấy hóa đơn.</p>;

  const total = Number(inv.total);
  const paid = Number(inv.paidAmount ?? 0);
  const outstanding = Number(inv.outstanding ?? Math.max(0, total - paid));
  const canRecord = canPay && inv.status !== "CANCELLED" && outstanding > 0;
  const activePayments = (inv.payments as any[]).filter((p) => !p.voidedAt);
  const allocatedDeposits = (inv.deposits as any[])?.filter((d) => d.status === "ALLOCATED") ?? [];
  const canBlockCancel = activePayments.length === 0 && allocatedDeposits.length === 0;

  return (
    <div>
      <Link href="/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách hóa đơn
      </Link>
      <PageHeader
        title={`Hóa đơn ${inv.code}`}
        description={`Khách: ${inv.customer.fullName} (${inv.customer.code})${inv.proposal ? ` · Từ báo giá ${inv.proposal.code}` : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
            {canRecord && <Button onClick={() => setPayOpen(true)}><Wallet className="h-4 w-4" /> Thu tiền</Button>}
            {canDeposit && inv.status !== "CANCELLED" && outstanding > 0 && activeDeposits.length > 0 && (
              <Button variant="outline" onClick={() => setDepOpen(true)}><PiggyBank className="h-4 w-4" /> Dùng cọc ({activeDeposits.length})</Button>
            )}
            {canWrite && inv.status !== "CANCELLED" && canBlockCancel && (
              <Button variant="outline" onClick={cancel}><Ban className="h-4 w-4" /> Hủy</Button>
            )}
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tổng phải thu</div><div className="mt-1 text-2xl font-semibold">{formatCurrency(total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Đã thanh toán</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(paid)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Còn phải thu</div><div className="mt-1 text-2xl font-semibold text-amber-600">{formatCurrency(outstanding)}</div></CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">Hạng mục</div>
          <Table>
            <THead><TR><TH>Tên</TH><TH className="text-right">SL</TH><TH className="text-right">Đơn giá</TH><TH className="text-right">Thành tiền</TH></TR></THead>
            <TBody>
              {inv.items.map((it: any) => (
                <TR key={it.id}>
                  <TD>{it.name}{it.note ? <span className="ml-1 text-xs text-muted-foreground">({it.note})</span> : ""}</TD>
                  <TD className="text-right">{it.quantity}</TD>
                  <TD className="text-right">{formatCurrency(Number(it.unitPrice))}</TD>
                  <TD className="text-right">{formatCurrency(Number(it.amount))}</TD>
                </TR>
              ))}
              <TR><TD colSpan={3} className="text-right text-muted-foreground">Tổng hạng mục</TD><TD className="text-right">{formatCurrency(Number(inv.subtotal))}</TD></TR>
              {Number(inv.discount) > 0 && <TR><TD colSpan={3} className="text-right text-muted-foreground">Chiết khấu</TD><TD className="text-right">-{formatCurrency(Number(inv.discount))}</TD></TR>}
              <TR><TD colSpan={3} className="text-right font-semibold">Phải thu</TD><TD className="text-right font-semibold text-primary">{formatCurrency(total)}</TD></TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {allocatedDeposits.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-medium">Tiền cọc đã phân bổ ({allocatedDeposits.length})</div>
            <Table>
              <THead><TR><TH>Mã cọc</TH><TH className="text-right">Số tiền</TH><TH>Hình thức</TH><TH>Phân bổ lúc</TH><TH>Người phân bổ</TH></TR></THead>
              <TBody>
                {allocatedDeposits.map((d: any) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.code}</TD>
                    <TD className="text-right font-medium text-emerald-600">{formatCurrency(Number(d.amount))}</TD>
                    <TD>{PAYMENT_METHOD_LABEL[d.method] ?? d.method}</TD>
                    <TD>{d.allocatedAt ? formatDateTime(d.allocatedAt) : "—"}</TD>
                    <TD>{d.allocatedBy ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">Lịch sử thanh toán ({inv.payments.length})</div>
          <Table>
            <THead><TR><TH>Mã</TH><TH>Thời điểm</TH><TH className="text-right">Số tiền</TH><TH>Hình thức</TH><TH>Người thu</TH><TH>Trạng thái</TH><TH className="text-right">Thao tác / Chi tiết hủy</TH></TR></THead>
            <TBody>
              {inv.payments.length === 0 ? (
                <TR><TD colSpan={7} className="py-6 text-center text-muted-foreground">Chưa có thanh toán</TD></TR>
              ) : inv.payments.map((p: any) => (
                <TR key={p.id} className={p.voidedAt ? "opacity-60" : ""}>
                  <TD className="text-xs text-muted-foreground">{p.code ?? "—"}</TD>
                  <TD>{formatDateTime(p.paidAt)}</TD>
                  <TD className={`text-right font-medium ${p.voidedAt ? "line-through" : ""}`}>{formatCurrency(Number(p.amount))}</TD>
                  <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}{p.txnRef ? <span className="ml-1 text-xs text-muted-foreground">#{p.txnRef}</span> : ""}</TD>
                  <TD>{p.receivedBy ?? "—"}</TD>
                  <TD>{p.voidedAt ? <Badge tone="muted">Đã hủy</Badge> : <Badge tone="success">Hợp lệ</Badge>}</TD>
                  <TD className="text-right">
                    {!p.voidedAt && canVoid && inv.status !== "CANCELLED" && (
                      <Button size="sm" variant="ghost" onClick={() => setVoidTarget(p)}><Ban className="h-3.5 w-3.5" /> Hủy</Button>
                    )}
                    {p.voidedAt && (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <div>Người hủy: <span className="font-medium text-foreground">{p.voidedBy ?? "—"}</span></div>
                        <div>Thời điểm: {formatDateTime(p.voidedAt)}</div>
                        <div>Lý do: <span className="text-foreground">{p.voidReason ?? "—"}</span></div>
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <PayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        outstanding={outstanding}
        onSubmit={async (body) => {
          setError(null);
          try {
            await apiFetch("/api/payments", { method: "POST", body: JSON.stringify({ ...body, customerId: inv.customer.id, invoiceId: inv.id }) });
            setPayOpen(false); load();
          } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
        }}
      />

      <Modal open={depOpen} onClose={() => setDepOpen(false)} title="Phân bổ tiền cọc vào hóa đơn">
        <p className="mb-3 text-xs text-muted-foreground">Chọn phiếu cọc đang giữ để phân bổ vào hóa đơn này. Mỗi cọc chỉ phân bổ MỘT lần, và không vượt quá số còn phải thu ({formatCurrency(outstanding)}).</p>
        <div className="space-y-2">
          {activeDeposits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Khách không có phiếu cọc đang giữ.</p>
          ) : activeDeposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">{d.code} · {formatCurrency(Number(d.amount))}</div>
                <div className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABEL[d.method] ?? d.method}{d.booking ? ` · Lịch ${d.booking.code}` : ""} · {formatDateTime(d.receivedAt)}</div>
              </div>
              <Button size="sm" disabled={Number(d.amount) - outstanding > 1e-6} onClick={() => allocate(d.id)}>
                {Number(d.amount) - outstanding > 1e-6 ? "Vượt công nợ" : "Phân bổ"}
              </Button>
            </div>
          ))}
        </div>
      </Modal>

      <VoidModal open={!!voidTarget} onClose={() => setVoidTarget(null)} payment={voidTarget} onSubmit={voidPayment} />
    </div>
  );
}

function PayModal({ open, onClose, outstanding, onSubmit }: { open: boolean; onClose: () => void; outstanding: number; onSubmit: (b: any) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [txnRef, setTxnRef] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (open) { setAmount(String(outstanding)); setMethod("CASH"); setTxnRef(""); setNote(""); } }, [open, outstanding]);
  return (
    <Modal open={open} onClose={onClose} title="Thu tiền hóa đơn">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ amount: Number(amount), method, txnRef: txnRef || undefined, note: note || undefined }); }} className="space-y-4">
        <p className="text-xs text-muted-foreground">Còn phải thu: <span className="font-medium text-foreground">{formatCurrency(outstanding)}</span>. Một hóa đơn có thể thu nhiều lần.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Số tiền *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={outstanding} required /></div>
          <div className="space-y-1.5"><Label>Hình thức</Label><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Mã giao dịch</Label><Input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} placeholder="Số CK / mã POS..." /></div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={!amount || Number(amount) <= 0}>Xác nhận thu</Button></div>
      </form>
    </Modal>
  );
}

function VoidModal({ open, onClose, payment, onSubmit }: { open: boolean; onClose: () => void; payment: any; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!payment) return null;
  return (
    <Modal open={open} onClose={onClose} title="Hủy phiếu thu">
      <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }} className="space-y-4">
        <p className="text-xs text-muted-foreground">Hủy phiếu thu <span className="font-medium text-foreground">{payment.code ?? ""} · {formatCurrency(Number(payment.amount))}</span>. Phiếu được GIỮ LẠI (không xóa) và ghi vết lý do; công nợ hóa đơn được tính lại.</p>
        <div className="space-y-1.5"><Label>Lý do hủy *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: thu nhầm hóa đơn, khách hoàn tiền..." required /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Đóng</Button><Button type="submit" variant="destructive" disabled={!reason.trim()}>Xác nhận hủy phiếu</Button></div>
      </form>
    </Modal>
  );
}
