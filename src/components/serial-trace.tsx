"use client";
import { useEffect, useState } from "react";
import { ChevronRight, Cpu, Building2, FolderKanban, ShieldCheck, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { SERIAL_STATUS_LABEL, SERIAL_STATUS_TONE } from "@/lib/labels";

function ChildNode({ node, depth = 0 }: { node: any; depth?: number }) {
  return (
    <div style={{ marginLeft: depth * 16 }} className="border-l pl-3">
      <div className="flex items-center gap-2 py-1 text-sm">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono font-medium">{node.serialNumber}</span>
        <span className="text-muted-foreground">{node.product?.name}</span>
        {node.supplier && <Badge tone="muted">{node.supplier.code}</Badge>}
      </div>
      {node.origins?.length > 0 && (
        <div className="pl-6 text-xs text-muted-foreground">
          Xuất xứ: {node.origins[0].countryOfOrigin ?? "—"}
          {node.origins[0].coNumber && ` · CO ${node.origins[0].coNumber}`}
          {node.origins[0].poNumber && ` · PO ${node.origins[0].poNumber}`}
        </div>
      )}
      {node.childSerials?.map((c: any) => <ChildNode key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );
}

export function SerialTrace({ serialId }: { serialId: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/serials/${serialId}`).then(setData).catch((e) => setErr(e.message));
  }, [serialId]);

  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  const vendorW = data.warranties?.filter((w: any) => w.provider === "VENDOR") ?? [];
  const thngW = data.warranties?.filter((w: any) => w.provider === "THNG") ?? [];

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{data.serialNumber}</span>
        <Badge tone={SERIAL_STATUS_TONE[data.status]}>{SERIAL_STATUS_LABEL[data.status]}</Badge>
        <span className="text-muted-foreground">{data.product?.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-4">
        <div><div className="text-muted-foreground">Kho</div><div className="font-mono font-medium">{data.warehouse?.code}</div></div>
        <div><div className="text-muted-foreground">Vị trí</div><div className="font-medium">{data.bin ? `${data.bin.zone?.code}-${data.bin.code}` : "—"}</div></div>
        <div><div className="text-muted-foreground">Năm SX</div><div className="font-medium">{data.yearOfManufacture ?? "—"}</div></div>
        <div><div className="text-muted-foreground">Xuất xứ</div><div className="font-medium">{data.originCountry ?? "—"}</div></div>
      </div>

      {/* Truy vết ngược: máy cha + dự án + khách */}
      {(data.parentChain?.length > 0 || data.rootProject) && (
        <section>
          <h4 className="mb-1 flex items-center gap-1.5 font-medium"><ChevronRight className="h-4 w-4" /> Truy vết ngược (máy cha → dự án → khách)</h4>
          <div className="rounded-md border p-3">
            {data.parentChain?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 py-0.5">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{p.serialNumber}</span>
                <span className="text-muted-foreground">{p.productName}</span>
              </div>
            ))}
            {data.rootProject && (
              <div className="mt-1 flex flex-wrap items-center gap-3 border-t pt-2 text-xs">
                <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {data.rootProject.code} — {data.rootProject.name}</span>
                {data.rootProject.customer && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {data.rootProject.customer.name}</span>}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Truy vết xuôi: cây linh kiện */}
      {data.childSerials?.length > 0 && (
        <section>
          <h4 className="mb-1 flex items-center gap-1.5 font-medium"><ChevronRight className="h-4 w-4" /> Truy vết xuôi (cây linh kiện)</h4>
          <div className="rounded-md border p-2">
            {data.childSerials.map((c: any) => <ChildNode key={c.id} node={c} />)}
          </div>
        </section>
      )}

      {/* Bảo hành 2 tầng */}
      <section>
        <h4 className="mb-1 flex items-center gap-1.5 font-medium"><ShieldCheck className="h-4 w-4" /> Bảo hành</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border p-3 text-xs">
            <div className="mb-1 font-medium">Hãng / NCC</div>
            {vendorW.length ? vendorW.map((w: any) => (
              <div key={w.id}>Đến {formatDate(w.endDate)} — {w.terms ?? ""}</div>
            )) : <span className="text-muted-foreground">—</span>}
          </div>
          <div className="rounded-md border p-3 text-xs">
            <div className="mb-1 font-medium">THNG cấp khách</div>
            {thngW.length ? thngW.map((w: any) => (
              <div key={w.id}>Đến {formatDate(w.endDate)} — {w.terms ?? ""}</div>
            )) : <span className="text-muted-foreground">—</span>}
          </div>
        </div>
      </section>

      {/* Xuất xứ */}
      {data.origins?.length > 0 && (
        <section>
          <h4 className="mb-1 flex items-center gap-1.5 font-medium"><FileText className="h-4 w-4" /> Xuất xứ / chứng từ</h4>
          {data.origins.map((o: any) => (
            <div key={o.id} className="rounded-md border p-3 text-xs">
              Nước SX: {o.countryOfOrigin ?? "—"} · CO: {o.coNumber ?? "—"} · CQ: {o.cqNumber ?? "—"} · Tờ khai: {o.customsDeclarationNo ?? "—"}
              {o.supplier && <> · NCC: {o.supplier.name}</>}
            </div>
          ))}
        </section>
      )}

      {/* Timeline */}
      {data.events?.length > 0 && (
        <section>
          <h4 className="mb-1 font-medium">Lịch sử (timeline)</h4>
          <div className="space-y-1">
            {data.events.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{formatDate(e.createdAt)}</span>
                <Badge tone="muted">{e.eventType}</Badge>
                {e.toStatus && <span>{SERIAL_STATUS_LABEL[e.toStatus] ?? e.toStatus}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
