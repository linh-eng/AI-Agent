"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, Ban } from "lucide-react";
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
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_METHOD_LABEL } from "@/lib/clinic-labels";

const METHODS = ["CASH", "CARD", "TRANSFER", "EWALLET", "OTHER"];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canPay = useCan(PERMISSIONS.PAYMENT_WRITE);
  const canWrite = useCan(PERMISSIONS.INVOICE_WRITE);
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setInv(await apiFetch<any>(`/api/invoices/${id}`)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (!confirm("Hủy hóa đơn này? Không thể hoàn tác.")) return;
    setError(null);
    try { await apiFetch(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!inv) return <p className="text-destructive">Không tìm thấy hóa đơn.</p>;

  const total = Number(inv.total);
  const paid = Number(inv.paidAmount ?? 0);
  const outstanding = Number(inv.outstanding ?? Math.max(0, total - paid));
  const canRecord = canPay && inv.status !== "CANCELLED" && outstanding > 0;

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
            {canWrite && inv.status !== "CANCELLED" && inv.payments.length === 0 && (
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

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">Lịch sử thanh toán ({inv.payments.length})</div>
          <Table>
            <THead><TR><TH>Thời điểm</TH><TH className="text-right">Số tiền</TH><TH>Hình thức</TH><TH>Người thu</TH><TH>Ghi chú</TH></TR></THead>
            <TBody>
              {inv.payments.length === 0 ? (
                <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có thanh toán</TD></TR>
              ) : inv.payments.map((p: any) => (
                <TR key={p.id}>
                  <TD>{formatDateTime(p.paidAt)}</TD>
                  <TD className="text-right font-medium">{formatCurrency(Number(p.amount))}</TD>
                  <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TD>
                  <TD>{p.receivedBy ?? "—"}</TD>
                  <TD className="text-muted-foreground">{p.note ?? "—"}</TD>
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
    </div>
  );
}

function PayModal({ open, onClose, outstanding, onSubmit }: { open: boolean; onClose: () => void; outstanding: number; onSubmit: (b: any) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  useEffect(() => { if (open) { setAmount(String(outstanding)); setMethod("CASH"); setNote(""); } }, [open, outstanding]);
  return (
    <Modal open={open} onClose={onClose} title="Thu tiền hóa đơn">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ amount: Number(amount), method, note: note || undefined }); }} className="space-y-4">
        <p className="text-xs text-muted-foreground">Còn phải thu: <span className="font-medium text-foreground">{formatCurrency(outstanding)}</span>. Một hóa đơn có thể thu nhiều lần.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Số tiền *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={outstanding} required /></div>
          <div className="space-y-1.5"><Label>Hình thức</Label><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</Select></div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={!amount || Number(amount) <= 0}>Xác nhận thu</Button></div>
      </form>
    </Modal>
  );
}
