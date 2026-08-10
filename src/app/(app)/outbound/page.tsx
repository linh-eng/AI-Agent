"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  id: string;
  code: string;
  issueType: string;
  customerName?: string | null;
  warehouse: { name: string };
  createdBy: { name: string };
  issuedAt?: string | null;
  _count: { items: number };
}

const ISSUE_LABEL: Record<string, string> = {
  SALE: "Bán hàng",
  INTERNAL_USE: "Dùng nội bộ",
  DISPOSAL: "Hủy",
  ADJUSTMENT: "Điều chỉnh",
};
const ISSUE_TONE: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  SALE: "success",
  INTERNAL_USE: "default",
  DISPOSAL: "danger",
  ADJUSTMENT: "muted",
};

export default function OutboundPage() {
  const canWrite = useCan(PERMISSIONS.OUTBOUND_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Row[]>("/api/issues")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Xuất kho"
        description="Phiếu xuất (bán / dùng nội bộ / hủy) — tự phân bổ lô theo FEFO, trừ tồn ngay khi lưu."
        action={
          canWrite && (
            <Link href="/outbound/new">
              <Button>
                <Plus className="h-4 w-4" /> Tạo phiếu xuất
              </Button>
            </Link>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã phiếu</TH>
                <TH>Loại</TH>
                <TH>Khách / Bộ phận</TH>
                <TH>Kho</TH>
                <TH>Người xuất</TH>
                <TH>Ngày xuất</TH>
                <TH className="text-center">Số dòng</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chưa có phiếu xuất
                  </TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/outbound/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>
                      <Badge tone={ISSUE_TONE[r.issueType]}>{ISSUE_LABEL[r.issueType] ?? r.issueType}</Badge>
                    </TD>
                    <TD>{r.customerName ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.warehouse.name}</TD>
                    <TD className="text-muted-foreground">{r.createdBy.name}</TD>
                    <TD>{formatDate(r.issuedAt)}</TD>
                    <TD className="text-center">{r._count.items}</TD>
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
