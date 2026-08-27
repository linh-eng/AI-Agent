"use client";
import { useEffect, useState } from "react";
import { CalendarClock, TrendingDown, ShieldCheck, Zap, Archive, Wrench, CreditCard } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { normalizeSearch } from "@/lib/utils";

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
interface MaintenanceDue {
  assetId: string;
  code: string;
  productName: string;
  cycleMonths: number;
  lastMaintenance: string | null;
  nextDue: string;
  daysLeft: number;
  isOverdue: boolean;
}
interface DebtDue {
  assetId: string;
  code: string;
  productName: string;
  dueDate: string;
  remaining: number;
  daysLeft: number;
  isOverdue: boolean;
}

export default function AlertsPage() {
  const [expiry, setExpiry] = useState<ExpiryAlert[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [warranty, setWarranty] = useState<WarrantyAlert[]>([]);
  const [shots, setShots] = useState<ShotAlert[]>([]);
  const [unopened, setUnopened] = useState<UnopenedAlert[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceDue[]>([]);
  const [debts, setDebts] = useState<DebtDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<{
      expiry: ExpiryAlert[];
      lowStock: LowStock[];
      warranty: WarrantyAlert[];
      shots: ShotAlert[];
      unopened: UnopenedAlert[];
      maintenance: MaintenanceDue[];
      debts: DebtDue[];
    }>("/api/alerts")
      .then((d) => {
        setExpiry(d.expiry);
        setLowStock(d.lowStock);
        setWarranty(d.warranty ?? []);
        setShots(d.shots ?? []);
        setUnopened(d.unopened ?? []);
        setMaintenance(d.maintenance ?? []);
        setDebts(d.debts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const nq = normalizeSearch(q);
  const ff = <T,>(arr: T[]) => arr.filter((a) => normalizeSearch(Object.values(a as any).filter((v) => typeof v === "string").join(" ")).includes(nq));
  const fExpiry = ff(expiry), fLowStock = ff(lowStock), fUnopened = ff(unopened), fWarranty = ff(warranty), fMaintenance = ff(maintenance), fDebts = ff(debts), fShots = ff(shots);

  return (
    <div>
      <PageHeader
        title="Cảnh báo"
        description="Lô sắp/đã hết hạn, sản phẩm dưới định mức tồn, hàng tồn lâu chưa mở nắp, thiết bị sắp hết bảo hành / đến hạn bảo trì và tay cầm sắp hết shot."
      />
      <div className="mb-4">
        <Input placeholder="Lọc theo tên / mã / SKU… (áp dụng cho tất cả mục)" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-md" />
      </div>

      {/* HSD */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Hạn sử dụng</h3>
            <Badge tone={fExpiry.length ? "warning" : "success"}>{fExpiry.length} lô</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Kho</TH>
                <TH>Lô / cơ sở HSD</TH>
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
              ) : fExpiry.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                    Không có lô nào cần chú ý 🎉
                  </TD>
                </TR>
              ) : (
                fExpiry.map((a) => (
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
            <Badge tone={fLowStock.length ? "warning" : "success"}>{fLowStock.length} sản phẩm</Badge>
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
              ) : fLowStock.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Tất cả sản phẩm đều trên định mức 🎉
                  </TD>
                </TR>
              ) : (
                fLowStock.map((a) => (
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
            <Badge tone={fUnopened.length ? "warning" : "success"}>{fUnopened.length} sản phẩm</Badge>
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
              ) : fUnopened.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Không có hàng tồn lâu chưa mở 🎉
                  </TD>
                </TR>
              ) : (
                fUnopened.map((u) => (
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
            <Badge tone={fWarranty.length ? "warning" : "success"}>{fWarranty.length} thiết bị</Badge>
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
              ) : fWarranty.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Không có thiết bị sắp hết bảo hành 🎉
                  </TD>
                </TR>
              ) : (
                fWarranty.map((w) => (
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

      {/* Bảo trì định kỳ đến hạn */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Bảo trì định kỳ đến hạn</h3>
            <Badge tone={fMaintenance.length ? "warning" : "success"}>{fMaintenance.length} thiết bị</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Mã TS</TH>
                <TH>Thiết bị</TH>
                <TH>Chu kỳ</TH>
                <TH>Bảo trì gần nhất</TH>
                <TH>Kế tiếp</TH>
                <TH className="text-right">Còn lại</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : fMaintenance.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">Không có thiết bị đến hạn bảo trì 🎉</TD>
                </TR>
              ) : (
                fMaintenance.map((m) => (
                  <TR key={m.assetId}>
                    <TD className="font-mono text-xs">
                      <Link href={`/assets/${m.assetId}`} className="text-primary hover:underline">{m.code}</Link>
                    </TD>
                    <TD className="font-medium">{m.productName}</TD>
                    <TD className="text-muted-foreground">{m.cycleMonths} tháng</TD>
                    <TD>{m.lastMaintenance ? formatDate(m.lastMaintenance) : "—"}</TD>
                    <TD>{formatDate(m.nextDue)}</TD>
                    <TD className="text-right">
                      {m.isOverdue ? (
                        <Badge tone="danger">Quá hạn {Math.abs(m.daysLeft)} ngày</Badge>
                      ) : (
                        <Badge tone="warning">Còn {m.daysLeft} ngày</Badge>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Công nợ tài sản đến hạn */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Công nợ tài sản sắp/đến hạn</h3>
            <Badge tone={fDebts.length ? "warning" : "success"}>{fDebts.length} tài sản</Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Mã TS</TH>
                <TH>Tài sản</TH>
                <TH>Đến hạn</TH>
                <TH className="text-right">Còn công nợ</TH>
                <TH className="text-right">Tình trạng</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : fDebts.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">Không có công nợ đến hạn 🎉</TD>
                </TR>
              ) : (
                fDebts.map((d) => (
                  <TR key={d.assetId}>
                    <TD className="font-mono text-xs">
                      <Link href={`/assets/${d.assetId}`} className="text-primary hover:underline">{d.code}</Link>
                    </TD>
                    <TD className="font-medium">{d.productName}</TD>
                    <TD>{formatDate(d.dueDate)}</TD>
                    <TD className="text-right font-medium text-red-600">{formatNumber(d.remaining)} đ</TD>
                    <TD className="text-right">
                      {d.isOverdue ? (
                        <Badge tone="danger">Quá hạn {Math.abs(d.daysLeft)} ngày</Badge>
                      ) : (
                        <Badge tone="warning">Còn {d.daysLeft} ngày</Badge>
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
            <Badge tone={fShots.length ? "warning" : "success"}>{fShots.length} tay cầm</Badge>
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
              ) : fShots.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                    Tất cả tay cầm đều còn đủ shot 🎉
                  </TD>
                </TR>
              ) : (
                fShots.map((s) => (
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
