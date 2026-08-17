"use client";
// =============================================================================
// IA-PH2 — Workspace "Giá bán đề xuất" (toàn cục, read-only). Tổng hợp giá bán
// đề xuất theo dịch vụ (version PUBLISHED / mới nhất) + link sang trang chi tiết
// (/services/[id]/recommended-price) để tạo/phát hành.
// KHÔNG thêm entity/logic: chỉ COMPOSE/ĐỌC qua API sẵn có. targetMargin/costSnapshot
// server đã mask theo finance.read (BLOCKER). Giá đề xuất hiển thị như guardrail.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COSTING_STATUS_LABEL, COSTING_STATUS_TONE } from "@/lib/clinic-labels";

const money = (v: any) => (v == null ? "—" : formatCurrency(Number(v)));

interface Row {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  standardPrice: number | null;
  versionCount: number;
  publishedVersion: any | null;
  latestVersion: any | null;
}

export default function RecommendedPriceWorkspacePage() {
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Row[]>("/api/recommended-prices");
      setRows(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const kw = q.trim().toLowerCase();
  const filtered = kw
    ? rows.filter((r) => r.serviceName.toLowerCase().includes(kw) || r.serviceCode.toLowerCase().includes(kw))
    : rows;

  return (
    <div>
      <PageHeader
        title="Giá bán đề xuất"
        description="Tổng hợp giá bán đề xuất theo biên mục tiêu (decision-support). Bấm dịch vụ để xem/tạo/phát hành chi tiết."
      />

      {!canFinance && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bạn không có quyền xem dữ liệu tài chính (<code>finance.read</code>). Biên mục tiêu & giá vốn nền
          được ẩn; chỉ hiển thị mức giá đề xuất.
        </div>
      )}

      <div className="mb-4 max-w-sm">
        <Input placeholder="Tìm theo tên / mã dịch vụ…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Dịch vụ</th>
                  <th className="px-4 py-3 text-right">Giá chuẩn</th>
                  <th className="px-4 py-3 text-right">Giá đề xuất (phát hành)</th>
                  <th className="px-4 py-3 text-center">Version</th>
                  <th className="px-4 py-3 text-center">Trạng thái mới nhất</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Đang tải…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chưa có dịch vụ nào khai báo giá bán đề xuất.</td></tr>
                ) : (
                  filtered.map((r) => {
                    const pub = r.publishedVersion;
                    const latest = r.latestVersion;
                    return (
                      <tr key={r.serviceId} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3 font-mono text-xs">{r.serviceCode}</td>
                        <td className="px-4 py-3 font-medium">{r.serviceName}</td>
                        <td className="px-4 py-3 text-right">{money(r.standardPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          {pub ? money(pub.calculatedRecommendedPrice) : <span className="text-muted-foreground">Chưa phát hành</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pub ? `v${pub.version}` : latest ? `v${latest.version}` : "—"}
                          <span className="ml-1 text-xs text-muted-foreground">/{r.versionCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {latest ? (
                            <Badge tone={COSTING_STATUS_TONE[latest.status] as any}>{COSTING_STATUS_LABEL[latest.status] ?? latest.status}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/services/${r.serviceId}/recommended-price`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Chi tiết <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
