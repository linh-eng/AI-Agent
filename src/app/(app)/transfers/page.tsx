"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  id: string;
  code: string;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  createdBy: { name: string };
  transferredAt?: string | null;
  _count: { items: number };
}

export default function TransfersPage() {
  const canWrite = useCan(PERMISSIONS.TRANSFER_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<Row[]>("/api/transfers")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return (
      r.code.toLowerCase().includes(s) ||
      r.fromWarehouse.name.toLowerCase().includes(s) ||
      r.toWarehouse.name.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader
        title="Chuyển kho"
        description="Chuyển hàng giữa các kho/chi nhánh — tự rút lô theo FEFO ở kho nguồn, giữ nguyên lô & HSD sang kho đích."
        action={
          canWrite && (
            <Link href="/transfers/new">
              <Button>
                <Plus className="h-4 w-4" /> Tạo phiếu chuyển
              </Button>
            </Link>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo mã phiếu / tên kho…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã phiếu</TH>
                <TH>Tuyến chuyển</TH>
                <TH>Người tạo</TH>
                <TH>Ngày chuyển</TH>
                <TH className="text-center">Số dòng</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                    {rows.length === 0 ? "Chưa có phiếu chuyển" : "Không tìm thấy phiếu phù hợp"}
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/transfers/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5">
                        {r.fromWarehouse.name}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.toWarehouse.name}
                      </span>
                    </TD>
                    <TD className="text-muted-foreground">{r.createdBy.name}</TD>
                    <TD>{formatDate(r.transferredAt)}</TD>
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
