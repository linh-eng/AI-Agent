"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

type Mode = "SERIAL" | "LOT" | "QUANTITY" | "LICENSE";
interface Row {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  trackingMode: Mode;
  uom: string;
  minStock?: number | null;
}

const MODE_LABEL: Record<Mode, string> = {
  SERIAL: "Serial",
  LOT: "Lô (Lot)",
  QUANTITY: "Số lượng",
  LICENSE: "License",
};
const MODE_TONE: Record<Mode, "default" | "success" | "warning" | "muted"> = {
  SERIAL: "default",
  LOT: "warning",
  QUANTITY: "muted",
  LICENSE: "success",
};

export default function ProductsPage() {
  const canWrite = useCan(PERMISSIONS.PRODUCT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    brand: "",
    model: "",
    category: "",
    trackingMode: "SERIAL" as Mode,
    uom: "Cái",
    barcode: "",
    minStock: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/products"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          minStock: form.minStock ? Number(form.minStock) : null,
          barcode: form.barcode || null,
        }),
      });
      setOpen(false);
      setForm({ sku: "", name: "", brand: "", model: "", category: "", trackingMode: "SERIAL", uom: "Cái", barcode: "", minStock: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description="Mỗi sản phẩm có chế độ quản lý (tracking_mode): Serial / Lô / Số lượng / License."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Tên</TH>
                <TH>Hãng / Model</TH>
                <TH>Chế độ QL</TH>
                <TH>ĐVT</TH>
                <TH className="text-right">Tồn tối thiểu</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Đang tải...
                  </TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Chưa có sản phẩm
                  </TD>
                </TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono font-medium">{p.sku}</TD>
                    <TD>{p.name}</TD>
                    <TD className="text-muted-foreground">
                      {[p.brand, p.model].filter(Boolean).join(" / ") || "—"}
                    </TD>
                    <TD>
                      <Badge tone={MODE_TONE[p.trackingMode]}>{MODE_LABEL[p.trackingMode]}</Badge>
                    </TD>
                    <TD>{p.uom}</TD>
                    <TD className="text-right">{p.minStock != null ? formatNumber(p.minStock) : "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm sản phẩm">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tên sản phẩm *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hãng</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Chế độ QL *</Label>
              <Select
                value={form.trackingMode}
                onChange={(e) => setForm({ ...form, trackingMode: e.target.value as Mode })}
              >
                <option value="SERIAL">Serial</option>
                <option value="LOT">Lô (Lot)</option>
                <option value="QUANTITY">Số lượng</option>
                <option value="LICENSE">License</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ĐVT</Label>
              <Input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tồn tối thiểu</Label>
              <Input
                type="number"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
