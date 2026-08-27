"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Tag, Pencil, Ban } from "lucide-react";
import { printReceipt, printBatchLabels } from "@/lib/print";
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
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batchCode?: string | null;
  expiryDate?: string | null;
  mfgDate?: string | null;
  quantity: number;
  unitCost?: number | null;
}
interface Receipt {
  id: string;
  code: string;
  status: string;
  supplier: { name: string; code: string };
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  receivedAt?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: Item[];
}

export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const canManage = useCan(PERMISSIONS.INBOUND_MANAGE);
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Receipt>(`/api/receipts/${params.id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }
  useEffect(load, [params.id]);

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/receipts/${params.id}`, {
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
  if (!data) return <p className="text-destructive">Không tìm thấy phiếu nhập.</p>;

  const total = data.items.reduce((s, it) => s + it.quantity * (it.unitCost ?? 0), 0);
  const isPosted = data.status === "POSTED";

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Phiếu nhập {data.code}
            <Badge tone={DOC_STATUS_TONE[data.status]}>{DOC_STATUS_LABEL[data.status]}</Badge>
          </span>
        }
        description={`NCC: ${data.supplier.name} · Kho: ${data.warehouse.name}`}
        action={
          <>
            {canManage && isPosted && (
              <>
                <Link href={`/inbound/${data.id}/edit`}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> Sửa
                  </Button>
                </Link>
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" /> Hủy phiếu
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => printBatchLabels(data)}>
              <Tag className="h-4 w-4" /> In tem lô
            </Button>
            <Button variant="outline" onClick={() => printReceipt(data)}>
              <Printer className="h-4 w-4" /> In phiếu
            </Button>
            <Link href="/inbound">
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
          <Info label="Nhà cung cấp" value={data.supplier.name} />
          <Info label="Kho nhập" value={data.warehouse.name} />
          <Info label="Người nhập" value={data.createdBy.name} />
          <Info label="Ngày nhập" value={formatDate(data.receivedAt)} />
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
                <TH>Mã lô</TH>
                <TH>HSD</TH>
                <TH className="text-right">SL</TH>
                <TH className="text-right">Giá vốn</TH>
                <TH className="text-right">Thành tiền</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((it) => (
                <TR key={it.id}>
                  <TD className="font-mono text-xs">{it.product.sku}</TD>
                  <TD className="font-medium">{it.product.name}</TD>
                  <TD className="font-mono text-xs">{it.batchCode ?? "—"}</TD>
                  <TD>{it.expiryDate ? formatDate(it.expiryDate) : "—"}</TD>
                  <TD className="text-right">
                    {formatNumber(it.quantity)} {it.product.uom}
                  </TD>
                  <TD className="text-right">{it.unitCost != null ? formatNumber(it.unitCost) : "—"}</TD>
                  <TD className="text-right">{formatNumber(it.quantity * (it.unitCost ?? 0))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex justify-end border-t p-4 text-sm">
            Tổng giá trị:{" "}
            <span className="ml-2 font-semibold">{formatNumber(total)} đ</span>
          </div>
        </CardContent>
      </Card>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Hủy phiếu nhập ${data.code}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hệ thống sẽ hoàn lại tồn kho đã cộng từ phiếu này và đánh dấu phiếu là “Đã hủy”. Thao tác
            cần lý do và không thể tự hoàn tác.
          </p>
          <div className="space-y-1.5">
            <Label>Lý do hủy *</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ví dụ: nhập nhầm số lượng, sai nhà cung cấp…"
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
