"use client";
import { useEffect, useState } from "react";
import { Printer, Download, TrendingUp, Users, CalendarCheck, Wallet, FileText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatCurrency } from "@/lib/utils";

type Report = {
  generatedAt: string;
  kpi: { revenueMonth: number | null; revenueYear: number | null; totalOutstanding: number | null; recognizedRevenueMonth: number | null; recognizedRevenueYear: number | null; bookingsToday: number; newCustomersMonth: number; totalActiveCustomers: number; sessionsMonth: number; openInvoices: number };
  revenueSeries: { month: string; value: number }[] | null;
  paymentsByMethod: { label: string; amount: number; count: number }[] | null;
  bookingsByStatus: { label: string; count: number }[];
  debtByCustomer: { code: string; name: string; outstanding: number; invoices: number }[] | null;
  topServices: { code: string; name: string; count: number }[];
};

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function Kpi({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const bg = tone === "success" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-primary/10 text-primary";
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
      <div><div className="text-xl font-bold leading-tight">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
    </CardContent></Card>
  );
}

function Section({ title, csv, children }: { title: string; csv?: () => void; children: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {csv && <Button size="sm" variant="outline" onClick={csv}><Download className="h-3.5 w-3.5" /> CSV</Button>}
      </div>
      {children}
    </CardContent></Card>
  );
}

export default function SpaReportPage() {
  const [d, setD] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch<Report>("/api/spa-reports").then(setD).catch(() => {}).finally(() => setLoading(false)); }, []);

  const fin = (v: number | null) => (v == null ? "—" : formatCurrency(v));
  const maxRev = d?.revenueSeries?.reduce((m, x) => Math.max(m, x.value), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Báo cáo kinh doanh Spa"
        description="Doanh thu · Công nợ · Lịch hẹn · Dịch vụ · Khách hàng — tổng hợp từ hóa đơn/thanh toán/buổi thực hiện."
        action={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> In báo cáo</Button>}
      />

      {loading ? <p className="text-muted-foreground">Đang tải...</p> : !d ? <p className="text-muted-foreground">Không tải được báo cáo.</p> : (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Tiền thực thu (tháng)" value={fin(d.kpi.revenueMonth)} tone="success" />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Tiền thực thu (năm)" value={fin(d.kpi.revenueYear)} tone="success" />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Doanh thu ghi nhận (tháng)" value={fin(d.kpi.recognizedRevenueMonth)} />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Doanh thu ghi nhận (năm)" value={fin(d.kpi.recognizedRevenueYear)} />
            <Kpi icon={<Wallet className="h-5 w-5" />} label={`Công nợ còn lại (${d.kpi.openInvoices} HĐ)`} value={fin(d.kpi.totalOutstanding)} tone="danger" />
            <Kpi icon={<CalendarCheck className="h-5 w-5" />} label="Lịch hẹn hôm nay" value={formatNumber(d.kpi.bookingsToday)} />
            <Kpi icon={<Sparkles className="h-5 w-5" />} label="Buổi thực hiện (tháng)" value={formatNumber(d.kpi.sessionsMonth)} />
            <Kpi icon={<Users className="h-5 w-5" />} label="Khách mới (tháng)" value={formatNumber(d.kpi.newCustomersMonth)} />
            <Kpi icon={<Users className="h-5 w-5" />} label="Tổng khách đang hoạt động" value={formatNumber(d.kpi.totalActiveCustomers)} />
            <Kpi icon={<FileText className="h-5 w-5" />} label="Hóa đơn còn nợ" value={formatNumber(d.kpi.openInvoices)} tone="warning" />
          </div>

          {/* Doanh thu 12 tháng */}
          {d.revenueSeries && (
            <Section title="Doanh thu 12 tháng gần nhất" csv={() => downloadCsv("doanh-thu-thang.csv", ["Tháng", "Doanh thu"], d.revenueSeries!.map((r) => [r.month, r.value]))}>
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: 160 }}>
                {d.revenueSeries.map((r) => (
                  <div key={r.month} className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-1">
                    <div className="text-[10px] text-muted-foreground">{r.value ? formatNumber(Math.round(r.value / 1000)) + "k" : ""}</div>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${maxRev ? Math.max(2, (r.value / maxRev) * 120) : 2}px` }} />
                    <div className="text-[10px] text-muted-foreground">{r.month.slice(5)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Thanh toán theo phương thức */}
            {d.paymentsByMethod && (
              <Section title="Thu tiền theo phương thức (tháng)" csv={() => downloadCsv("thu-theo-phuong-thuc.csv", ["Phương thức", "Số phiếu", "Số tiền"], d.paymentsByMethod!.map((m) => [m.label, m.count, m.amount]))}>
                {d.paymentsByMethod.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có thu tiền tháng này.</p> : (
                  <Table><THead><TR><TH>Phương thức</TH><TH className="text-right">Số phiếu</TH><TH className="text-right">Số tiền</TH></TR></THead>
                    <TBody>{d.paymentsByMethod.map((m) => <TR key={m.label}><TD>{m.label}</TD><TD className="text-right">{m.count}</TD><TD className="text-right font-medium">{formatCurrency(m.amount)}</TD></TR>)}</TBody>
                  </Table>
                )}
              </Section>
            )}

            {/* Lịch hẹn theo trạng thái */}
            <Section title="Lịch hẹn theo trạng thái (tháng)" csv={() => downloadCsv("lich-hen-trang-thai.csv", ["Trạng thái", "Số lượng"], d.bookingsByStatus.map((b) => [b.label, b.count]))}>
              {d.bookingsByStatus.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có lịch hẹn tháng này.</p> : (
                <Table><THead><TR><TH>Trạng thái</TH><TH className="text-right">Số lượng</TH></TR></THead>
                  <TBody>{d.bookingsByStatus.map((b) => <TR key={b.label}><TD>{b.label}</TD><TD className="text-right font-medium">{b.count}</TD></TR>)}</TBody>
                </Table>
              )}
            </Section>
          </div>

          {/* Công nợ theo khách */}
          {d.debtByCustomer && (
            <Section title="Công nợ theo khách hàng" csv={() => downloadCsv("cong-no-khach.csv", ["Mã KH", "Khách hàng", "Số HĐ", "Còn nợ"], d.debtByCustomer!.map((r) => [r.code, r.name, r.invoices, r.outstanding]))}>
              {d.debtByCustomer.length === 0 ? <p className="text-sm text-muted-foreground">Không có công nợ.</p> : (
                <div className="overflow-x-auto"><Table><THead><TR><TH>Mã KH</TH><TH>Khách hàng</TH><TH className="text-right">Số HĐ</TH><TH className="text-right">Còn nợ</TH></TR></THead>
                  <TBody>{d.debtByCustomer.map((r) => <TR key={r.code + r.name}><TD className="font-mono">{r.code}</TD><TD>{r.name}</TD><TD className="text-right">{r.invoices}</TD><TD className="text-right font-medium text-rose-600">{formatCurrency(r.outstanding)}</TD></TR>)}</TBody>
                </Table></div>
              )}
            </Section>
          )}

          {/* Top dịch vụ */}
          <Section title="Top dịch vụ theo lượt thực hiện (năm nay)" csv={() => downloadCsv("top-dich-vu.csv", ["Mã", "Dịch vụ", "Lượt"], d.topServices.map((s) => [s.code, s.name, s.count]))}>
            {d.topServices.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có buổi thực hiện.</p> : (
              <Table><THead><TR><TH>Mã</TH><TH>Dịch vụ</TH><TH className="text-right">Lượt</TH></TR></THead>
                <TBody>{d.topServices.map((s) => <TR key={s.code + s.name}><TD className="font-mono">{s.code}</TD><TD>{s.name}</TD><TD className="text-right font-medium">{s.count}</TD></TR>)}</TBody>
              </Table>
            )}
          </Section>

          {!d.revenueSeries && <p className="text-xs text-muted-foreground">* Dữ liệu doanh thu/công nợ chỉ hiển thị với người có quyền xem tài chính.</p>}
        </div>
      )}
    </div>
  );
}
