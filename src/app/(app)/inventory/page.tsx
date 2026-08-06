"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ShieldAlert, PackageX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

export default function InventoryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/inventory").then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!data) return <p className="text-destructive">Không tải được dữ liệu tồn kho.</p>;

  const { warehouses, products, alerts } = data;
  const totalAvailable = products.reduce((a: number, p: any) => a + p.available, 0);
  const totalWip = warehouses.reduce((a: number, w: any) => a + w.wip, 0);
  const alertCount = alerts.lowStock.length + alerts.aging.length + alerts.warrantyExpiring.length;

  return (
    <div>
      <PageHeader
        title="Tồn kho realtime"
        description="Tồn thực tế / khả dụng / đang WIP theo từng kho. Tồn khả dụng = IN_STOCK, không nằm trong máy, kho tính tồn."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-2xl font-bold">{formatNumber(totalAvailable)}</div><div className="text-xs text-muted-foreground">Serial khả dụng</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-2xl font-bold">{formatNumber(totalWip)}</div><div className="text-xs text-muted-foreground">Đang WIP (lắp ráp)</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-2xl font-bold">{warehouses.length}</div><div className="text-xs text-muted-foreground">Kho</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className={"text-2xl font-bold " + (alertCount ? "text-destructive" : "")}>{alertCount}</div><div className="text-xs text-muted-foreground">Cảnh báo</div></CardContent></Card>
      </div>

      {/* Tồn theo kho */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tồn theo kho</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Kho</TH><TH>Tính tồn KD</TH><TH className="text-right">Thực tế</TH><TH className="text-right">Khả dụng</TH><TH className="text-right">Giữ</TH><TH className="text-right">WIP</TH><TH className="text-right">SL lô</TH></TR></THead>
            <TBody>
              {warehouses.map((w: any) => (
                <TR key={w.id}>
                  <TD><span className="font-mono font-medium">{w.code}</span> <span className="text-muted-foreground">{w.name}</span></TD>
                  <TD>{w.countsAsAvailable ? <Badge tone="success">Có</Badge> : <Badge tone="danger">Không</Badge>}</TD>
                  <TD className="text-right">{formatNumber(w.onHand)}</TD>
                  <TD className="text-right font-medium">{w.countsAsAvailable ? formatNumber(w.available) : "—"}</TD>
                  <TD className="text-right">{formatNumber(w.reserved)}</TD>
                  <TD className="text-right">{formatNumber(w.wip)}</TD>
                  <TD className="text-right">{formatNumber(w.lotQty)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tồn theo sản phẩm */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tồn theo sản phẩm</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>SKU</TH><TH>Tên</TH><TH className="text-right">Khả dụng</TH><TH className="text-right">Thực tế</TH><TH className="text-right">WIP</TH><TH className="text-right">Tồn tối thiểu</TH></TR></THead>
            <TBody>
              {products.map((p: any) => (
                <TR key={p.id} className={p.belowMin ? "bg-red-50/50" : ""}>
                  <TD className="font-mono font-medium">{p.sku}</TD>
                  <TD>{p.name}</TD>
                  <TD className="text-right font-medium">
                    {formatNumber(p.available)}
                    {p.belowMin && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-destructive" />}
                  </TD>
                  <TD className="text-right">{formatNumber(p.onHand)}</TD>
                  <TD className="text-right">{formatNumber(p.wip)}</TD>
                  <TD className="text-right text-muted-foreground">{p.minStock != null ? formatNumber(p.minStock) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cảnh báo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><PackageX className="h-4 w-4 text-destructive" /> Dưới tồn tối thiểu ({alerts.lowStock.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alerts.lowStock.length === 0 ? <p className="text-muted-foreground">Không có</p> :
              alerts.lowStock.map((p: any) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-destructive">{p.available}/{p.minStock}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-amber-600" /> Hàng tồn lâu ({alerts.aging.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alerts.aging.length === 0 ? <p className="text-muted-foreground">Không có</p> :
              alerts.aging.slice(0, 8).map((a: any) => (
                <div key={a.serialNumber} className="flex justify-between">
                  <span className="font-mono">{a.serialNumber}</span>
                  <span className="text-amber-700">{a.days} ngày</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-amber-600" /> BH NCC sắp hết ({alerts.warrantyExpiring.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alerts.warrantyExpiring.length === 0 ? <p className="text-muted-foreground">Không có</p> :
              alerts.warrantyExpiring.slice(0, 8).map((w: any) => (
                <div key={w.serialNumber} className="flex justify-between">
                  <span className="font-mono">{w.serialNumber}</span>
                  <span className={w.expired ? "text-destructive" : "text-amber-700"}>{formatDate(w.endDate)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
