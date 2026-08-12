"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, HeartPulse, FileSpreadsheet, BookOpen, ShoppingBag, ImageIcon, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import {
  BOOKING_STATUS_LABEL, PLAN_STATUS_LABEL, PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE,
  CARE_KIND_LABEL, RECOMMENDATION_PRIORITY_LABEL,
} from "@/lib/clinic-labels";

function fmt(d: string) {
  return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PortalHome() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setD(await apiFetch<any>("/api/portal/overview")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function ackCare(id: string) {
    await fetch(`/api/portal/care/${id}/ack`, { method: "POST" }).catch(() => {});
    load();
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!d) return <p className="text-destructive">Không tải được dữ liệu.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Xin chào, {d.customer?.fullName}</h1>
        <p className="text-sm text-muted-foreground">Mã KH: {d.customer?.code}</p>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" /> Lịch hẹn sắp tới</h2>
        {d.bookings.length === 0 ? <p className="text-sm text-muted-foreground">Không có lịch hẹn sắp tới.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {d.bookings.map((b: any) => (
              <Card key={b.id}><CardContent className="p-4 text-sm">
                <div className="font-medium">{b.service?.name ?? "Dịch vụ"}</div>
                <div className="text-muted-foreground">{fmt(b.scheduledAt)}{b.room ? " · " + b.room : ""}</div>
                <Badge tone="warning" className="mt-1">{BOOKING_STATUS_LABEL[b.status]}</Badge>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>

      {d.proposals.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" /> Báo giá</h2>
          <div className="space-y-2">
            {d.proposals.map((p: any) => (
              <Card key={p.id}><CardContent className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-muted-foreground">{p.status === "ACCEPTED" ? `Đã chốt · ${formatNumber(Number(p.agreedPrice ?? 0))} ₫` : "Đang chờ quý khách xem"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
                  <Link href={`/portal/proposals/${p.id}`}><Button size="sm" variant="outline">Xem</Button></Link>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </section>
      )}

      {d.plans.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><HeartPulse className="h-4 w-4" /> Phác đồ điều trị</h2>
          <div className="space-y-2">
            {d.plans.map((p: any) => (
              <Card key={p.id}><CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <Badge tone="success">{PLAN_STATUS_LABEL[p.status]}</Badge>
                </div>
                {p.goals && <div className="mt-1 text-muted-foreground">Mục tiêu: {p.goals}</div>}
                <div className="text-muted-foreground">{p._count.sessions} buổi</div>
              </CardContent></Card>
            ))}
          </div>
        </section>
      )}

      {d.cares.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> Hướng dẫn chăm sóc</h2>
          <div className="space-y-2">
            {d.cares.map((c: any) => (
              <Card key={c.id}><CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.title}</span>
                  <Badge tone="muted">{CARE_KIND_LABEL[c.kind]}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.content}</p>
                <div className="mt-2">
                  {c.acknowledgedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Đã xác nhận đọc</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => ackCare(c.id)}>Tôi đã đọc</Button>
                  )}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </section>
      )}

      {d.recommendations.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4" /> Sản phẩm đề xuất</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {d.recommendations.map((r: any) => (
              <Card key={r.id}><CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.product?.name}</span>
                  <Badge tone="default">{RECOMMENDATION_PRIORITY_LABEL[r.priority]}</Badge>
                </div>
                {r.reason && <div className="text-muted-foreground">{r.reason}</div>}
                <div className="mt-1">{r.price != null ? formatNumber(Number(r.price)) + " ₫" : ""}{r.quantity > 1 ? ` × ${r.quantity}` : ""}</div>
              </CardContent></Card>
            ))}
          </div>
        </section>
      )}

      {d.media.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4" /> Hình ảnh trước / sau</h2>
          <div className="flex flex-wrap gap-2">
            {d.media.map((m: any) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={`/api/portal/media/${m.id}`} alt={m.kind} className="h-28 w-28 rounded-md border object-cover" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
