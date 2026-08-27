"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { printTransfer } from "@/lib/print";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

interface Movement {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
  quantity: number;
}
interface Transfer {
  id: string;
  code: string;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  transferredAt?: string | null;
  items: { id: string; product: { sku: string; name: string; uom: string }; quantity: number }[];
  movements: Movement[];
}

export default function TransferDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Transfer>(`/api/transfers/${params.id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu chuyển.</p>;

  return (
    <div>
      <PageHeader
        title={`Phiếu chuyển ${data.code}`}
        description={`${data.fromWarehouse.name} → ${data.toWarehouse.name}`}
        action={
          <>
            <Button variant="outline" onClick={() => printTransfer(data)}>
              <Printer className="h-4 w-4" /> In phiếu
            </Button>
            <Link href="/transfers">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Tuyến chuyển</div>
            <div className="flex items-center gap-2 font-medium">
              {data.fromWarehouse.name}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {data.toWarehouse.name}
            </div>
          </div>
          <Info label="Người tạo" value={data.createdBy.name} />
          <Info label="Ngày chuyển" value={formatDate(data.transferredAt)} />
          {data.note && <Info label="Ghi chú" value={data.note} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-5 pt-4 text-sm font-semibold">Chi tiết lô đã chuyển (FEFO)</div>
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Mã lô</TH>
                <TH>HSD</TH>
                <TH className="text-right">SL chuyển</TH>
              </TR>
            </THead>
            <TBody>
              {data.movements.map((m) => (
                <TR key={m.id}>
                  <TD className="font-mono text-xs">{m.product.sku}</TD>
                  <TD className="font-medium">{m.product.name}</TD>
                  <TD className="font-mono text-xs">{m.batch?.batchCode ?? "—"}</TD>
                  <TD>{m.batch?.expiryDate ? formatDate(m.batch.expiryDate) : "—"}</TD>
                  <TD className="text-right">
                    {formatNumber(Math.abs(m.quantity))} {m.product.uom}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
