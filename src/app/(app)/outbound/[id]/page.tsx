"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle2, XCircle, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { OUTBOUND_TYPES, type OutboundTypeCode } from "@/lib/outbound";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

export default function OutboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.OUTBOUND_WRITE);
  const canApprove = useCan(PERMISSIONS.OUTBOUND_APPROVE);

  const [order, setOrder] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [scans, setScans] = useState<Record<string, string>>({});
  const [delivery, setDelivery] = useState({ method: "", carrier: "", trackingNumber: "", signatureUrl: "", packingVideoUrl: "" });
  const [override, setOverride] = useState(false);

  async function load() {
    setOrder(await apiFetch(`/api/outbound/${id}`));
  }
  useEffect(() => { load(); }, [id]);

  async function run(fn: () => Promise<any>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try { await fn(); setMsg(okMsg); await load(); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  const submit = () => run(() => apiFetch(`/api/outbound/${id}/submit`, { method: "POST" }), "Đã trình duyệt.");
  const approve = () => run(() => apiFetch(`/api/outbound/${id}/approve`, { method: "POST" }), "Đã duyệt phiếu xuất.");
  const reject = () => run(() => apiFetch(`/api/outbound/${id}/reject`, { method: "POST", body: JSON.stringify({ reason: rejectReason }) }), "Đã từ chối phiếu.");

  function ship() {
    const lines = order.lines.map((l: any) => ({
      lineId: l.id,
      serialNumbers: (scans[l.id] ?? "").split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean),
    }));
    return run(
      () => apiFetch(`/api/outbound/${id}/ship`, { method: "POST", body: JSON.stringify({ lines, delivery, allowProjectOverride: override }) }),
      "Đã xuất kho & lập biên bản bàn giao."
    );
  }

  if (!order) return <p className="text-muted-foreground">Đang tải...</p>;
  const cfg = OUTBOUND_TYPES[order.type as OutboundTypeCode];
  const delivered = !!order.deliveredAt;

  return (
    <div>
      <div className="mb-4">
        <Link href="/outbound" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách phiếu xuất
        </Link>
      </div>
      <PageHeader
        title={`Phiếu xuất ${order.number}`}
        description={`${order.type} — ${cfg?.label ?? ""}`}
        action={<Badge tone={DOC_STATUS_TONE[order.status]}>{DOC_STATUS_LABEL[order.status]}</Badge>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {order.status === "REJECTED" && order.rejectReason && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Từ chối: {order.rejectReason}</div>
      )}

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-4">
          <div><div className="text-muted-foreground">Khách hàng</div><div className="font-medium">{order.customer?.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Dự án</div><div className="font-medium font-mono">{order.project?.code ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Hạn mức công nợ</div><div className="font-medium">{order.customer?.creditLimit ? formatNumber(Number(order.customer.creditLimit)) + " ₫" : "—"}</div></div>
          <div><div className="text-muted-foreground">Giao hàng</div><div className="font-medium">{delivered ? formatDate(order.deliveredAt) : "Chưa giao"}</div></div>
        </CardContent>
      </Card>

      {/* Actions theo trạng thái */}
      {order.status === "DRAFT" && canWrite && (
        <Card className="mb-4"><CardContent className="flex items-center justify-between p-4">
          <span className="text-sm">Phiếu nháp — trình kế toán duyệt xuất.</span>
          <Button onClick={submit} disabled={busy}><Send className="h-4 w-4" /> Trình duyệt</Button>
        </CardContent></Card>
      )}
      {order.status === "PENDING_APPROVAL" && (
        <Card className="mb-4"><CardContent className="space-y-3 p-4">
          <div className="text-sm">Chờ kế toán duyệt (kiểm tồn khả dụng + hạn mức công nợ).</div>
          {canApprove ? (
            <div className="flex flex-wrap items-end gap-2">
              <Button onClick={approve} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Duyệt</Button>
              <div className="flex items-end gap-2">
                <div><Label className="text-xs">Lý do từ chối</Label><Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-56" /></div>
                <Button variant="destructive" onClick={reject} disabled={busy || !rejectReason.trim()}><XCircle className="h-4 w-4" /> Từ chối</Button>
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">Bạn không có quyền duyệt xuất.</p>}
        </CardContent></Card>
      )}

      {/* Lines / Picking */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Hàng xuất {order.status === "APPROVED" && !delivered && "— quét 100% serial"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {order.lines.map((l: any) => (
            <div key={l.id} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div><span className="font-medium">{l.product.sku}</span> — {l.product.name} <Badge tone="muted">{l.product.trackingMode}</Badge></div>
                <div className="text-sm text-muted-foreground">SL: <span className="font-medium">{l.quantity}</span></div>
              </div>
              {order.status === "APPROVED" && !delivered && canWrite && l.product.trackingMode === "SERIAL" && (
                <textarea
                  className="flex min-h-[70px] w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={scans[l.id] ?? ""}
                  onChange={(e) => setScans({ ...scans, [l.id]: e.target.value })}
                  placeholder={`Quét đúng ${l.quantity} serial, mỗi dòng 1 serial`}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Đóng gói & bàn giao */}
      {order.status === "APPROVED" && !delivered && canWrite && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Đóng gói & bàn giao</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">Hình thức giao</Label><Input value={delivery.method} onChange={(e) => setDelivery({ ...delivery, method: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Đơn vị vận chuyển</Label><Input value={delivery.carrier} onChange={(e) => setDelivery({ ...delivery, carrier: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Mã vận đơn</Label><Input value={delivery.trackingNumber} onChange={(e) => setDelivery({ ...delivery, trackingNumber: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">Chữ ký điện tử (link)</Label><Input value={delivery.signatureUrl} onChange={(e) => setDelivery({ ...delivery, signatureUrl: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Video đóng gói (hàng giá trị cao)</Label><Input value={delivery.packingVideoUrl} onChange={(e) => setDelivery({ ...delivery, packingVideoUrl: e.target.value })} /></div>
            </div>
            {canApprove && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={override} onChange={(e) => setOverride(e.target.checked)} />
                Cho phép vượt khóa dự án K-DA (phê duyệt xuất hàng dự án khác)
              </label>
            )}
            <div className="flex justify-end">
              <Button onClick={ship} disabled={busy}><Truck className="h-4 w-4" /> Xuất & bàn giao</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biên bản bàn giao */}
      {order.deliveryReports?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Biên bản bàn giao</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Số BB</TH><TH>Hình thức</TH><TH>Vận chuyển</TH><TH>Mã vận đơn</TH><TH>Serial đã giao</TH></TR></THead>
              <TBody>
                {order.deliveryReports.map((d: any) => (
                  <TR key={d.id}>
                    <TD className="font-mono font-medium">{d.number}</TD>
                    <TD>{d.method ?? "—"}</TD>
                    <TD>{d.carrier ?? "—"}</TD>
                    <TD className="font-mono">{d.trackingNumber ?? "—"}</TD>
                    <TD className="max-w-xs truncate font-mono text-xs">{d.serialNumbers ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
