"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Wrench, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { computeDepreciation } from "@/lib/depreciation";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { ASSET_STATUS_LABEL, ASSET_STATUS_TONE, MAINTENANCE_TYPE_LABEL, MAINTENANCE_TYPE_TONE } from "@/lib/labels";

interface Maint {
  id: string;
  type: string;
  description: string;
  cost?: number | null;
  vendor?: string | null;
  performedAt: string;
  note?: string | null;
  createdBy: { name: string };
}
interface Asset {
  id: string;
  code: string;
  product: { sku: string; name: string };
  serialNumber?: string | null;
  status: string;
  location?: string | null;
  warehouse?: { name: string } | null;
  supplier?: { name: string } | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  note?: string | null;
  cost?: number | null;
  salvageValue?: number | null;
  depreciationStart?: string | null;
  depreciationMonths?: number | null;
  depreciationMethod?: "STRAIGHT_LINE" | "DECLINING" | null;
  warrantyVendor?: string | null;
  warrantyMonths?: number | null;
  maintenanceCycleMonths?: number | null;
  maintenance: Maint[];
}

function daysBetween(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}
const DEP_METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "Đường thẳng",
  DECLINING: "Số dư giảm dần",
};

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const canWrite = useCan(PERMISSIONS.ASSET_WRITE);
  const [data, setData] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "MAINTENANCE", description: "", cost: "", vendor: "", performedAt: "", note: "" });

  async function load() {
    setData(await apiFetch<Asset>(`/api/assets/${params.id}`));
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/assets/${params.id}/maintenance`, {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          description: form.description,
          cost: form.cost ? Number(form.cost) : null,
          vendor: form.vendor || null,
          performedAt: form.performedAt,
          note: form.note || null,
        }),
      });
      setOpen(false);
      setForm({ type: "MAINTENANCE", description: "", cost: "", vendor: "", performedAt: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy tài sản.</p>;

  return (
    <div>
      <PageHeader
        title={`${data.code} — ${data.product.name}`}
        description={`Serial: ${data.serialNumber ?? "—"}`}
        action={
          <div className="flex gap-2">
            {canWrite && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Ghi bảo trì
              </Button>
            )}
            <Link href="/assets">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Trạng thái</div>
            <Badge tone={ASSET_STATUS_TONE[data.status] ?? "muted"}>{ASSET_STATUS_LABEL[data.status] ?? data.status}</Badge>
          </div>
          <Info label="Vị trí" value={data.location ?? data.warehouse?.name ?? "—"} />
          <Info label="Nhà cung cấp" value={data.supplier?.name ?? "—"} />
          <Info label="Ngày mua" value={data.purchaseDate ? formatDate(data.purchaseDate) : "—"} />
          <Info label="Bảo hành đến" value={data.warrantyUntil ? formatDate(data.warrantyUntil) : "—"} />
          {data.note && <Info label="Ghi chú" value={data.note} />}
        </CardContent>
      </Card>

      {/* (a) Khấu hao */}
      {(() => {
        if (!data.cost || !data.depreciationMonths || !data.depreciationStart) {
          return canWrite ? (
            <Card className="mb-4">
              <CardContent className="p-5 text-sm text-muted-foreground">
                Chưa cấu hình khấu hao. Bấm <b>Sửa</b> ở trang danh sách tài sản để nhập nguyên giá, ngày bắt
                đầu và thời gian khấu hao.
              </CardContent>
            </Card>
          ) : null;
        }
        const dep = computeDepreciation({
          cost: data.cost,
          salvage: data.salvageValue ?? 0,
          months: data.depreciationMonths,
          start: new Date(data.depreciationStart),
          method: data.depreciationMethod ?? "STRAIGHT_LINE",
        });
        if (!dep) return null;
        return (
          <>
            <div className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Khấu hao tài sản</h3>
              <Badge tone="muted">{DEP_METHOD_LABEL[data.depreciationMethod ?? "STRAIGHT_LINE"]}</Badge>
            </div>
            <Card className="mb-4">
              <CardContent className="p-5">
                <div className="grid gap-4 text-sm sm:grid-cols-4">
                  <Info label="Nguyên giá" value={`${formatNumber(data.cost)} đ`} />
                  <Info label="Bắt đầu khấu hao" value={formatDate(data.depreciationStart)} />
                  <Info label="Thời gian" value={`${data.depreciationMonths} tháng`} />
                  <Info label="Khấu hao / tháng" value={`${formatNumber(dep.monthly)} đ`} />
                  <Info label="Đã khấu hao (lũy kế)" value={`${formatNumber(dep.accumulated)} đ`} />
                  <Info label="Giá trị còn lại" value={`${formatNumber(dep.remaining)} đ`} />
                  <Info label="Khấu hao xong" value={formatDate(dep.endDate.toISOString())} />
                  <div>
                    <div className="text-xs text-muted-foreground">Tiến độ ({dep.percent}%)</div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${dep.percent}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Năm</TH>
                        <TH className="text-right">Khấu hao trong năm</TH>
                        <TH className="text-right">Lũy kế cuối năm</TH>
                        <TH className="text-right">Còn lại cuối năm</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {dep.yearly.map((y) => (
                        <TR key={y.year}>
                          <TD className="font-medium">{y.year}</TD>
                          <TD className="text-right">{formatNumber(y.depreciation)} đ</TD>
                          <TD className="text-right">{formatNumber(y.accumulated)} đ</TD>
                          <TD className="text-right">{formatNumber(y.remaining)} đ</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* (b) Bảo hành & bảo trì định kỳ */}
      {(() => {
        const wDays = daysBetween(data.warrantyUntil);
        const lastMaint = data.maintenance[0]?.performedAt ?? null; // maintenance sắp xếp desc
        const baseForNext = lastMaint ?? data.purchaseDate ?? null;
        const nextMaint =
          data.maintenanceCycleMonths && baseForNext ? addMonths(baseForNext, data.maintenanceCycleMonths) : null;
        const nDays = daysBetween(nextMaint);
        return (
          <Card className="mb-4">
            <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
              <Info label="Hãng / đơn vị bảo hành" value={data.warrantyVendor ?? "—"} />
              <div>
                <div className="text-xs text-muted-foreground">Bảo hành đến</div>
                <div className="font-medium">
                  {data.warrantyUntil ? formatDate(data.warrantyUntil) : "—"}
                  {wDays != null &&
                    (wDays < 0 ? (
                      <Badge tone="danger" className="ml-2">Hết BH</Badge>
                    ) : wDays <= 60 ? (
                      <Badge tone="warning" className="ml-2">Còn {wDays} ngày</Badge>
                    ) : null)}
                </div>
              </div>
              <Info
                label="Chu kỳ bảo trì"
                value={data.maintenanceCycleMonths ? `${data.maintenanceCycleMonths} tháng` : "—"}
              />
              <Info label="Bảo trì gần nhất" value={lastMaint ? formatDate(lastMaint) : "—"} />
              <div>
                <div className="text-xs text-muted-foreground">Bảo trì kế tiếp</div>
                <div className="font-medium">
                  {nextMaint ? formatDate(nextMaint) : "—"}
                  {nDays != null &&
                    (nDays < 0 ? (
                      <Badge tone="danger" className="ml-2">Quá hạn {Math.abs(nDays)} ngày</Badge>
                    ) : nDays <= 14 ? (
                      <Badge tone="warning" className="ml-2">Còn {nDays} ngày</Badge>
                    ) : null)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="mb-2 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Lịch sử bảo trì / sửa chữa</h3>
        <Badge tone="muted">{data.maintenance.length}</Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Ngày</TH>
                <TH>Loại</TH>
                <TH>Nội dung</TH>
                <TH>Đơn vị</TH>
                <TH className="text-right">Chi phí</TH>
                <TH>Người ghi</TH>
              </TR>
            </THead>
            <TBody>
              {data.maintenance.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có bản ghi bảo trì</TD>
                </TR>
              ) : (
                data.maintenance.map((m) => (
                  <TR key={m.id}>
                    <TD>{formatDate(m.performedAt)}</TD>
                    <TD>
                      <Badge tone={MAINTENANCE_TYPE_TONE[m.type] ?? "default"}>
                        {MAINTENANCE_TYPE_LABEL[m.type] ?? m.type}
                      </Badge>
                    </TD>
                    <TD>
                      <div>{m.description}</div>
                      {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                    </TD>
                    <TD className="text-muted-foreground">{m.vendor ?? "—"}</TD>
                    <TD className="text-right">{m.cost != null ? `${formatNumber(m.cost)} đ` : "—"}</TD>
                    <TD className="text-muted-foreground">{m.createdBy.name}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Ghi nhận bảo trì / sửa chữa">
        <form onSubmit={addLog} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại *</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="MAINTENANCE">Bảo trì định kỳ</option>
                <option value="REPAIR">Sửa chữa</option>
                <option value="INSPECTION">Kiểm tra</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày thực hiện *</Label>
              <Input type="date" value={form.performedAt} onChange={(e) => setForm({ ...form, performedAt: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nội dung *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đơn vị / kỹ thuật</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Chi phí (đ)</Label>
              <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
