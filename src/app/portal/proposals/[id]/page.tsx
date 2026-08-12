"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { PROPOSAL_KIND_LABEL, PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE } from "@/lib/clinic-labels";

function optionTotal(o: any): number {
  const sub = (o.items ?? []).reduce((s: number, it: any) => s + Number(it.unitPrice || 0) * (it.quantity || 1), 0);
  return Math.max(0, sub - Number(o.discount || 0));
}

export default function PortalProposalPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setP(await apiFetch<any>(`/api/portal/proposals/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function accept(optionId: string) {
    if (!confirm("Xác nhận chọn phương án này?")) return;
    setBusy(true); setError(null);
    try {
      await apiFetch(`/api/portal/proposals/${id}/accept`, { method: "POST", body: JSON.stringify({ optionId }) });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!p) return <p className="text-destructive">{error ?? "Không tìm thấy báo giá."}</p>;

  const accepted = p.status === "ACCEPTED";

  return (
    <div>
      <Link href="/portal" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Trang chính
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{p.title}</h1>
        <Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {accepted && (
        <p className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-700">
          Quý khách đã chọn phương án <b>{p.acceptedSnapshot?.name ?? ""}</b> · {formatNumber(Number(p.agreedPrice ?? 0))} ₫
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {p.options.map((o: any) => {
          const isAccepted = p.acceptedOptionId === o.id;
          return (
            <Card key={o.id} className={isAccepted ? "border-emerald-500" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Badge>{PROPOSAL_KIND_LABEL[o.kind]}</Badge>
                  {isAccepted && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                </div>
                <div className="font-semibold">{o.name}</div>
                <ul className="space-y-1 text-sm">
                  {o.items.map((it: any) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</span>
                      <span className="text-muted-foreground">{formatNumber(Number(it.unitPrice || 0) * (it.quantity || 1))} ₫</span>
                    </li>
                  ))}
                </ul>
                {o.sessions != null && <div className="text-xs text-muted-foreground">{o.sessions} buổi</div>}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Tổng</span><span className="text-primary">{formatNumber(optionTotal(o))} ₫</span>
                </div>
                {!accepted && (
                  <Button className="w-full" disabled={busy} onClick={() => accept(o.id)}>Chọn phương án này</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
