"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Tag } from "lucide-react";
import { printReceipt, printBatchLabels } from "@/lib/print";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batchCode?: string | null;
  expiryDate?: string | null;
  mfgDate?: string | null;
  quantity: number;
  unitCost?: number | null;
}
interface Receipt {
  id: string;
  code: string;
  supplier: { name: string; code: string };
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  receivedAt?: string | null;
  items: Item[];
}

export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Receipt>(`/api/receipts/${params.id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu nhập.</p>;

  const total = data.items.reduce((s, it) => s + it.quantity * (it.unitCost ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`Phiếu nhập ${data.code}`}
        description={`NCC: ${data.supplier.name} · Kho: ${data.warehouse.name}`}
        action={
          <>
            <Button variant="outline" onClick={() => printBatchLabels(data)}>
              <Tag className="h-4 w-4" /> In tem lô
            </Button>
            <Button variant="outline" onClick={() => printReceipt(data)}>
              <Printer className="h-4 w-4" /> In phiếu
            </Button>
            <Link href="/inbound">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <Info label="Nhà cung cấp" value={data.supplier.name} />
          <Info label="Kho nhập" value={data.warehouse.name} />
          <Info label="Người nhập" value={data.createdBy.name} />
          <Info label="Ngày nhập" value={formatDate(data.receivedAt)} />
          {data.note && <Info label="Ghi chú" value={data.note} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Mã lô</TH>
                <TH>HSD</TH>
                <TH className="text-right">SL</TH>
                <TH className="text-right">Giá vốn</TH>
                <TH className="text-right">Thành tiền</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((it) => (
                <TR key={it.id}>
                  <TD className="font-mono text-xs">{it.product.sku}</TD>
                  <TD className="font-medium">{it.product.name}</TD>
                  <TD className="font-mono text-xs">{it.batchCode ?? "—"}</TD>
                  <TD>{it.expiryDate ? formatDate(it.expiryDate) : "—"}</TD>
                  <TD className="text-right">
                    {formatNumber(it.quantity)} {it.product.uom}
                  </TD>
                  <TD className="text-right">{it.unitCost != null ? formatNumber(it.unitCost) : "—"}</TD>
                  <TD className="text-right">{formatNumber(it.quantity * (it.unitCost ?? 0))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex justify-end border-t p-4 text-sm">
            Tổng giá trị:{" "}
            <span className="ml-2 font-semibold">{formatNumber(total)} đ</span>
          </div>
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
