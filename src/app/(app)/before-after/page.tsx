"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select, Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Group {
  sessionId: string; sessionName: string | null; sessionNumber: number; performedAt: string | null;
  customerId: string; customerName: string; serviceName: string | null; technicianName: string | null;
  before: { id: string; filename: string }[]; after: { id: string; filename: string }[];
}
interface Opt { id: string; name?: string; fullName?: string; code?: string }
interface Summary { totalReviews: number; avgSatisfaction: number | null; avgTechnician: number | null; wouldReturnRate: number | null; technicians: { technicianName: string; count: number; avgTechnicianScore: number | null }[] }

export default function BeforeAfterPage() {
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const [groups, setGroups] = useState<Group[]>([]);
  const [services, setServices] = useState<Opt[]>([]);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ customerId: "", serviceId: "", from: "", to: "" });
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (filter.customerId) q.set("customerId", filter.customerId);
    if (filter.serviceId) q.set("serviceId", filter.serviceId);
    if (filter.from) q.set("from", new Date(filter.from).toISOString());
    if (filter.to) q.set("to", new Date(filter.to + "T23:59:59").toISOString());
    const qs = q.toString();
    try {
      // Gallery + KPI dùng CÙNG bộ lọc → luôn khớp phạm vi dữ liệu.
      const [g, s] = await Promise.all([
        apiFetch<Group[]>(`/api/before-after?${qs}`),
        apiFetch<Summary>(`/api/session-reviews/summary?${qs}`),
      ]);
      setGroups(g);
      setSummary(s);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => {
    apiFetch<Opt[]>("/api/services").then(setServices).catch(() => {});
    apiFetch<Opt[]>("/api/customers").then(setCustomers).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Before / After & Đánh giá" description="Thư viện ảnh trước–sau theo buổi (lọc & so sánh) và tổng hợp đánh giá kỹ thuật viên."
        action={canWrite && <Link href="/treatment-plans"><Button variant="outline"><Plus className="h-4 w-4" /> Thêm ảnh (ghi buổi)</Button></Link>} />

      {/* Tổng hợp đánh giá */}
      {summary && summary.totalReviews > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Số đánh giá</div><div className="mt-1 text-2xl font-semibold">{summary.totalReviews}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Hài lòng TB</div><div className="mt-1 flex items-center gap-1 text-2xl font-semibold">{summary.avgSatisfaction ?? "—"}<Star className="h-4 w-4 fill-amber-400 text-amber-400" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Điểm KTV TB</div><div className="mt-1 flex items-center gap-1 text-2xl font-semibold">{summary.avgTechnician ?? "—"}<Star className="h-4 w-4 fill-amber-400 text-amber-400" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tỷ lệ sẽ quay lại</div><div className="mt-1 text-2xl font-semibold">{summary.wouldReturnRate != null ? summary.wouldReturnRate + "%" : "—"}</div></CardContent></Card>
        </div>
      )}
      {summary && summary.technicians.length > 0 && (
        <Card className="mb-4"><CardContent className="p-4">
          <div className="mb-2 text-sm font-medium">Đánh giá theo kỹ thuật viên</div>
          <div className="flex flex-wrap gap-2">
            {summary.technicians.map((t) => (
              <div key={t.technicianName} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                <span className="font-medium">{t.technicianName}</span>
                <span className="flex items-center gap-0.5 text-amber-500">{t.avgTechnicianScore ?? "—"}<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span>
                <span className="text-xs text-muted-foreground">({t.count})</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Bộ lọc */}
      <Card className="mb-4"><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
        <div className="space-y-1"><Label className="text-xs">Khách hàng</Label><Select value={filter.customerId} onChange={(e) => setFilter({ ...filter, customerId: e.target.value })}><option value="">Tất cả</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}</Select></div>
        <div className="space-y-1"><Label className="text-xs">Dịch vụ</Label><Select value={filter.serviceId} onChange={(e) => setFilter({ ...filter, serviceId: e.target.value })}><option value="">Tất cả</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        <div className="space-y-1"><Label className="text-xs">Từ ngày</Label><Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Đến ngày</Label><Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
      </CardContent></Card>

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : groups.length === 0 ? (
        <p className="rounded border p-6 text-center text-muted-foreground">Chưa có ảnh Before/After. Tải ảnh khi ghi nhận buổi (mục Báo cáo trước/sau).</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.sessionId}><CardContent className="p-3">
              <div className="mb-2 text-sm">
                <Link href={`/customers/${g.customerId}`} className="font-medium hover:underline">{g.customerName}</Link>
                <span className="text-muted-foreground"> · Buổi {g.sessionNumber}{g.sessionName ? " · " + g.sessionName : ""}</span>
                <div className="text-xs text-muted-foreground">{[g.serviceName, g.technicianName && `KTV: ${g.technicianName}`, g.performedAt && formatDate(g.performedAt)].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-center text-xs font-medium text-muted-foreground">TRƯỚC</div>
                  <div className="grid grid-cols-2 gap-1">
                    {g.before.length === 0 ? <div className="col-span-2 rounded bg-muted/50 py-6 text-center text-xs text-muted-foreground">—</div> :
                      g.before.map((m) => <img key={m.id} src={`/api/media/${m.id}`} alt={m.filename} className="aspect-square w-full cursor-zoom-in rounded object-cover" onClick={() => setZoom({ src: `/api/media/${m.id}`, label: `${g.customerName} · Trước` })} />)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-center text-xs font-medium text-emerald-600">SAU</div>
                  <div className="grid grid-cols-2 gap-1">
                    {g.after.length === 0 ? <div className="col-span-2 rounded bg-muted/50 py-6 text-center text-xs text-muted-foreground">—</div> :
                      g.after.map((m) => <img key={m.id} src={`/api/media/${m.id}`} alt={m.filename} className="aspect-square w-full cursor-zoom-in rounded object-cover" onClick={() => setZoom({ src: `/api/media/${m.id}`, label: `${g.customerName} · Sau` })} />)}
                  </div>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.src} alt={zoom.label} className="max-h-[80vh] w-auto rounded-lg" />
            <div className="mt-2 text-center text-sm text-white">{zoom.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}
