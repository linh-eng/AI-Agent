"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/clinic-labels";

interface Payment {
  id: string; amount: string | number; method: string; paidAt: string; receivedBy?: string | null; note?: string | null;
  customer: { code: string; fullName: string };
  invoice?: { code: string } | null;
  invoiceId?: string | null;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<Payment[]>("/api/payments").then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Thanh toán"
        description="Sổ thu tiền — mỗi khoản gắn với hóa đơn. Ghi nhận thu tiền tại màn hóa đơn."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Số lượt thu</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tổng đã thu</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(total)}</div></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Thời điểm</TH><TH>Khách</TH><TH>Hóa đơn</TH><TH className="text-right">Số tiền</TH><TH>Hình thức</TH><TH>Người thu</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có thanh toán</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD>{formatDateTime(p.paidAt)}</TD>
                    <TD>{p.customer.fullName}</TD>
                    <TD className="font-mono">{p.invoiceId && p.invoice ? <Link href={`/invoices/${p.invoiceId}`} className="text-primary hover:underline">{p.invoice.code}</Link> : "—"}</TD>
                    <TD className="text-right font-medium">{formatCurrency(Number(p.amount))}</TD>
                    <TD>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TD>
                    <TD>{p.receivedBy ?? "—"}</TD>
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
