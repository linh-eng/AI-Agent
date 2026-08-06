"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

interface Row {
  id: string;
  lotNumber: string;
  quantity: number;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  product: { sku: string; name: string };
  warehouse: { code: string; name: string };
  supplier?: { code: string; name: string } | null;
}

export default function LotsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Row[]>("/api/lots")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Lô hàng" description="Danh sách lô (LOT) theo kho — số lượng, ngày sản xuất, hạn dùng." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Số lô</TH>
                <TH>Sản phẩm</TH>
                <TH>Kho</TH>
                <TH>NCC</TH>
                <TH className="text-right">Số lượng</TH>
                <TH>Ngày SX</TH>
                <TH>Hạn dùng</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có lô hàng</TD></TR>
              ) : (
                rows.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-mono font-medium">{l.lotNumber}</TD>
                    <TD>
                      <div>{l.product.name}</div>
                      <div className="text-xs text-muted-foreground">{l.product.sku}</div>
                    </TD>
                    <TD><span className="font-mono">{l.warehouse.code}</span></TD>
                    <TD>{l.supplier?.name ?? "—"}</TD>
                    <TD className="text-right font-medium">{formatNumber(l.quantity)}</TD>
                    <TD className="text-muted-foreground">{formatDate(l.manufactureDate)}</TD>
                    <TD className="text-muted-foreground">{formatDate(l.expiryDate)}</TD>
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
