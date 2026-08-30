"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/clinic-labels";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string; code?: string | null; amount: string | number; method: string; txnRef?: string | null; paidAt: string; receivedBy?: string | null; note?: string | null;
  voidedAt?: string | null; voidReason?: string | null;
  customer: { code: string; fullName: string };
  invoice?: { code: string } | null;
  invoiceId?: string | null;
}

export default function PaymentsPage() {
  const canWrite = useCan(PERMISSIONS.PAYMENT_WRITE);
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<Payment[]>("/api/payments").then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const total = rows.filter((r) => !r.voidedAt).reduce((s, r) => s + Number(r.amount), 0);
  const voidedCount = rows.filter((r) => r.voidedAt).length;

  return (
    <div>
      <PageHeader
        title="Thanh toán"
        description="Sổ thu tiền — mỗi khoản gắn với hóa đơn. Ghi nhận thu tiền tại màn hóa đơn."
        action={canWrite && <Link href="/invoices"><Button variant="outline"><Plus className="h-4 w-4" /> Thu tiền (hóa đơn)</Button></Link>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Số lượt thu</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tổng đã thu (hợp lệ)</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Phiếu đã hủy</div><div className="mt-1 text-2xl font-semibold text-muted-foreground">{voidedCount}</div></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Thời điểm</TH><TH>Khách</TH><TH>Hóa đơn</TH><TH className="text-right">Số tiền</TH><TH>Hình thức</TH><TH>Người thu</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có thanh toán</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id} className={p.voidedAt ? "opacity-60" : ""}>
                    <TD className="text-xs text-muted-foreground">{p.code ?? "—"}</TD>
                    <TD>{formatDateTime(p.paidAt)}</TD>
                    <TD>{p.customer.fullName}</TD>
                    <TD className="font-mono">{p.invoiceId && p.invoice ? <Link href={`/invoices/${p.invoiceId}`} className="text-primary hover:underline">{p.invoice.code}</Link> : "—"}</TD>
                    <TD className={`text-right font-medium ${p.voidedAt ? "line-through" : ""}`}>{formatCurrency(Number(p.amount))}</TD>
                    <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}{p.txnRef ? <span className="ml-1 text-xs text-muted-foreground">#{p.txnRef}</span> : ""}</TD>
                    <TD>{p.receivedBy ?? "—"}</TD>
                    <TD>{p.voidedAt ? <Badge tone="muted" title={p.voidReason ?? undefined}>Đã hủy</Badge> : <Badge tone="success">Hợp lệ</Badge>}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
