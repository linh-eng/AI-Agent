"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, TrendingDown, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber, normalizeSearch } from "@/lib/utils";
import { DEP_METHOD_LABEL } from "@/lib/labels";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

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
  salvageValue: number;
  months: number | null;
  depreciationStart: string | null;
  purchaseDate: string | null;
  totalUnits: number | null;
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

const EDIT_EMPTY = { cost: "", salvageValue: "", method: "STRAIGHT_LINE", months: "", start: "", totalUnits: "" };

export default function AssetDepreciationPage() {
  const canManage = useCan(PERMISSIONS.ASSET_MANAGE);
  const [asOf, setAsOf] = useState(todayStr());
  const [data, setData] = useState<Report | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(EDIT_EMPTY);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load(d: string) {
    setLoading(true);
    apiFetch<Report>(`/api/assets/reports/depreciation?asOf=${d}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(asOf); /* eslint-disable-next-line */ }, []);

  function openEdit(r: Row) {
    setEditing(r);
    setSaveErr(null);
    setForm({
      cost: String(r.cost ?? ""),
      salvageValue: r.salvageValue ? String(r.salvageValue) : "",
      method: r.method || "STRAIGHT_LINE",
      months: r.months != null ? String(r.months) : "",
      start: (r.depreciationStart ?? r.purchaseDate ?? "").slice(0, 10),
      totalUnits: r.totalUnits != null ? String(r.totalUnits) : "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setSaveErr(null);
    try {
      await apiFetch(`/api/assets/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cost: form.cost ? Number(form.cost) : null,
          salvageValue: form.salvageValue ? Number(form.salvageValue) : null,
          depreciationMethod: form.method,
          depreciationMonths: form.months ? Number(form.months) : null,
          depreciationStart: form.start || null,
          depreciationTotalUnits: form.totalUnits ? Number(form.totalUnits) : null,
        }),
      });
      setEditing(null);
      load(asOf);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const headers = ["Mã", "Sản phẩm", "SKU", "Phương pháp", "Nguyên giá", "Đã khấu hao", "Còn lại", "% khấu hao", "Khấu hao/tháng", "Khấu hao xong"];
    const rows = rowsView.map((r) => [
      r.code, r.name, r.sku, DEP_METHOD_LABEL[r.method] ?? r.method,
      r.cost, r.accumulated, r.remaining, `${r.percent}%`, r.monthly || "",
      r.endDate ? formatDate(r.endDate) : "",
    ]);
    downloadCsv(`khau-hao-${asOf}.csv`, toCsv(headers, rows));
  }

  const rowsView = (data?.rows ?? []).filter((r) => normalizeSearch(`${r.code} ${r.name} ${r.sku}`).includes(normalizeSearch(q)));

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
        <div className="min-w-[200px] flex-1">
          <Label>Tìm kiếm</Label>
          <Input placeholder="Mã / tên / SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
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
                    {canManage && <TH className="text-right">Sửa</TH>}
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
                      {canManage && (
                        <TD className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Sửa khấu hao">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TD>
                      )}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Sửa khấu hao — ${editing.code}` : ""}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nguyên giá *</Label>
              <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Giá trị thu hồi</Label>
              <Input type="number" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phương pháp khấu hao</Label>
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="STRAIGHT_LINE">Đường thẳng</option>
              <option value="DECLINING">Số dư giảm dần</option>
              <option value="UNITS">Theo sản lượng</option>
            </Select>
          </div>
          {form.method === "UNITS" ? (
            <div className="space-y-1.5">
              <Label>Tổng sản lượng ước tính *</Label>
              <Input type="number" min="1" value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số tháng khấu hao *</Label>
                <Input type="number" min="1" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bắt đầu khấu hao</Label>
                <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Để trống “Bắt đầu khấu hao” thì hệ thống tự tính từ <b>Ngày mua</b>. Khấu hao/tháng = Nguyên giá ÷ Số tháng;
            lũy kế cộng dồn từ ngày bắt đầu; giá trị còn lại = Nguyên giá − Lũy kế.
          </p>
          {saveErr && <p className="text-sm text-destructive">{saveErr}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
