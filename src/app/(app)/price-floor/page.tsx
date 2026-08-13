"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  serviceId: string; serviceCode: string; serviceName: string; category?: string | null;
  standardPrice: number; hasFloor: boolean; totalCost: number; floorPrice: number; belowFloor: boolean;
  laborCost: number; operationCost: number; depreciationCost: number; materialCost: number; roomCost: number; otherCost: number; minMarginPercent: number; note?: string | null;
}

const COMPONENTS: [keyof Row, string][] = [
  ["laborCost", "Nhân sự (KTV/master)"], ["operationCost", "Vận hành"], ["depreciationCost", "Khấu hao thiết bị"],
  ["materialCost", "Vật tư"], ["roomCost", "Phòng/giường"], ["otherCost", "Khác"],
];

export default function PriceFloorPage() {
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);

  async function load() {
    setLoading(true); setForbidden(false);
    try { setRows(await apiFetch<Row[]>("/api/price-floors")); }
    catch (e) { if (e instanceof Error && e.message.includes("quyền")) setForbidden(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (forbidden) return (
    <div>
      <PageHeader title="Giá sàn" description="Cấu trúc chi phí & giá sàn theo dịch vụ." />
      <p className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">Bạn không có quyền xem chi phí/giá sàn (cần quyền tài chính).</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Giá sàn" description="Khai báo chi phí cấu thành mỗi dịch vụ → hệ thống tính giá sàn. Bán dưới sàn cần người có quyền duyệt." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Dịch vụ</TH><TH className="text-right">Tổng chi phí</TH><TH className="text-right">Biên tối thiểu</TH><TH className="text-right">Giá sàn</TH><TH className="text-right">Giá chuẩn</TH><TH></TH>{canWrite && <TH></TH>}</TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có dịch vụ</TD></TR>
              ) : rows.map((r) => (
                <TR key={r.serviceId}>
                  <TD><div className="font-medium">{r.serviceName}</div><div className="text-xs text-muted-foreground">{r.serviceCode}{r.category ? " · " + r.category : ""}</div></TD>
                  <TD className="text-right">{r.hasFloor ? formatCurrency(r.totalCost) : <span className="text-muted-foreground">chưa khai báo</span>}</TD>
                  <TD className="text-right">{r.hasFloor ? `${r.minMarginPercent}%` : "—"}</TD>
                  <TD className="text-right font-medium">{r.hasFloor ? formatCurrency(r.floorPrice) : "—"}</TD>
                  <TD className="text-right">{formatCurrency(r.standardPrice)}</TD>
                  <TD>{r.hasFloor && r.belowFloor && <Badge tone="danger">Giá chuẩn dưới sàn</Badge>}</TD>
                  {canWrite && <TD><Button size="sm" variant="outline" onClick={() => setEdit(r)}>{r.hasFloor ? "Sửa" : "Khai báo"}</Button></TD>}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {edit && <FloorModal row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function FloorModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({
    laborCost: row.laborCost || "", operationCost: row.operationCost || "", depreciationCost: row.depreciationCost || "",
    materialCost: row.materialCost || "", roomCost: row.roomCost || "", otherCost: row.otherCost || "",
    minMarginPercent: row.minMarginPercent || "", note: row.note ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalCost = COMPONENTS.reduce((s, [k]) => s + Number(f[k] || 0), 0);
  const floorPrice = Math.round(totalCost * (1 + Number(f.minMarginPercent || 0) / 100));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const body: any = { serviceId: row.serviceId, note: f.note || null };
    COMPONENTS.forEach(([k]) => { body[k] = Number(f[k] || 0); });
    body.minMarginPercent = Number(f.minMarginPercent || 0);
    try { await apiFetch("/api/price-floors", { method: "POST", body: JSON.stringify(body) }); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Chi phí & giá sàn — ${row.serviceName}`}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {COMPONENTS.map(([k, label]) => (
            <div key={k} className="space-y-1.5"><Label>{label}</Label><Input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder="0" /></div>
          ))}
        </div>
        <div className="space-y-1.5"><Label>Biên lợi nhuận tối thiểu (%)</Label><Input type="number" value={f.minMarginPercent} onChange={(e) => setF({ ...f, minMarginPercent: e.target.value })} placeholder="0" /></div>
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Tổng chi phí</span><span className="font-medium">{formatCurrency(totalCost)}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Giá sàn (chi phí × (1 + biên))</span><span className="font-semibold text-primary">{formatCurrency(floorPrice)}</span></div>
          <div className="mt-1 flex justify-between text-xs"><span className="text-muted-foreground">Giá chuẩn hiện tại</span><span className={row.standardPrice < floorPrice ? "font-medium text-destructive" : ""}>{formatCurrency(row.standardPrice)}{row.standardPrice < floorPrice ? " (dưới sàn!)" : ""}</span></div>
        </div>
        <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving}><Save className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu"}</Button></div>
      </form>
    </Modal>
  );
}
