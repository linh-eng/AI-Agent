"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { printIssue } from "@/lib/print";
import { ISSUE_TYPE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
  quantity: number;
}
interface Issue {
  id: string;
  code: string;
  issueType: string;
  customerName?: string | null;
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  issuedAt?: string | null;
  items: Item[];
}

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Issue>(`/api/issues/${params.id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu xuất.</p>;

  return (
    <div>
      <PageHeader
        title={`Phiếu xuất ${data.code}`}
        description={`${ISSUE_TYPE_LABEL[data.issueType] ?? data.issueType} · Kho: ${data.warehouse.name}`}
        action={
          <>
            <Button variant="outline" onClick={() => printIssue(data)}>
              <Printer className="h-4 w-4" /> In phiếu
            </Button>
            <Link href="/outbound">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Loại xuất</div>
            <Badge tone="default">{ISSUE_TYPE_LABEL[data.issueType] ?? data.issueType}</Badge>
          </div>
          <Info label="Khách / Bộ phận" value={data.customerName ?? "—"} />
          <Info label="Người xuất" value={data.createdBy.name} />
          <Info label="Ngày xuất" value={formatDate(data.issuedAt)} />
          {data.note && <Info label="Ghi chú" value={data.note} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Sản phẩm</TH>
                <TH>Lô xuất</TH>
                <TH>HSD</TH>
                <TH className="text-right">SL</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((it) => (
                <TR key={it.id}>
                  <TD className="font-mono text-xs">{it.product.sku}</TD>
                  <TD className="font-medium">{it.product.name}</TD>
                  <TD className="font-mono text-xs">{it.batch?.batchCode ?? "—"}</TD>
                  <TD>{it.batch?.expiryDate ? formatDate(it.batch.expiryDate) : "—"}</TD>
                  <TD className="text-right">
                    {formatNumber(it.quantity)} {it.product.uom}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
