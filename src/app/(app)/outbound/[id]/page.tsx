"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Pencil, Ban } from "lucide-react";
import { printIssue } from "@/lib/print";
import { ISSUE_TYPE_LABEL, DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
  quantity: number;
}
interface Issue {
  id: string;
  code: string;
  status: string;
  issueType: string;
  customerName?: string | null;
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  issuedAt?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: Item[];
}

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const canManage = useCan(PERMISSIONS.OUTBOUND_MANAGE);
  const [data, setData] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Issue>(`/api/issues/${params.id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }
  useEffect(load, [params.id]);

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/issues/${params.id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      setCancelOpen(false);
      setReason("");
      setLoading(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu xuất.</p>;

  const isPosted = data.status === "POSTED";

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Phiếu xuất {data.code}
            <Badge tone={DOC_STATUS_TONE[data.status]}>{DOC_STATUS_LABEL[data.status]}</Badge>
          </span>
        }
        description={`${ISSUE_TYPE_LABEL[data.issueType] ?? data.issueType} · Kho: ${data.warehouse.name}`}
        action={
          <>
            {canManage && isPosted && (
              <>
                <Link href={`/outbound/${data.id}/edit`}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> Sửa
                  </Button>
                </Link>
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" /> Hủy phiếu
                </Button>
              </>
            )}
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

      {data.status === "CANCELLED" && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <span className="font-semibold text-destructive">Phiếu đã hủy</span>
            {data.cancelledAt ? ` · ${formatDate(data.cancelledAt)}` : ""} — Lý do:{" "}
            {data.cancelReason ?? "—"}
          </CardContent>
        </Card>
      )}

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

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Hủy phiếu xuất ${data.code}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hệ thống sẽ hoàn lại tồn kho về đúng các lô đã xuất và đánh dấu phiếu là “Đã hủy”. Thao tác
            cần lý do và không thể tự hoàn tác.
          </p>
          <div className="space-y-1.5">
            <Label>Lý do hủy *</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ví dụ: xuất nhầm, khách trả lại hàng…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>
              Đóng
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={busy || reason.trim().length < 3}>
              {busy ? "Đang hủy…" : "Xác nhận hủy"}
            </Button>
          </div>
        </div>
      </Modal>
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
