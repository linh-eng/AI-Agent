"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { ASSET_MANAGE_LABEL } from "@/lib/labels";
import { toCsv, downloadCsv } from "@/lib/csv";

interface Row {
  id: string;
  code: string;
  name: string;
  sku: string;
  managementType: string | null;
  contract: number;
  paid: number;
  remaining: number;
  percent: number;
  count: number;
  lastPaid: string | null;
}
interface Report {
  rows: Row[];
  totals: { count: number; contract: number; paid: number; remaining: number };
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

export default function AssetDebtsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Report>("/api/assets/reports/debts")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    if (!data) return;
    const headers = ["Mã", "Sản phẩm", "SKU", "Hình thức", "Tổng hợp đồng", "Đã thanh toán", "Còn công nợ", "Tiến độ", "Số đợt", "Lần trả cuối"];
    const rows = data.rows.map((r) => [
      r.code, r.name, r.sku, r.managementType ? ASSET_MANAGE_LABEL[r.managementType] ?? r.managementType : "",
      r.contract, r.paid, r.remaining, `${r.percent}%`, r.count,
      r.lastPaid ? formatDate(r.lastPaid) : "",
    ]);
    downloadCsv("cong-no-tai-san.csv", toCsv(headers, rows));
  }

  return (
    <div>
      <PageHeader
        title="Công nợ tài sản"
        description="Tổng hợp giá trị hợp đồng, số đã thanh toán và công nợ còn lại của toàn bộ tài sản."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4" /> Xuất CSV
          </Button>
        }
      />

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Đang tải…</div>
      ) : !data || data.rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Chưa có tài sản nào khai báo giá trị hợp đồng hoặc đợt thanh toán. Nhập ở trang chi tiết tài sản.
        </CardContent></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Stat label="Số tài sản" value={formatNumber(data.totals.count)} />
            <Stat label="Tổng hợp đồng" value={`${formatNumber(data.totals.contract)} đ`} />
            <Stat label="Đã thanh toán" value={`${formatNumber(data.totals.paid)} đ`} tone="text-emerald-600" />
            <Stat label="Còn công nợ" value={`${formatNumber(data.totals.remaining)} đ`} tone="text-red-600" />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Mã</TH>
                    <TH>Sản phẩm</TH>
                    <TH>Hình thức</TH>
                    <TH className="text-right">Tổng hợp đồng</TH>
                    <TH className="text-right">Đã thanh toán</TH>
                    <TH className="text-right">Còn công nợ</TH>
                    <TH className="text-right">Tiến độ</TH>
                    <TH>Lần trả cuối</TH>
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
                      <TD>{r.managementType ? <Badge tone="muted">{ASSET_MANAGE_LABEL[r.managementType] ?? r.managementType}</Badge> : "—"}</TD>
                      <TD className="text-right tabular-nums">{formatNumber(r.contract)} đ</TD>
                      <TD className="text-right tabular-nums text-emerald-600">{formatNumber(r.paid)} đ</TD>
                      <TD className={`text-right tabular-nums font-medium ${r.remaining > 0 ? "text-red-600" : ""}`}>{formatNumber(r.remaining)} đ</TD>
                      <TD className="text-right">
                        <div className="text-xs text-muted-foreground">{r.percent}% · {r.count} đợt</div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-emerald-500" style={{ width: `${r.percent}%` }} />
                        </div>
                      </TD>
                      <TD>{r.lastPaid ? formatDate(r.lastPaid) : "—"}</TD>
                    </TR>
                  ))}
                </TBody>
                <tfoot>
                  <TR className="border-t font-semibold">
                    <TD colSpan={3}>Tổng cộng</TD>
                    <TD className="text-right tabular-nums">{formatNumber(data.totals.contract)} đ</TD>
                    <TD className="text-right tabular-nums text-emerald-600">{formatNumber(data.totals.paid)} đ</TD>
                    <TD className="text-right tabular-nums text-red-600">{formatNumber(data.totals.remaining)} đ</TD>
                    <TD colSpan={2}></TD>
                  </TR>
                </tfoot>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
