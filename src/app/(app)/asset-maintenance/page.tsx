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
import { formatDate, formatNumber, normalizeSearch } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MAINT_STATUS_LABEL, MAINT_STATUS_TONE } from "@/lib/labels";
import { toCsv, downloadCsv } from "@/lib/csv";

interface Row {
  id: string;
  code: string;
  name: string;
  sku: string;
  cycleMonths: number;
  lastDate: string | null;
  nextDate: string | null;
  days: number | null;
  status: string;
  vendor: string | null;
}
interface Report {
  rows: Row[];
  summary: { overdue: number; due: number; ok: number; total: number };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function dueText(days: number | null): string {
  if (days == null) return "—";
  if (days < 0) return `Quá ${Math.abs(days)} ngày`;
  if (days === 0) return "Hôm nay";
  return `Còn ${days} ngày`;
}

export default function AssetMaintenancePage() {
  const [data, setData] = useState<Report | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Report>("/api/assets/reports/maintenance")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    if (!data) return;
    const headers = ["Mã", "Sản phẩm", "SKU", "Chu kỳ (tháng)", "Bảo trì gần nhất", "Bảo trì kế tiếp", "Tình trạng", "Trạng thái", "Đơn vị/hãng"];
    const rows = rowsView.map((r) => [
      r.code, r.name, r.sku, r.cycleMonths,
      r.lastDate ? formatDate(r.lastDate) : "",
      r.nextDate ? formatDate(r.nextDate) : "",
      dueText(r.days), MAINT_STATUS_LABEL[r.status] ?? r.status, r.vendor ?? "",
    ]);
    downloadCsv("lich-bao-tri.csv", toCsv(headers, rows));
  }

  const rowsView = (data?.rows ?? []).filter((r) => normalizeSearch(`${r.code} ${r.name} ${r.sku}`).includes(normalizeSearch(q)));

  return (
    <div>
      <PageHeader
        title="Lịch bảo trì"
        description="Bảng theo dõi bảo trì định kỳ toàn bộ thiết bị: lần gần nhất, kế tiếp và trạng thái đến hạn (tính theo chu kỳ khuyến nghị)."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4" /> Xuất CSV
          </Button>
        }
      />
      <div className="mb-4">
        <Input placeholder="Tìm theo mã / tên / SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Đang tải…</div>
      ) : !data || data.rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Chưa có thiết bị nào khai báo <b>chu kỳ bảo trì định kỳ</b>. Nhập chu kỳ (tháng) ở trang tài sản để xuất hiện tại đây.
        </CardContent></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Stat label="Quá hạn" value={formatNumber(data.summary.overdue)} tone="text-red-600" />
            <Stat label="Đến hạn (≤14 ngày)" value={formatNumber(data.summary.due)} tone="text-amber-600" />
            <Stat label="Bình thường" value={formatNumber(data.summary.ok)} tone="text-emerald-600" />
            <Stat label="Tổng thiết bị" value={formatNumber(data.summary.total)} />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Mã</TH>
                    <TH>Thiết bị</TH>
                    <TH className="text-center">Chu kỳ</TH>
                    <TH>Bảo trì gần nhất</TH>
                    <TH>Bảo trì kế tiếp</TH>
                    <TH>Tình trạng</TH>
                    <TH>Trạng thái</TH>
                    <TH>Đơn vị/hãng</TH>
                  </TR>
                </THead>
                <TBody>
                  {rowsView.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">
                        <Link href={`/assets/${r.id}`} className="text-primary hover:underline">{r.code}</Link>
                      </TD>
                      <TD>
                        <div>{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.sku}</div>
                      </TD>
                      <TD className="text-center">{r.cycleMonths} tháng</TD>
                      <TD>{r.lastDate ? formatDate(r.lastDate) : <span className="text-muted-foreground">Chưa có</span>}</TD>
                      <TD className="font-medium">{r.nextDate ? formatDate(r.nextDate) : "—"}</TD>
                      <TD className={r.status === "overdue" ? "text-red-600" : r.status === "due" ? "text-amber-600" : "text-muted-foreground"}>
                        {dueText(r.days)}
                      </TD>
                      <TD><Badge tone={(MAINT_STATUS_TONE[r.status] ?? "muted") as any}>{MAINT_STATUS_LABEL[r.status] ?? r.status}</Badge></TD>
                      <TD className="text-muted-foreground">{r.vendor ?? "—"}</TD>
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
