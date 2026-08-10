"use client";
import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";

interface Warehouse { id: string; name: string }
interface NxtRow {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  category: string | null;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<NxtRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Warehouse[]>("/api/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (warehouseId) params.set("warehouseId", warehouseId);
      setRows(await apiFetch<NxtRow[]>(`/api/reports/nxt?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    const whName = warehouses.find((w) => w.id === warehouseId)?.name ?? "Tất cả kho";
    const headers = ["SKU", "Sản phẩm", "Nhóm", "ĐVT", "Tồn đầu", "Nhập", "Xuất", "Tồn cuối"];
    const data = rows.map((r) => [r.sku, r.name, r.category ?? "", r.uom, r.opening, r.inQty, r.outQty, r.closing]);
    const csv =
      `Báo cáo Nhập - Xuất - Tồn\nKho:,${whName}\nTừ:,${from},Đến:,${to}\n\n` +
      toCsv(headers, data);
    downloadCsv(`NXT_${from}_${to}.csv`, csv);
  }

  return (
    <div>
      <PageHeader
        title="Báo cáo Nhập – Xuất – Tồn"
        description="Tổng hợp tồn đầu kỳ, nhập, xuất và tồn cuối kỳ theo sản phẩm."
        action={
          rows.length > 0 && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Xuất CSV
            </Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Từ ngày</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Đến ngày</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kho</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:w-52">
              <option value="">Tất cả kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <Button onClick={run} disabled={loading}>
            <Search className="h-4 w-4" /> {loading ? "Đang tính…" : "Xem báo cáo"}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Nhóm</TH>
                <TH className="text-right">Tồn đầu</TH>
                <TH className="text-right">Nhập</TH>
                <TH className="text-right">Xuất</TH>
                <TH className="text-right">Tồn cuối</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    Không có biến động trong kỳ
                  </TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.productId}>
                    <TD className="font-mono text-xs">{r.sku}</TD>
                    <TD className="font-medium">{r.name}</TD>
                    <TD className="text-muted-foreground">{r.category ?? "—"}</TD>
                    <TD className="text-right">{formatNumber(r.opening)}</TD>
                    <TD className="text-right text-emerald-600">+{formatNumber(r.inQty)}</TD>
                    <TD className="text-right text-red-600">−{formatNumber(r.outQty)}</TD>
                    <TD className="text-right font-semibold">
                      {formatNumber(r.closing)} <span className="text-xs font-normal text-muted-foreground">{r.uom}</span>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Kỳ báo cáo: {formatDate(from)} – {formatDate(to)}
      </p>
    </div>
  );
}
