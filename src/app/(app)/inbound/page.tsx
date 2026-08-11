"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
  status: string;
  supplier: { name: string };
  warehouse: { name: string };
  createdBy: { name: string };
  receivedAt?: string | null;
  _count: { items: number };
}

export default function InboundPage() {
  const canWrite = useCan(PERMISSIONS.INBOUND_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<Row[]>("/api/receipts")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return (
      r.code.toLowerCase().includes(s) ||
      r.supplier.name.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader
        title="Nhập kho"
        description="Phiếu nhập từ nhà cung cấp — ghi nhận lô & HSD, cộng tồn ngay khi lưu."
        action={
          canWrite && (
            <Link href="/inbound/new">
              <Button>
                <Plus className="h-4 w-4" /> Tạo phiếu nhập
              </Button>
            </Link>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo mã phiếu / nhà cung cấp…"
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
                <TH>Nhà cung cấp</TH>
                <TH>Kho</TH>
                <TH>Người nhập</TH>
                <TH>Ngày nhập</TH>
                <TH className="text-center">Số dòng</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    {rows.length === 0 ? "Chưa có phiếu nhập" : "Không tìm thấy phiếu phù hợp"}
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/inbound/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>{r.supplier.name}</TD>
                    <TD className="text-muted-foreground">{r.warehouse.name}</TD>
                    <TD className="text-muted-foreground">{r.createdBy.name}</TD>
                    <TD>{formatDate(r.receivedAt)}</TD>
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
