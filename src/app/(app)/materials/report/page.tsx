"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

function Breakdown({ title, rows, canFinance }: { title: string; rows: any[]; canFinance: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead><TR><TH>Nhóm</TH><TH className="text-right">Số lần</TH><TH className="text-right">Số lượng</TH>{canFinance && <TH className="text-right">Chi phí</TH>}</TR></THead>
          <TBody>
            {(!rows || rows.length === 0) ? <TR><TD colSpan={canFinance ? 4 : 3} className="py-6 text-center text-muted-foreground">Chưa có dữ liệu</TD></TR>
              : rows.map((r, i) => (
                <TR key={i}>
                  <TD className="font-medium">{r.label ?? r.key}</TD>
                  <TD className="text-right tabular-nums">{r.count}</TD>
                  <TD className="text-right tabular-nums">{r.qty}</TD>
                  {canFinance && <TD className="text-right">{formatCurrency(r.cost)}</TD>}
                </TR>
              ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MaterialsReportPage() {
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch("/api/materials/report").then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!d) return <p className="text-muted-foreground">Chưa có dữ liệu báo cáo.</p>;

  return (
    <div>
      <PageHeader title="Báo cáo vật tư" description="Tiêu hao theo nhiều chiều (khách/buổi/dịch vụ/công nghệ/protocol/nhân viên) + định mức vs thực tế + chi phí." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Tiêu hao theo khách hàng" rows={d.byCustomer} canFinance={canFinance} />
        <Breakdown title="Tiêu hao theo buổi" rows={d.bySession} canFinance={canFinance} />
        <Breakdown title="Tiêu hao theo dịch vụ" rows={d.byService} canFinance={canFinance} />
        <Breakdown title="Tiêu hao theo công nghệ" rows={d.byTech} canFinance={canFinance} />
        <Breakdown title="Tiêu hao theo Protocol" rows={d.byProtocol} canFinance={canFinance} />
        <Breakdown title="Tiêu hao theo nhân viên" rows={d.byStaff} canFinance={canFinance} />
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Định mức vs Thực tế (theo buổi)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Buổi</TH><TH className="text-right">Định mức</TH><TH className="text-right">Thực tế</TH><TH className="text-right">Chênh lệch</TH>{canFinance && <TH className="text-right">Chi phí</TH>}</TR></THead>
            <TBody>
              {(!d.expectedVsActual || d.expectedVsActual.length === 0) ? <TR><TD colSpan={canFinance ? 5 : 4} className="py-6 text-center text-muted-foreground">Chưa có dữ liệu</TD></TR>
                : d.expectedVsActual.map((r: any, i: number) => (
                  <TR key={i}>
                    <TD className="font-medium">{r.session}</TD>
                    <TD className="text-right tabular-nums">{r.expected}</TD>
                    <TD className="text-right tabular-nums">{r.actual}</TD>
                    <TD className="text-right tabular-nums">{(r.actual - r.expected).toFixed(2)}</TD>
                    {canFinance && <TD className="text-right">{formatCurrency(r.cost)}</TD>}
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
