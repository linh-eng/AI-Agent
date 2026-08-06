"use client";
import { useEffect, useState } from "react";
import { Download, Printer, Wrench, ShieldCheck, Hammer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/utils";

export default function ReportsPage() {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    apiFetch("/api/reports/summary").then(setD).catch(() => {});
  }, []);

  if (!d) return <p className="text-muted-foreground">Đang tải...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between no-print">
        <div />
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> In báo cáo</Button>
      </div>
      <div className="print-area">
        <PageHeader title="Báo cáo tổng hợp" description="Nhập–Xuất–Tồn, theo NCC, tồn đọng quá hạn, lắp ráp, bảo hành, rã máy." />

        {/* KPI cards */}
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4"><Wrench className="h-5 w-5 text-primary" /><div><div className="text-xl font-bold">{d.assembly.doneWo}/{d.assembly.totalWo}</div><div className="text-xs text-muted-foreground">WO hoàn thành</div></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><div><div className="text-xl font-bold">{d.assembly.qcFailRate}%</div><div className="text-xs text-muted-foreground">Tỷ lệ QC fail</div></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5 text-amber-600" /><div><div className="text-xl font-bold">{d.warranty.openRma}</div><div className="text-xs text-muted-foreground">RMA đang mở</div></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Hammer className="h-5 w-5 text-primary" /><div><div className="text-xl font-bold">{d.disassembly.recovered}</div><div className="text-xs text-muted-foreground">Linh kiện thu hồi (rã máy)</div></div></CardContent></Card>
        </div>

        {/* NXT theo kho */}
        <Card className="mb-4">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Nhập – Xuất – Tồn theo kho</CardTitle>
            <Button size="sm" variant="ghost" className="no-print" onClick={() => downloadCsv("nhap-xuat-ton", ["Mã kho", "Tên kho", "Nhập", "Xuất", "Tồn thực tế", "Tính KD"], d.nxt.map((r: any) => [r.code, r.name, r.inbound, r.outbound, r.onHand, r.countsAsAvailable ? "Có" : "Không"]))}><Download className="h-4 w-4" /> CSV</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Kho</TH><TH className="text-right">Nhập</TH><TH className="text-right">Xuất</TH><TH className="text-right">Tồn thực tế</TH><TH>Tính KD</TH></TR></THead>
              <TBody>
                {d.nxt.map((r: any) => (
                  <TR key={r.code}>
                    <TD><span className="font-mono font-medium">{r.code}</span> <span className="text-muted-foreground">{r.name}</span></TD>
                    <TD className="text-right text-emerald-700">{formatNumber(r.inbound)}</TD>
                    <TD className="text-right text-red-700">{formatNumber(r.outbound)}</TD>
                    <TD className="text-right font-medium">{formatNumber(r.onHand)}</TD>
                    <TD>{r.countsAsAvailable ? <Badge tone="success">Có</Badge> : <Badge tone="danger">Không</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Theo NCC */}
        <Card className="mb-4">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Báo cáo theo NCC (tỷ lệ lỗi)</CardTitle>
            <Button size="sm" variant="ghost" className="no-print" onClick={() => downloadCsv("theo-ncc", ["Mã", "Tên NCC", "Serial cung cấp", "Lỗi", "Tỷ lệ lỗi %", "Số vụ RMA"], d.bySupplier.map((r: any) => [r.code, r.name, r.supplied, r.defects, r.defectRate, r.rmaCount]))}><Download className="h-4 w-4" /> CSV</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>NCC</TH><TH className="text-right">Cung cấp</TH><TH className="text-right">Lỗi</TH><TH className="text-right">Tỷ lệ lỗi</TH><TH className="text-right">RMA</TH></TR></THead>
              <TBody>
                {d.bySupplier.map((r: any) => (
                  <TR key={r.code}>
                    <TD><span className="font-mono">{r.code}</span> {r.name}</TD>
                    <TD className="text-right">{formatNumber(r.supplied)}</TD>
                    <TD className="text-right">{formatNumber(r.defects)}</TD>
                    <TD className="text-right">{r.defectRate > 0 ? <span className="text-red-700">{r.defectRate}%</span> : "0%"}</TD>
                    <TD className="text-right">{r.rmaCount}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tồn đọng quá hạn */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Tồn đọng K-HH quá hạn ({d.overdue.khh.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead><TR><TH>Serial</TH><TH>Hàng</TH><TH className="text-right">Quá hạn</TH></TR></THead>
                <TBody>
                  {d.overdue.khh.length === 0 ? <TR><TD colSpan={3} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                    d.overdue.khh.map((r: any, i: number) => (
                      <TR key={i}><TD className="font-mono">{r.serialNumber}</TD><TD>{r.product}</TD><TD className="text-right text-destructive">{r.days} ngày</TD></TR>
                    ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">K-BH-NCC quá SLA ({d.overdue.kbhncc.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead><TR><TH>Số RMA</TH><TH>Serial</TH><TH className="text-right">Quá hạn</TH></TR></THead>
                <TBody>
                  {d.overdue.kbhncc.length === 0 ? <TR><TD colSpan={3} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                    d.overdue.kbhncc.map((r: any, i: number) => (
                      <TR key={i}><TD className="font-mono">{r.number}</TD><TD className="font-mono">{r.serialNumber}</TD><TD className="text-right text-destructive">{r.days} ngày</TD></TR>
                    ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
