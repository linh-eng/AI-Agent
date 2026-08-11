"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
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
  maintenance: Maint[];
}

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
