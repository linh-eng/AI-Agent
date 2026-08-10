"use client";
import { useEffect, useState } from "react";
import { CalendarClock, TrendingDown, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";

interface ExpiryAlert {
  batchId: string;
  sku: string;
  productName: string;
  warehouse: string;
  batchCode: string | null;
  expiryDate: string;
  daysLeft: number;
  quantity: number;
  uom: string;
  status: "EXPIRED" | "NEAR";
}
interface LowStock {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  onHand: number;
  minStock: number;
}
interface WarrantyAlert {
  assetId: string;
  code: string;
  productName: string;
  serialNumber: string | null;
  warrantyUntil: string;
  daysLeft: number;
  status: string;
  isExpired: boolean;
}

export default function AlertsPage() {
  const [expiry, setExpiry] = useState<ExpiryAlert[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [warranty, setWarranty] = useState<WarrantyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ expiry: ExpiryAlert[]; lowStock: LowStock[]; warranty: WarrantyAlert[] }>("/api/alerts")
      .then((d) => {
        setExpiry(d.expiry);
        setLowStock(d.lowStock);
        setWarranty(d.warranty ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Cảnh báo"
        description="Lô sắp/đã hết hạn sử dụng và sản phẩm dưới định mức tồn tối thiểu."
      />

      {/* HSD */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Hạn sử dụng</h3>
            <Badge tone={expiry.length ? "warning" : "success"}>{expiry.length} lô</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Kho</TH>
                <TH>Lô</TH>
                <TH>HSD</TH>
                <TH className="text-right">Còn lại</TH>
                <TH className="text-right">SL tồn</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : expiry.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                    Không có lô nào cần chú ý 🎉
                  </TD>
                </TR>
              ) : (
                expiry.map((a) => (
                  <TR key={a.batchId}>
                    <TD className="font-mono text-xs">{a.sku}</TD>
                    <TD className="font-medium">{a.productName}</TD>
                    <TD className="text-muted-foreground">{a.warehouse}</TD>
                    <TD className="font-mono text-xs">{a.batchCode ?? "—"}</TD>
                    <TD>{formatDate(a.expiryDate)}</TD>
                    <TD className="text-right">
                      {a.status === "EXPIRED" ? (
                        <Badge tone="danger">Hết hạn {Math.abs(a.daysLeft)} ngày</Badge>
                      ) : (
                        <Badge tone="warning">Còn {a.daysLeft} ngày</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      {formatNumber(a.quantity)} {a.uom}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Định mức */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Dưới định mức tồn</h3>
            <Badge tone={lowStock.length ? "warning" : "success"}>{lowStock.length} sản phẩm</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH className="text-right">Tồn</TH>
                <TH className="text-right">Định mức</TH>
                <TH className="text-right">Cần bổ sung</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : lowStock.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Tất cả sản phẩm đều trên định mức 🎉
                  </TD>
                </TR>
              ) : (
                lowStock.map((a) => (
                  <TR key={a.productId}>
                    <TD className="font-mono text-xs">{a.sku}</TD>
                    <TD className="font-medium">{a.name}</TD>
                    <TD className="text-right font-semibold">
                      {formatNumber(a.onHand)} {a.uom}
                    </TD>
                    <TD className="text-right text-muted-foreground">{formatNumber(a.minStock)}</TD>
                    <TD className="text-right">
                      <Badge tone="warning">
                        +{formatNumber(Math.max(0, a.minStock - a.onHand))} {a.uom}
                      </Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bảo hành thiết bị */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Bảo hành thiết bị</h3>
            <Badge tone={warranty.length ? "warning" : "success"}>{warranty.length} thiết bị</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Mã TS</TH>
                <TH>Thiết bị</TH>
                <TH>Serial</TH>
                <TH>Bảo hành đến</TH>
                <TH className="text-right">Còn lại</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : warranty.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Không có thiết bị sắp hết bảo hành 🎉
                  </TD>
                </TR>
              ) : (
                warranty.map((w) => (
                  <TR key={w.assetId}>
                    <TD className="font-mono text-xs">{w.code}</TD>
                    <TD className="font-medium">{w.productName}</TD>
                    <TD className="font-mono text-xs">{w.serialNumber ?? "—"}</TD>
                    <TD>{formatDate(w.warrantyUntil)}</TD>
                    <TD className="text-right">
                      {w.isExpired ? (
                        <Badge tone="danger">Hết BH {Math.abs(w.daysLeft)} ngày</Badge>
                      ) : (
                        <Badge tone="warning">Còn {w.daysLeft} ngày</Badge>
                      )}
                    </TD>
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
