"use client";
import { useEffect, useState } from "react";
import { Search, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { SERIAL_STATUS_LABEL, SERIAL_STATUS_TONE } from "@/lib/labels";
import { SerialTrace } from "@/components/serial-trace";

interface Row {
  id: string;
  serialNumber: string;
  status: string;
  product: { sku: string; name: string; trackingMode: string };
  warehouse: { code: string; name: string; countsAsAvailable: boolean };
  supplier?: { code: string; name: string } | null;
  project?: { code: string; name: string } | null;
  createdAt: string;
}
interface WhOpt { id: string; code: string; name: string }

export default function SerialsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<WhOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (status) params.set("status", status);
      setRows(await apiFetch<Row[]>(`/api/serials?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    apiFetch<WhOpt[]>("/api/warehouses").then(setWarehouses).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, warehouseId, status]);

  return (
    <div>
      <PageHeader
        title="Serial"
        description="Danh sách serial theo kho. Bấm một serial để xem truy vết hai chiều (linh kiện & máy cha)."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Tìm serial / SKU / tên hàng..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="sm:w-52" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Tất cả kho</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </Select>
          <Select className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(SERIAL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Serial</TH>
                <TH>Sản phẩm</TH>
                <TH>Kho</TH>
                <TH>NCC</TH>
                <TH>Dự án</TH>
                <TH>Trạng thái</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Không có serial</TD></TR>
              ) : (
                rows.map((s) => (
                  <TR key={s.id} className="cursor-pointer" onClick={() => setSelected(s.id)}>
                    <TD className="font-mono font-medium">{s.serialNumber}</TD>
                    <TD>
                      <div>{s.product.name}</div>
                      <div className="text-xs text-muted-foreground">{s.product.sku}</div>
                    </TD>
                    <TD>
                      <span className="font-mono">{s.warehouse.code}</span>
                      {!s.warehouse.countsAsAvailable && <Badge tone="danger" className="ml-1">Không KD</Badge>}
                    </TD>
                    <TD>{s.supplier?.name ?? "—"}</TD>
                    <TD>{s.project?.code ?? "—"}</TD>
                    <TD><Badge tone={SERIAL_STATUS_TONE[s.status]}>{SERIAL_STATUS_LABEL[s.status]}</Badge></TD>
                    <TD><GitBranch className="h-4 w-4 text-muted-foreground" /></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Truy vết serial" className="max-w-3xl">
        {selected && <SerialTrace serialId={selected} />}
      </Modal>
    </div>
  );
}
