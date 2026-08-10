"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch: { batchCode?: string | null; expiryDate?: string | null };
  systemQty: number;
  countedQty?: number | null;
}
interface Count {
  id: string;
  code: string;
  status: string;
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  countedAt?: string | null;
  items: Item[];
}

export default function StockCountDetailPage({ params }: { params: { id: string } }) {
  const canWrite = useCan(PERMISSIONS.STOCKCOUNT_WRITE);
  const [data, setData] = useState<Count | null>(null);
  const [loading, setLoading] = useState(true);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await apiFetch<Count>(`/api/stock-counts/${params.id}`);
    setData(d);
    // Mặc định điền số hệ thống để thao tác nhanh (chỉ khi còn nháp).
    if (d.status === "DRAFT") {
      const init: Record<string, string> = {};
      d.items.forEach((it) => (init[it.id] = String(it.countedQty ?? it.systemQty)));
      setCounted(init);
    }
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function post() {
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/stock-counts/${params.id}/post`, {
        method: "POST",
        body: JSON.stringify({
          items: data.items.map((it) => ({
            itemId: it.id,
            countedQty: Number(counted[it.id] ?? it.systemQty),
          })),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu kiểm kê.</p>;

  const isDraft = data.status === "DRAFT";
  const diffCount = data.items.filter((it) => {
    const c = isDraft ? Number(counted[it.id] ?? it.systemQty) : it.countedQty ?? it.systemQty;
    return Math.abs(c - it.systemQty) > 1e-9;
  }).length;

  return (
    <div>
      <PageHeader
        title={`Phiếu kiểm kê ${data.code}`}
        description={`Kho: ${data.warehouse.name} · Người kiểm: ${data.createdBy.name}`}
        action={
          <div className="flex gap-2">
            {isDraft && canWrite && (
              <Button onClick={post} disabled={saving}>
                <Check className="h-4 w-4" /> {saving ? "Đang duyệt…" : "Duyệt & điều chỉnh"}
              </Button>
            )}
            <Link href="/stock-counts">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={isDraft ? "warning" : "success"}>{isDraft ? "Đang kiểm" : "Đã duyệt"}</Badge>
        <span className="text-sm text-muted-foreground">
          {data.items.length} lô · {diffCount} lô chênh lệch
          {data.countedAt ? ` · duyệt ${formatDate(data.countedAt)}` : ""}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Lô</TH>
                <TH>HSD</TH>
                <TH className="text-right">Tồn hệ thống</TH>
                <TH className="text-right">Thực đếm</TH>
                <TH className="text-right">Chênh lệch</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((it) => {
                const c = isDraft
                  ? Number(counted[it.id] ?? it.systemQty)
                  : it.countedQty ?? it.systemQty;
                const diff = c - it.systemQty;
                return (
                  <TR key={it.id}>
                    <TD className="font-mono text-xs">{it.product.sku}</TD>
                    <TD className="font-medium">{it.product.name}</TD>
                    <TD className="font-mono text-xs">{it.batch.batchCode ?? "—"}</TD>
                    <TD>{it.batch.expiryDate ? formatDate(it.batch.expiryDate) : "—"}</TD>
                    <TD className="text-right">{formatNumber(it.systemQty)} {it.product.uom}</TD>
                    <TD className="text-right">
                      {isDraft ? (
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={counted[it.id] ?? ""}
                          onChange={(e) => setCounted((p) => ({ ...p, [it.id]: e.target.value }))}
                          className="ml-auto h-8 w-24 text-right"
                        />
                      ) : (
                        <>{formatNumber(it.countedQty ?? 0)} {it.product.uom}</>
                      )}
                    </TD>
                    <TD className="text-right">
                      {Math.abs(diff) < 1e-9 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <span className={diff > 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                          {diff > 0 ? "+" : ""}
                          {formatNumber(diff)}
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
