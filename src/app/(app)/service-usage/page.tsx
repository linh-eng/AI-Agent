"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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

interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string; uom: string }
interface Service {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  items: { productId: string; quantity: number; product: Product }[];
}
interface Usage {
  id: string;
  code: string;
  sessions: number;
  customerName?: string | null;
  issueCode?: string | null;
  issueId?: string | null;
  performedAt: string;
  service: { name: string; code: string };
  warehouse: { name: string };
  performedBy: { name: string };
}

export default function ServiceUsagePage() {
  const canUse = useCan(PERMISSIONS.SERVICE_USE);
  const [rows, setRows] = useState<Usage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ serviceId: "", warehouseId: "", sessions: "1", customerName: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Usage[]>("/api/service-usages"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Service[]>("/api/services").then((s) => setServices(s.filter((x) => x.isActive))).catch(() => {});
    apiFetch<Warehouse[]>("/api/warehouses").then((w) => {
      setWarehouses(w);
      if (w[0]) setForm((f) => ({ ...f, warehouseId: w[0].id }));
    });
  }, []);

  const selected = services.find((s) => s.id === form.serviceId);
  const sessions = Number(form.sessions) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/service-usages", {
        method: "POST",
        body: JSON.stringify({
          serviceId: form.serviceId,
          warehouseId: form.warehouseId,
          sessions: Number(form.sessions),
          customerName: form.customerName || null,
          note: form.note || null,
        }),
      });
      setOpen(false);
      setForm((f) => ({ ...f, serviceId: "", sessions: "1", customerName: "", note: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Ghi nhận dịch vụ"
        description="Ghi nhận lượt thực hiện liệu trình — hệ thống tự lập phiếu xuất tiêu hao (FEFO) theo định mức."
        action={
          canUse && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Ghi nhận
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Liệu trình</TH>
                <TH>Khách</TH>
                <TH>Kho</TH>
                <TH className="text-center">Số lượt</TH>
                <TH>Phiếu xuất</TH>
                <TH>Người TH</TH>
                <TH>Thời gian</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có ghi nhận</TD>
                </TR>
              ) : (
                rows.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-mono text-xs font-medium">{u.code}</TD>
                    <TD>{u.service.name}</TD>
                    <TD>{u.customerName ?? "—"}</TD>
                    <TD className="text-muted-foreground">{u.warehouse.name}</TD>
                    <TD className="text-center">{u.sessions}</TD>
                    <TD>
                      {u.issueId ? (
                        <Link href={`/outbound/${u.issueId}`} className="font-mono text-xs text-primary hover:underline">
                          {u.issueCode}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-muted-foreground">{u.performedBy.name}</TD>
                    <TD>{formatDate(u.performedAt)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Ghi nhận thực hiện dịch vụ">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Liệu trình *</Label>
            <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required>
              <option value="">— Chọn liệu trình —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kho tiêu hao *</Label>
              <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số lượt *</Label>
              <Input
                type="number"
                min="1"
                value={form.sessions}
                onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Khách hàng</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>

          {selected && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="mb-1 font-medium">Dự kiến tiêu hao ({sessions} lượt):</div>
              {selected.items.length === 0 ? (
                <p className="text-amber-600">Liệu trình chưa khai báo định mức.</p>
              ) : (
                <ul className="space-y-0.5">
                  {selected.items.map((i) => (
                    <li key={i.productId} className="flex justify-between">
                      <span>{i.product.name}</span>
                      <span className="font-medium">
                        {formatNumber(i.quantity * sessions)} {i.product.uom}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={!selected || selected.items.length === 0}>
              Ghi nhận & trừ kho
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
