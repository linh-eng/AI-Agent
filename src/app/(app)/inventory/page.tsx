"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";

interface Row {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  uom: string;
  category: string | null;
  trackingMode: "LOT" | "QUANTITY";
  onHand: number;
  minStock: number | null;
  batchCount: number;
  nearestExpiry: string | null;
  value: number;
  belowMin: boolean;
}
interface Wh {
  id: string;
  code: string;
  name: string;
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  const b = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((a - b) / 86400000);
}

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Wh[]>("/api/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = warehouseId ? `/api/inventory?warehouseId=${warehouseId}` : "/api/inventory";
    apiFetch<Row[]>(url)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [warehouseId]);

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.sku.toLowerCase().includes(q.toLowerCase())
  );

  const totalValue = filtered.reduce((s, r) => s + r.value, 0);

  return (
    <div>
      <PageHeader
        title="Tồn kho"
        description="Tồn realtime theo sản phẩm — gộp mọi lô. Xuất kho theo FEFO (hết hạn trước xuất trước)."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Tìm theo tên / SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:max-w-xs">
          <option value="">Tất cả kho</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          Giá trị tồn: <span className="font-semibold text-foreground">{formatNumber(Math.round(totalValue))} đ</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Nhóm</TH>
                <TH className="text-right">Tồn</TH>
                <TH className="text-right">Định mức</TH>
                <TH className="text-center">Số lô</TH>
                <TH>HSD gần nhất</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Không có dữ liệu
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => {
                  const days = r.nearestExpiry != null ? daysUntil(r.nearestExpiry) : null;
                  return (
                    <TR key={r.productId}>
                      <TD className="font-mono text-xs font-medium">{r.sku}</TD>
                      <TD>
                        <div className="font-medium">{r.name}</div>
                        {r.brand && <div className="text-xs text-muted-foreground">{r.brand}</div>}
                      </TD>
                      <TD className="text-muted-foreground">{r.category ?? "—"}</TD>
                      <TD className="text-right">
                        <span className="font-semibold">{formatNumber(r.onHand)}</span>{" "}
                        <span className="text-xs text-muted-foreground">{r.uom}</span>
                        {r.belowMin && (
                          <div>
                            <Badge tone="warning">Dưới định mức</Badge>
                          </div>
                        )}
                        {r.onHand === 0 && (
                          <div>
                            <Badge tone="danger">Hết hàng</Badge>
                          </div>
                        )}
                      </TD>
                      <TD className="text-right text-muted-foreground">
                        {r.minStock != null ? formatNumber(r.minStock) : "—"}
                      </TD>
                      <TD className="text-center text-muted-foreground">{r.batchCount || "—"}</TD>
                      <TD>
                        {r.nearestExpiry ? (
                          <span
                            className={
                              days! < 0
                                ? "font-medium text-red-600"
                                : days! <= 60
                                ? "font-medium text-amber-600"
                                : ""
                            }
                          >
                            {formatDate(r.nearestExpiry)}
                            {days! < 0 && " (hết hạn)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
