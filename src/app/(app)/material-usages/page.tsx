"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { MATERIAL_SOURCE_LABEL } from "@/lib/clinic-labels";

export default function MaterialUsagesPage() {
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any[]>("/api/material-usages").then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Lịch sử sử dụng vật tư" description="Toàn bộ lần tiêu hao vật tư theo buổi/khách/nhân viên, từ cả 2 nguồn (Kho vật tư sử dụng và Vật tư khách hàng)." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Thời điểm</TH><TH>Nguồn</TH><TH>Vật tư</TH><TH className="text-right">Số lượng</TH>{canFinance && <TH className="text-right">Chi phí</TH>}<TH>Buổi</TH><TH>Nhân viên</TH></TR></THead>
            <TBody>
              {loading ? <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                : rows.length === 0 ? <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có lần sử dụng nào.</TD></TR>
                : rows.map((u) => {
                  const name = u.container?.material?.name ?? u.customerMaterial?.name ?? "—";
                  const unit = u.container?.material?.unit ?? u.customerMaterial?.unit ?? "";
                  return (
                    <TR key={u.id}>
                      <TD className="text-muted-foreground">{formatDateTime(u.occurredAt)}</TD>
                      <TD><Badge tone={u.source === "SHARED_STOCK" ? "default" : "warning"}>{MATERIAL_SOURCE_LABEL[u.source]}</Badge></TD>
                      <TD className="font-medium">{name}</TD>
                      <TD className="text-right tabular-nums">{Number(u.quantity)} {unit}</TD>
                      {canFinance && <TD className="text-right text-muted-foreground">{u.costAllocated != null ? formatCurrency(u.costAllocated) : "—"}</TD>}
                      <TD className="text-muted-foreground">{u.session ? `Buổi ${u.session.sessionNumber ?? ""}` : "—"}</TD>
                      <TD className="text-muted-foreground">{u.performedBy ?? "—"}</TD>
                    </TR>
                  );
                })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
