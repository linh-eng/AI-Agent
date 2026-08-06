"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { INBOUND_TYPES, type InboundTypeCode } from "@/lib/inbound";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

interface Line {
  id: string;
  quantity: number;
  isCommercialStock: boolean;
  product: { id: string; sku: string; name: string; trackingMode: string };
  project?: { code: string; name: string } | null;
}
interface Order {
  id: string;
  number: string;
  type: string;
  status: string;
  poNumber?: string | null;
  invoiceNumber?: string | null;
  note?: string | null;
  supplier?: { code: string; name: string } | null;
  lines: Line[];
}
interface BinOpt { id: string; label: string }

// State nhận hàng cho mỗi dòng
interface RecvState {
  isDefective: boolean;
  binId: string;
  serialText: string; // mỗi serial 1 dòng
  originCountry: string;
  coNumber: string;
  cqNumber: string;
  customsDeclarationNo: string;
  vendorStart: string;
  vendorEnd: string;
  thngStart: string;
  thngEnd: string;
  // LOT
  lotNumber: string;
  lotQty: string;
  mfgDate: string;
  expDate: string;
  // QUANTITY
  qty: string;
}
const emptyRecv: RecvState = {
  isDefective: false, binId: "", serialText: "", originCountry: "", coNumber: "", cqNumber: "",
  customsDeclarationNo: "", vendorStart: "", vendorEnd: "", thngStart: "", thngEnd: "",
  lotNumber: "", lotQty: "", mfgDate: "", expDate: "", qty: "",
};

export default function InboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.INBOUND_WRITE);
  const [order, setOrder] = useState<Order | null>(null);
  const [bins, setBins] = useState<BinOpt[]>([]);
  const [recv, setRecv] = useState<Record<string, RecvState>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const o = await apiFetch<Order>(`/api/inbound/${id}`);
    setOrder(o);
    setRecv(Object.fromEntries(o.lines.map((l) => [l.id, { ...emptyRecv }])));
    const zones = await apiFetch<any[]>("/api/zones").catch(() => []);
    setBins(
      zones.flatMap((z) =>
        (z.bins ?? []).map((b: any) => ({ id: b.id, label: `${z.warehouse?.code ?? ""} · ${z.code}-${b.code}` }))
      )
    );
  }
  useEffect(() => {
    load();
  }, [id]);

  function upd(lineId: string, patch: Partial<RecvState>) {
    setRecv((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  async function receive() {
    if (!order) return;
    setError(null);
    setMsg(null);
    setSaving(true);
    try {
      const payloadLines = order.lines.map((line) => {
        const r = recv[line.id];
        const mode = line.product.trackingMode;
        const base: any = { lineId: line.id, isDefective: r.isDefective };
        const origin = {
          countryOfOrigin: r.originCountry || null,
          coNumber: r.coNumber || null,
          cqNumber: r.cqNumber || null,
          customsDeclarationNo: r.customsDeclarationNo || null,
        };
        const vendorWarranty = r.vendorStart || r.vendorEnd ? { startDate: r.vendorStart || null, endDate: r.vendorEnd || null } : null;
        const thngWarranty = r.thngStart || r.thngEnd ? { startDate: r.thngStart || null, endDate: r.thngEnd || null } : null;

        if (mode === "SERIAL") {
          const serials = r.serialText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          base.serials = serials.map((sn) => ({
            serialNumber: sn,
            binId: r.binId || null,
            originCountry: r.originCountry || null,
            origin,
            vendorWarranty,
            thngWarranty,
          }));
        } else if (mode === "LOT") {
          base.lot = {
            lotNumber: r.lotNumber,
            quantity: Number(r.lotQty || line.quantity),
            manufactureDate: r.mfgDate || null,
            expiryDate: r.expDate || null,
            origin,
            vendorWarranty,
          };
        } else {
          base.quantity = Number(r.qty || line.quantity);
        }
        return base;
      });

      const res = await apiFetch<{ createdSerials: string[]; createdLots: string[] }>(
        `/api/inbound/${id}/receive`,
        { method: "POST", body: JSON.stringify({ lines: payloadLines }) }
      );
      setMsg(`Đã nhận: ${res.createdSerials.length} serial, ${res.createdLots.length} lô.`);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (!order) return <p className="text-muted-foreground">Đang tải...</p>;

  const cfg = INBOUND_TYPES[order.type as InboundTypeCode];
  const received = order.status === "APPROVED";

  return (
    <div>
      <div className="mb-4">
        <Link href="/inbound" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách phiếu nhập
        </Link>
      </div>
      <PageHeader
        title={`Phiếu nhập ${order.number}`}
        description={`${order.type} — ${cfg?.label ?? ""}`}
        action={<Badge tone={DOC_STATUS_TONE[order.status]}>{DOC_STATUS_LABEL[order.status]}</Badge>}
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-4">
          <div><div className="text-muted-foreground">NCC</div><div className="font-medium">{order.supplier?.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">PO</div><div className="font-medium">{order.poNumber ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Hóa đơn</div><div className="font-medium">{order.invoiceNumber ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Kho đích</div><div className="font-medium font-mono">{cfg?.destinationWarehouseCode ?? "—"}</div></div>
        </CardContent>
      </Card>

      {received && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Phiếu đã nhận hàng — tồn đã được đặt vào kho. Xem{" "}
          <Link href="/serials" className="font-medium underline">danh sách serial</Link>.
        </div>
      )}
      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {order.lines.map((line) => {
          const r = recv[line.id];
          if (!r) return null;
          const mode = line.product.trackingMode;
          return (
            <Card key={line.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {line.product.sku} — {line.product.name}{" "}
                  <Badge tone="muted">{mode}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  SL kế hoạch: <span className="font-medium">{line.quantity}</span>
                  {line.project && <> · Dự án: <span className="font-mono">{line.project.code}</span></>}
                  {line.isCommercialStock && <> · Hàng thương mại</>}
                </p>
              </CardHeader>
              {!received && canWrite && (
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={r.isDefective} onChange={(e) => upd(line.id, { isDefective: e.target.checked })} />
                    Hàng lỗi → chuyển thẳng K-HH
                  </label>

                  {mode === "SERIAL" && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs">Serial (mỗi dòng 1 serial — quét liên tục)</Label>
                          <textarea
                            className="flex min-h-[90px] w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={r.serialText}
                            onChange={(e) => upd(line.id, { serialText: e.target.value })}
                            placeholder={"SN00001\nSN00002"}
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Vị trí kệ (Scan-to-Bin)</Label>
                          <Select value={r.binId} onChange={(e) => upd(line.id, { binId: e.target.value })}>
                            <option value="">— Chọn bin —</option>
                            {bins.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1.5"><Label className="text-xs">Xuất xứ</Label><Input value={r.originCountry} onChange={(e) => upd(line.id, { originCountry: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">CO</Label><Input value={r.coNumber} onChange={(e) => upd(line.id, { coNumber: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">CQ</Label><Input value={r.cqNumber} onChange={(e) => upd(line.id, { cqNumber: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Tờ khai HQ</Label><Input value={r.customsDeclarationNo} onChange={(e) => upd(line.id, { customsDeclarationNo: e.target.value })} /></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1.5"><Label className="text-xs">BH hãng từ</Label><Input type="date" value={r.vendorStart} onChange={(e) => upd(line.id, { vendorStart: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">BH hãng đến</Label><Input type="date" value={r.vendorEnd} onChange={(e) => upd(line.id, { vendorEnd: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">BH THNG từ</Label><Input type="date" value={r.thngStart} onChange={(e) => upd(line.id, { thngStart: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">BH THNG đến</Label><Input type="date" value={r.thngEnd} onChange={(e) => upd(line.id, { thngEnd: e.target.value })} /></div>
                      </div>
                    </>
                  )}

                  {mode === "LOT" && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5"><Label className="text-xs">Số lô *</Label><Input value={r.lotNumber} onChange={(e) => upd(line.id, { lotNumber: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Số lượng</Label><Input type="number" value={r.lotQty} placeholder={String(line.quantity)} onChange={(e) => upd(line.id, { lotQty: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Ngày SX</Label><Input type="date" value={r.mfgDate} onChange={(e) => upd(line.id, { mfgDate: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Hạn dùng</Label><Input type="date" value={r.expDate} onChange={(e) => upd(line.id, { expDate: e.target.value })} /></div>
                    </div>
                  )}

                  {(mode === "QUANTITY" || mode === "LICENSE") && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5"><Label className="text-xs">Số lượng nhận</Label><Input type="number" value={r.qty} placeholder={String(line.quantity)} onChange={(e) => upd(line.id, { qty: e.target.value })} /></div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {!received && canWrite && (
        <div className="mt-4 flex justify-end">
          <Button onClick={receive} disabled={saving}>
            <PackageCheck className="h-4 w-4" /> {saving ? "Đang nhận..." : "Xác nhận nhận hàng"}
          </Button>
        </div>
      )}
    </div>
  );
}
