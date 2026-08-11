"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Boxes,
  AlertTriangle,
  CalendarClock,
  TrendingDown,
  PackagePlus,
  PackageMinus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { ISSUE_TYPE_LABEL } from "@/lib/labels";

interface Stats {
  productCount: number;
  totalOnHand: number;
  totalValue: number;
  expiredCount: number;
  nearExpiryCount: number;
  lowStockCount: number;
  receiptsThisMonth: number;
  issuesThisMonth: number;
}
interface Recent {
  id: string;
  code: string;
  supplier?: { name: string };
  issueType?: string;
  customerName?: string | null;
  receivedAt?: string | null;
  issuedAt?: string | null;
  _count: { items: number };
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: any;
  tone?: "default" | "warning" | "danger" | "success";
  hint?: string;
}) {
  const toneCls: Record<string, string> = {
    default: "text-primary bg-primary/10",
    warning: "text-amber-600 bg-amber-100",
    danger: "text-red-600 bg-red-100",
    success: "text-emerald-600 bg-emerald-100",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneCls[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<{
    stats: Stats;
    recentReceipts: Recent[];
    recentIssues: Recent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any>("/api/dashboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Bảng điều khiển" description="Tổng quan kho Sophia Wellness" />
        <p className="text-muted-foreground">Đang tải…</p>
      </div>
    );
  }

  const s = data.stats;
  return (
    <div>
      <PageHeader title="Bảng điều khiển" description="Tổng quan kho Sophia Wellness" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sản phẩm đang bán" value={formatNumber(s.productCount)} icon={Package} />
        <StatCard
          label="Tổng tồn (đơn vị)"
          value={formatNumber(s.totalOnHand)}
          icon={Boxes}
          hint={`Giá trị ~ ${formatNumber(Math.round(s.totalValue))} đ`}
        />
        <StatCard
          label="Sắp hết hạn"
          value={formatNumber(s.nearExpiryCount)}
          icon={CalendarClock}
          tone={s.nearExpiryCount ? "warning" : "success"}
        />
        <StatCard
          label="Đã hết hạn"
          value={formatNumber(s.expiredCount)}
          icon={AlertTriangle}
          tone={s.expiredCount ? "danger" : "success"}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dưới định mức tồn"
          value={formatNumber(s.lowStockCount)}
          icon={TrendingDown}
          tone={s.lowStockCount ? "warning" : "success"}
        />
        <StatCard label="Phiếu nhập tháng này" value={formatNumber(s.receiptsThisMonth)} icon={PackagePlus} />
        <StatCard label="Phiếu xuất tháng này" value={formatNumber(s.issuesThisMonth)} icon={PackageMinus} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Phiếu nhập gần đây</h3>
              <Link href="/inbound" className="text-sm text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            {data.recentReceipts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có phiếu nhập</p>
            ) : (
              <ul className="divide-y">
                {data.recentReceipts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <Link href={`/inbound/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.supplier?.name}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatDate(r.receivedAt)}</div>
                      <div>{r._count.items} mặt hàng</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Phiếu xuất gần đây</h3>
              <Link href="/outbound" className="text-sm text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            {data.recentIssues.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có phiếu xuất</p>
            ) : (
              <ul className="divide-y">
                {data.recentIssues.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <Link href={`/outbound/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        <Badge tone="muted">{ISSUE_TYPE_LABEL[r.issueType ?? ""] ?? r.issueType}</Badge>{" "}
                        {r.customerName}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatDate(r.issuedAt)}</div>
                      <div>{r._count.items} dòng</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
