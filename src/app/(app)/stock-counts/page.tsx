"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COUNT_STATUS_LABEL, COUNT_STATUS_TONE } from "@/lib/labels";

interface Warehouse { id: string; name: string }
interface Row {
  id: string;
  code: string;
  status: string;
  warehouse: { name: string };
  createdBy: { name: string };
  countedAt?: string | null;
  createdAt: string;
  _count: { items: number };
}

export default function StockCountsPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.STOCKCOUNT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ warehouseId: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/stock-counts"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Warehouse[]>("/api/warehouses").then((w) => {
      setWarehouses(w);
      if (w[0]) setForm((f) => ({ ...f, warehouseId: w[0].id }));
    });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>("/api/stock-counts", {
        method: "POST",
        body: JSON.stringify({ warehouseId: form.warehouseId, note: form.note || null }),
      });
      router.push(`/stock-counts/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Kiểm kê kho"
        description="Chốt tồn hệ thống theo lô, nhập số thực đếm; khi duyệt hệ thống tự điều chỉnh chênh lệch."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Tạo phiếu kiểm kê
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã phiếu</TH>
                <TH>Kho</TH>
                <TH>Người kiểm</TH>
                <TH className="text-center">Số lô</TH>
                <TH className="text-center">Trạng thái</TH>
                <TH>Ngày duyệt</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có phiếu kiểm kê</TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/stock-counts/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>{r.warehouse.name}</TD>
                    <TD className="text-muted-foreground">{r.createdBy.name}</TD>
                    <TD className="text-center">{r._count.items}</TD>
                    <TD className="text-center">
                      <Badge tone={COUNT_STATUS_TONE[r.status] ?? "muted"}>{COUNT_STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </TD>
                    <TD>{r.countedAt ? formatDate(r.countedAt) : "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phiếu kiểm kê">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kho kiểm kê *</Label>
            <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} required>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Phiếu sẽ chốt danh sách các lô đang có tồn của kho tại thời điểm tạo.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit">Tạo & bắt đầu kiểm</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
