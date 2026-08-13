"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/lib/clinic-labels";

interface Invoice {
  id: string; code: string; status: string; issuedAt: string;
  total: string | number; paidAmount: number; outstanding: number;
  customer: { code: string; fullName: string };
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    apiFetch<Invoice[]>("/api/invoices").then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const shown = filter ? rows.filter((r) => r.status === filter) : rows;
  const totalOutstanding = rows
    .filter((r) => r.status !== "CANCELLED")
    .reduce((s, r) => s + Number(r.outstanding || 0), 0);

  return (
    <div>
      <PageHeader
        title="Hóa đơn"
        description="Báo giá đã chốt → hóa đơn → thanh toán. Công nợ được tính theo hóa đơn."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tổng số hóa đơn</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Còn phải thu (công nợ)</div><div className="mt-1 text-2xl font-semibold text-amber-600">{formatCurrency(totalOutstanding)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Đã thanh toán đủ</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{rows.filter((r) => r.status === "PAID").length}</div></CardContent></Card>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {["", "UNPAID", "PARTIAL", "PAID", "CANCELLED"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/50"}`}
          >
            {s === "" ? "Tất cả" : INVOICE_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã HĐ</TH><TH>Khách</TH><TH>Ngày</TH><TH className="text-right">Tổng</TH><TH className="text-right">Đã trả</TH><TH className="text-right">Còn thu</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : shown.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có hóa đơn. Tạo từ một báo giá đã chốt.</TD></TR>
              ) : (
                shown.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium"><Link href={`/invoices/${r.id}`} className="text-primary hover:underline">{r.code}</Link></TD>
                    <TD>{r.customer.fullName}</TD>
                    <TD>{formatDate(r.issuedAt)}</TD>
                    <TD className="text-right">{formatCurrency(Number(r.total))}</TD>
                    <TD className="text-right text-emerald-600">{formatCurrency(r.paidAmount)}</TD>
                    <TD className="text-right font-medium text-amber-600">{formatCurrency(r.outstanding)}</TD>
                    <TD><Badge tone={INVOICE_STATUS_TONE[r.status]}>{INVOICE_STATUS_LABEL[r.status]}</Badge></TD>
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
