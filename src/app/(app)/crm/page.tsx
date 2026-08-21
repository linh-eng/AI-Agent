"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  UserPlus,
  HeartPulse,
  AlertTriangle,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";

interface Dash {
  bookingsToday: number;
  bookingsUpcoming: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  newCustomers: number;
  activePlans: number;
  overdueTasks: number;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  revenueSeries: { month: string; value: number }[] | null;
  canSeeFinance: boolean;
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="truncate text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CrmDashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Dash>("/api/clinic/dashboard")
      .then(setD)
      .finally(() => setLoading(false));
  }, []);

  const maxRev = d?.revenueSeries ? Math.max(1, ...d.revenueSeries.map((s) => s.value)) : 1;

  return (
    <div>
      <PageHeader
        title="Tổng quan Spa"
        description="Chỉ số hoạt động: booking, khách hàng, phác đồ, doanh thu — chi phí — lợi nhuận."
      />
      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : !d ? (
        <p className="text-destructive">Không tải được dữ liệu.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat icon={CalendarDays} label="Booking hôm nay" value={formatNumber(d.bookingsToday)} />
            <Stat icon={CalendarDays} label="Booking sắp tới" value={formatNumber(d.bookingsUpcoming)} tone="default" />
            <Stat icon={CheckCircle2} label="Hoàn thành (tháng)" value={formatNumber(d.bookingsCompleted)} tone="success" />
            <Stat icon={XCircle} label="Hủy / No-show (tháng)" value={formatNumber(d.bookingsCancelled)} tone="danger" />
            <Stat icon={UserPlus} label="Khách mới (tháng)" value={formatNumber(d.newCustomers)} tone="success" />
            <Stat icon={HeartPulse} label="Phác đồ đang chạy" value={formatNumber(d.activePlans)} />
            <Stat icon={AlertTriangle} label="Công việc quá hạn" value={formatNumber(d.overdueTasks)} tone="warning" />
          </div>

          {/* DOANH THU / Chi phí / Lợi nhuận là dữ liệu tài chính (mục 15): chỉ render khi
              finance.read. Backend đã redact (revenue=null) nên UI không có giá trị thật để lộ. */}
          {d.canSeeFinance && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Stat icon={Wallet} label="Tiền thực thu (tháng)" value={formatNumber(d.revenue ?? 0) + " ₫"} tone="success" />
              <Stat icon={TrendingUp} label="Chi phí (tháng)" value={formatNumber(d.cost ?? 0) + " ₫"} tone="warning" />
              <Stat
                icon={TrendingUp}
                label="Lợi nhuận (tháng)"
                value={formatNumber(d.profit ?? 0) + " ₫"}
                tone={(d.profit ?? 0) >= 0 ? "success" : "danger"}
              />
            </div>
          )}

          {d.canSeeFinance && d.revenueSeries && (
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
                Tiền thực thu 6 tháng gần nhất
              </h3>
              <div className="flex h-48 items-end gap-3">
                {d.revenueSeries.map((s) => (
                  <div key={s.month} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{ height: `${Math.max(4, (s.value / maxRev) * 100)}%` }}
                        title={formatNumber(s.value) + " ₫"}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{s.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      )}
    </div>
  );
}
