"use client";
import { useEffect, useState } from "react";
import { CalendarClock, TrendingDown, ShieldCheck, Zap, Archive } from "lucide-react";
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
interface ShotAlert {
  handpieceId: string;
  code: string;
  name: string;
  machine: string | null;
  maxShots: number;
  usedShots: number;
  remaining: number;
  isDepleted: boolean;
}
interface UnopenedAlert {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  purchaseDate: string;
  monthsStored: number;
  warnMonths: number;
}

export default function AlertsPage() {
  const [expiry, setExpiry] = useState<ExpiryAlert[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [warranty, setWarranty] = useState<WarrantyAlert[]>([]);
  const [shots, setShots] = useState<ShotAlert[]>([]);
  const [unopened, setUnopened] = useState<UnopenedAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{
      expiry: ExpiryAlert[];
      lowStock: LowStock[];
      warranty: WarrantyAlert[];
      shots: ShotAlert[];
      unopened: UnopenedAlert[];
    }>("/api/alerts")
      .then((d) => {
        setExpiry(d.expiry);
        setLowStock(d.lowStock);
        setWarranty(d.warranty ?? []);
        setShots(d.shots ?? []);
        setUnopened(d.unopened ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Cảnh báo"
        description="Lô sắp/đã hết hạn, sản phẩm dưới định mức tồn, hàng tồn lâu chưa mở nắp, thiết bị sắp hết bảo hành và tay cầm sắp hết shot."
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

      {/* Tồn lâu chưa mở nắp */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Tồn lâu chưa mở nắp</h3>
            <Badge tone={unopened.length ? "warning" : "success"}>{unopened.length} sản phẩm</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Nhóm</TH>
                <TH>Ngày mua</TH>
                <TH className="text-right">Đã tồn</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : unopened.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Không có hàng tồn lâu chưa mở 🎉
                  </TD>
                </TR>
              ) : (
                unopened.map((u) => (
                  <TR key={u.productId}>
                    <TD className="font-mono text-xs">{u.sku}</TD>
                    <TD className="font-medium">{u.name}</TD>
                    <TD className="text-muted-foreground">{u.category ?? "—"}</TD>
                    <TD>{formatDate(u.purchaseDate)}</TD>
                    <TD className="text-right">
                      <Badge tone="warning">
                        ~{u.monthsStored} tháng (ngưỡng {u.warnMonths})
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

      {/* Tay cầm / shot */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Tay cầm sắp hết shot</h3>
            <Badge tone={shots.length ? "warning" : "success"}>{shots.length} tay cầm</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Tay cầm</TH>
                <TH>Máy</TH>
                <TH className="text-right">Đã dùng</TH>
                <TH className="text-right">Định mức</TH>
                <TH className="text-right">Còn lại</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : shots.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                    Tất cả tay cầm đều còn đủ shot 🎉
                  </TD>
                </TR>
              ) : (
                shots.map((s) => (
                  <TR key={s.handpieceId}>
                    <TD className="font-mono text-xs">{s.code}</TD>
                    <TD className="font-medium">{s.name}</TD>
                    <TD className="text-muted-foreground">{s.machine ?? "—"}</TD>
                    <TD className="text-right">{formatNumber(s.usedShots)}</TD>
                    <TD className="text-right text-muted-foreground">{formatNumber(s.maxShots)}</TD>
                    <TD className="text-right">
                      {s.isDepleted ? (
                        <Badge tone="danger">Hết shot — cần thay</Badge>
                      ) : (
                        <Badge tone="warning">Còn {formatNumber(s.remaining)} shot</Badge>
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
