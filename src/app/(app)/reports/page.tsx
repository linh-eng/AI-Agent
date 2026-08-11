"use client";
import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { BarList } from "@/components/charts";

interface Warehouse { id: string; name: string }
interface NxtRow {
  productId: string; sku: string; name: string; uom: string; category: string | null;
  opening: number; inQty: number; outQty: number; closing: number;
}
interface SvcRow {
  serviceId: string; code: string; name: string;
  usageCount: number; sessions: number; revenue: number; cost: number; profit: number;
}
interface SvcTotal { usageCount: number; sessions: number; revenue: number; cost: number; profit: number }

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"nxt" | "service">("nxt");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [nxt, setNxt] = useState<NxtRow[]>([]);
  const [svc, setSvc] = useState<{ rows: SvcRow[]; total: SvcTotal } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Warehouse[]>("/api/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      if (tab === "nxt") {
        const params = new URLSearchParams({ from, to });
        if (warehouseId) params.set("warehouseId", warehouseId);
        setNxt(await apiFetch<NxtRow[]>(`/api/reports/nxt?${params.toString()}`));
      } else {
        const params = new URLSearchParams({ from, to });
        setSvc(await apiFetch<{ rows: SvcRow[]; total: SvcTotal }>(`/api/reports/service-revenue?${params.toString()}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function exportNxt() {
    const whName = warehouses.find((w) => w.id === warehouseId)?.name ?? "Tất cả kho";
    const headers = ["SKU", "Sản phẩm", "Nhóm", "ĐVT", "Tồn đầu", "Nhập", "Xuất", "Tồn cuối"];
    const data = nxt.map((r) => [r.sku, r.name, r.category ?? "", r.uom, r.opening, r.inQty, r.outQty, r.closing]);
    const csv = `Báo cáo Nhập - Xuất - Tồn\nKho:,${whName}\nTừ:,${from},Đến:,${to}\n\n` + toCsv(headers, data);
    downloadCsv(`NXT_${from}_${to}.csv`, csv);
  }
  function exportSvc() {
    if (!svc) return;
    const headers = ["Mã DV", "Dịch vụ", "Số lần", "Số lượt", "Doanh thu", "Giá vốn VT", "Lợi nhuận"];
    const data = svc.rows.map((r) => [r.code, r.name, r.usageCount, r.sessions, r.revenue, r.cost, r.profit]);
    const csv = `Báo cáo doanh thu dịch vụ\nTừ:,${from},Đến:,${to}\n\n` + toCsv(headers, data);
    downloadCsv(`DoanhThuDV_${from}_${to}.csv`, csv);
  }

  return (
    <div>
      <PageHeader
        title="Báo cáo"
        description="Nhập–Xuất–Tồn theo kỳ và doanh thu dịch vụ."
        action={
          <Button variant="outline" onClick={tab === "nxt" ? exportNxt : exportSvc} disabled={tab === "nxt" ? nxt.length === 0 : !svc?.rows.length}>
            <Download className="h-4 w-4" /> Xuất CSV
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 border-b">
        {[
          { k: "nxt", label: "Nhập – Xuất – Tồn" },
          { k: "service", label: "Doanh thu dịch vụ" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={cn(
              "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
              tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

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
          {tab === "nxt" && (
            <div className="space-y-1.5">
              <Label>Kho</Label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:w-52">
                <option value="">Tất cả kho</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          )}
          <Button onClick={run} disabled={loading}>
            <Search className="h-4 w-4" /> {loading ? "Đang tính…" : "Xem báo cáo"}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {tab === "nxt" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH><TH>Sản phẩm</TH><TH>Nhóm</TH>
                  <TH className="text-right">Tồn đầu</TH><TH className="text-right">Nhập</TH>
                  <TH className="text-right">Xuất</TH><TH className="text-right">Tồn cuối</TH>
                </TR>
              </THead>
              <TBody>
                {loading ? (
                  <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải…</TD></TR>
                ) : nxt.length === 0 ? (
                  <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Không có biến động trong kỳ</TD></TR>
                ) : (
                  nxt.map((r) => (
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
      ) : (
        <>
          {svc?.rows.length ? (
            <Card className="mb-4">
              <CardContent className="p-5">
                <h3 className="mb-4 font-semibold">Doanh thu theo dịch vụ</h3>
                <BarList
                  items={svc.rows.map((r) => ({
                    label: r.name,
                    value: r.revenue,
                    hint: `Lợi nhuận ${formatNumber(r.profit)} đ · ${r.sessions} lượt`,
                  }))}
                  unit="đ"
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Mã</TH><TH>Dịch vụ</TH>
                  <TH className="text-center">Số lần</TH><TH className="text-center">Số lượt</TH>
                  <TH className="text-right">Doanh thu</TH><TH className="text-right">Giá vốn VT</TH>
                  <TH className="text-right">Lợi nhuận</TH>
                </TR>
              </THead>
              <TBody>
                {loading ? (
                  <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải…</TD></TR>
                ) : !svc?.rows.length ? (
                  <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có ghi nhận dịch vụ trong kỳ</TD></TR>
                ) : (
                  <>
                    {svc.rows.map((r) => (
                      <TR key={r.serviceId}>
                        <TD className="font-mono text-xs">{r.code}</TD>
                        <TD className="font-medium">{r.name}</TD>
                        <TD className="text-center">{r.usageCount}</TD>
                        <TD className="text-center">{r.sessions}</TD>
                        <TD className="text-right">{formatNumber(r.revenue)} đ</TD>
                        <TD className="text-right text-muted-foreground">{formatNumber(r.cost)} đ</TD>
                        <TD className="text-right font-semibold text-emerald-600">{formatNumber(r.profit)} đ</TD>
                      </TR>
                    ))}
                    <TR className="bg-muted/40">
                      <TD colSpan={2} className="font-semibold">Tổng cộng</TD>
                      <TD className="text-center font-semibold">{svc.total.usageCount}</TD>
                      <TD className="text-center font-semibold">{svc.total.sessions}</TD>
                      <TD className="text-right font-semibold">{formatNumber(svc.total.revenue)} đ</TD>
                      <TD className="text-right font-semibold">{formatNumber(svc.total.cost)} đ</TD>
                      <TD className="text-right font-semibold text-emerald-600">{formatNumber(svc.total.profit)} đ</TD>
                    </TR>
                  </>
                )}
              </TBody>
            </Table>
          </CardContent>
          </Card>
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Kỳ báo cáo: {formatDate(from)} – {formatDate(to)}</p>
    </div>
  );
}
