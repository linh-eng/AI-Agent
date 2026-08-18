"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { DEP_METHOD_LABEL } from "@/lib/labels";
import { toCsv, downloadCsv } from "@/lib/csv";

interface Row {
  id: string;
  code: string;
  name: string;
  sku: string;
  method: string;
  cost: number;
  accumulated: number;
  remaining: number;
  percent: number;
  monthly: number;
  endDate: string | null;
}
interface YearAgg { year: number; depreciation: number; accumulated: number; remaining: number }
interface Report {
  asOf: string;
  rows: Row[];
  yearly: YearAgg[];
  totals: { count: number; cost: number; accumulated: number; remaining: number };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AssetDepreciationPage() {
  const [asOf, setAsOf] = useState(todayStr());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  function load(d: string) {
    setLoading(true);
    apiFetch<Report>(`/api/assets/reports/depreciation?asOf=${d}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(asOf); /* eslint-disable-next-line */ }, []);

  function exportCsv() {
    if (!data) return;
    const headers = ["Mã", "Sản phẩm", "SKU", "Phương pháp", "Nguyên giá", "Đã khấu hao", "Còn lại", "% khấu hao", "Khấu hao/tháng", "Khấu hao xong"];
    const rows = data.rows.map((r) => [
      r.code, r.name, r.sku, DEP_METHOD_LABEL[r.method] ?? r.method,
      r.cost, r.accumulated, r.remaining, `${r.percent}%`, r.monthly || "",
      r.endDate ? formatDate(r.endDate) : "",
    ]);
    downloadCsv(`khau-hao-${asOf}.csv`, toCsv(headers, rows));
  }

  return (
    <div>
      <PageHeader
        title="Khấu hao tài sản"
        description="Tổng hợp khấu hao lũy kế & giá trị còn lại toàn danh mục, kèm báo cáo quá trình khấu hao theo thời gian."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4" /> Xuất CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label>Tính đến ngày</Label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
        </div>
        <Button onClick={() => load(asOf)}>Xem</Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Đang tải…</div>
      ) : !data || data.rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Chưa có tài sản nào cấu hình khấu hao (cần nhập nguyên giá + phương pháp ở trang tài sản).
        </CardContent></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Stat label="Số tài sản" value={formatNumber(data.totals.count)} />
            <Stat label="Tổng nguyên giá" value={`${formatNumber(data.totals.cost)} đ`} />
            <Stat label="Đã khấu hao (lũy kế)" value={`${formatNumber(data.totals.accumulated)} đ`} tone="text-amber-600" />
            <Stat label="Giá trị còn lại" value={`${formatNumber(data.totals.remaining)} đ`} tone="text-primary" />
          </div>

          <h3 className="mb-2 font-semibold">Chi tiết theo tài sản</h3>
          <Card className="mb-6">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Mã</TH>
                    <TH>Sản phẩm</TH>
                    <TH>Phương pháp</TH>
                    <TH className="text-right">Nguyên giá</TH>
                    <TH className="text-right">Đã khấu hao</TH>
                    <TH className="text-right">Còn lại</TH>
                    <TH className="text-right">Tiến độ</TH>
                    <TH>Khấu hao xong</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.rows.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">
                        <Link href={`/assets/${r.id}`} className="text-primary hover:underline">{r.code}</Link>
                      </TD>
                      <TD>
                        <div>{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.sku}</div>
                      </TD>
                      <TD><Badge tone="muted">{DEP_METHOD_LABEL[r.method] ?? r.method}</Badge></TD>
                      <TD className="text-right tabular-nums">{formatNumber(r.cost)} đ</TD>
                      <TD className="text-right tabular-nums text-amber-600">{formatNumber(r.accumulated)} đ</TD>
                      <TD className="text-right tabular-nums font-medium">{formatNumber(r.remaining)} đ</TD>
                      <TD className="text-right">
                        <div className="text-xs text-muted-foreground">{r.percent}%</div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${r.percent}%` }} />
                        </div>
                      </TD>
                      <TD>{r.endDate ? formatDate(r.endDate) : "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <div className="mb-2 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Quá trình khấu hao theo thời gian (toàn danh mục)</h3>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Năm</TH>
                    <TH className="text-right">Khấu hao trong năm</TH>
                    <TH className="text-right">Lũy kế cuối năm</TH>
                    <TH className="text-right">Giá trị còn lại cuối năm</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.yearly.map((y) => (
                    <TR key={y.year}>
                      <TD className="font-medium">{y.year}</TD>
                      <TD className="text-right tabular-nums">{formatNumber(y.depreciation)} đ</TD>
                      <TD className="text-right tabular-nums text-amber-600">{formatNumber(y.accumulated)} đ</TD>
                      <TD className="text-right tabular-nums">{formatNumber(y.remaining)} đ</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
