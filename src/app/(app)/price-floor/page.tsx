"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FLOOR_VERSION_STATUS_LABEL, FLOOR_VERSION_STATUS_TONE } from "@/lib/clinic-labels";

interface Row {
  serviceId: string; serviceCode: string; serviceName: string; category?: string | null;
  standardPrice: number; hasFloor: boolean; floorPrice: number; version: number | null; versionStatus: string | null;
  effectiveFrom?: string | null; maxDiscount: number; maxDiscountPercent: number; belowFloor: boolean;
  totalCost: number | null; minMarginPercent: number | null; draftVersion: number | null;
}

const STATUS_FILTER = ["ACTIVE", "PENDING_APPROVAL", "APPROVED", "DRAFT", "EXPIRED", "CANCELLED"];

export default function PriceFloorPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [effective, setEffective] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setForbidden(false);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (categoryId) p.set("categoryId", categoryId);
    if (status) p.set("status", status);
    if (effective) p.set("effective", "1");
    try { setRows(await apiFetch<Row[]>(`/api/price-floors?${p}`)); }
    catch (e) { if (e instanceof Error && e.message.includes("quyền")) setForbidden(true); }
    finally { setLoading(false); }
  }, [q, categoryId, status, effective]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<any[]>("/api/service-categories").then((r) => setCats(r.map((c) => ({ id: c.id, name: c.name })))).catch(() => {}); }, []);

  if (forbidden) return (
    <div>
      <PageHeader title="Giá sàn" description="Cấu trúc chi phí & giá sàn theo dịch vụ." />
      <p className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">Bạn không có quyền xem giá sàn.</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Giá sàn" description="Chi phí cấu thành → tổng giá vốn → giá sàn (theo biên) → chiết khấu tối đa. Mỗi thay đổi tạo version mới, bán dưới sàn cần duyệt." />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Tìm mã / tên dịch vụ..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-44" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Tất cả nhóm</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Mọi trạng thái version</option>{STATUS_FILTER.map((s) => <option key={s} value={s}>{FLOOR_VERSION_STATUS_LABEL[s] ?? s}</option>)}</Select>
          <Select className="w-40" value={effective} onChange={(e) => setEffective(e.target.value)}><option value="">Tất cả</option><option value="1">Có giá sàn hiệu lực</option></Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Dịch vụ</TH><TH>Nhóm</TH><TH className="text-right">Giá chuẩn</TH><TH className="text-right">Tổng giá vốn</TH>
                  <TH className="text-right">Giá sàn</TH><TH className="text-right">Biên tối thiểu</TH><TH className="text-right">Chiết khấu tối đa</TH>
                  <TH className="text-center">Version</TH><TH>Hiệu lực từ</TH><TH>Trạng thái</TH>
                </TR>
              </THead>
              <TBody>
                {loading ? (
                  <TR><TD colSpan={10} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                ) : rows.length === 0 ? (
                  <TR><TD colSpan={10} className="py-8 text-center text-muted-foreground">Không có dịch vụ</TD></TR>
                ) : rows.map((r) => (
                  <TR key={r.serviceId} className="cursor-pointer hover:bg-muted/40">
                    <TD><Link href={`/price-floor/${r.serviceId}`} className="block"><div className="font-medium text-primary">{r.serviceName}</div><div className="text-xs text-muted-foreground">{r.serviceCode}</div></Link></TD>
                    <TD className="text-muted-foreground">{r.category ?? "—"}</TD>
                    <TD className="text-right">{formatCurrency(r.standardPrice)}</TD>
                    <TD className="text-right">{r.totalCost != null ? formatCurrency(r.totalCost) : r.hasFloor ? <span className="text-muted-foreground">•••</span> : "—"}</TD>
                    <TD className="text-right font-medium">{r.hasFloor ? formatCurrency(r.floorPrice) : "—"}</TD>
                    <TD className="text-right">{r.minMarginPercent != null ? `${r.minMarginPercent}%` : r.hasFloor ? "•••" : "—"}</TD>
                    <TD className="text-right">{r.hasFloor ? <span>{formatCurrency(r.maxDiscount)}<span className="ml-1 text-xs text-muted-foreground">({r.maxDiscountPercent}%)</span></span> : "—"}</TD>
                    <TD className="text-center">{r.version != null ? `V${r.version}` : r.versionStatus === "V1 (cũ)" ? "V1*" : r.draftVersion ? <span className="text-muted-foreground">nháp V{r.draftVersion}</span> : "—"}</TD>
                    <TD className="text-muted-foreground">{r.effectiveFrom ? formatDate(r.effectiveFrom) : "—"}</TD>
                    <TD>
                      {r.belowFloor && <Badge tone="danger">Giá chuẩn dưới sàn</Badge>}
                      {!r.belowFloor && r.versionStatus && <Badge tone={FLOOR_VERSION_STATUS_TONE[r.versionStatus] ?? "muted"}>{FLOOR_VERSION_STATUS_LABEL[r.versionStatus] ?? r.versionStatus}</Badge>}
                      {!r.hasFloor && <span className="text-xs text-muted-foreground">Chưa thiết lập</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
