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
import { Label, Select, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COUNT_STATUS_LABEL, COUNT_STATUS_TONE } from "@/lib/labels";

export default function StockCountsPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.WAREHOUSE_WRITE);
  const [rows, setRows] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch("/api/stock-counts"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openModal() {
    setError(null);
    setWarehouses(await apiFetch("/api/warehouses"));
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await apiFetch<{ id: string }>("/api/stock-counts", {
        method: "POST",
        body: JSON.stringify({ warehouseId, note: note || null }),
      });
      setOpen(false);
      router.push(`/stock-counts/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Kiểm kê"
        description="Kiểm kê định kỳ/xoay vòng: quét thực tế, tự so lệch, trình BGĐ duyệt → sinh bút toán điều chỉnh."
        action={canWrite && <Button onClick={openModal}><Plus className="h-4 w-4" /> Tạo phiếu kiểm kê</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Số phiếu</TH><TH>Kho</TH><TH className="text-right">Dòng</TH><TH className="text-right">Thiếu</TH><TH className="text-right">Thừa</TH><TH>Trạng thái</TH><TH>Ngày</TH></TR></THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có phiếu kiểm kê</TD></TR>
              ) : rows.map((c) => (
                <TR key={c.id}>
                  <TD><Link href={`/stock-counts/${c.id}`} className="font-mono font-medium text-primary hover:underline">{c.number}</Link></TD>
                  <TD>{c.warehouse ? `${c.warehouse.code} — ${c.warehouse.name}` : "—"}</TD>
                  <TD className="text-right">{c.lineCount}</TD>
                  <TD className="text-right text-destructive">{c.missing || 0}</TD>
                  <TD className="text-right text-amber-700">{c.extra || 0}</TD>
                  <TD><Badge tone={COUNT_STATUS_TONE[c.status]}>{COUNT_STATUS_LABEL[c.status]}</Badge></TD>
                  <TD className="text-muted-foreground">{formatDate(c.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phiếu kiểm kê">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kho kiểm kê *</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">— Chọn kho —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Hệ thống sẽ chụp danh sách serial IN_STOCK hiện có trong kho làm cơ sở đối chiếu.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit">Tạo & bắt đầu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
