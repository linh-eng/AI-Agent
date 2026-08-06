"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  countsAsAvailable: boolean;
  isActive: boolean;
  _count?: { serials: number; zones: number };
}

export default function WarehousesPage() {
  const canWrite = useCan(PERMISSIONS.WAREHOUSE_WRITE);
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", countsAsAvailable: true });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<WarehouseRow[]>("/api/warehouses"));
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
      await apiFetch("/api/warehouses", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ code: "", name: "", description: "", countsAsAvailable: true });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Danh mục kho (A1)"
        description="Danh mục kho cố định. Các kho không tính tồn khả dụng: K-HH, K-BH-KH, K-BH-NCC, K-SC, K-TL."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm kho
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
                <TH>Tên kho</TH>
                <TH>Mô tả</TH>
                <TH>Tồn khả dụng</TH>
                <TH className="text-right">Serial</TH>
                <TH>Trạng thái</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                    Đang tải...
                  </TD>
                </TR>
              ) : (
                rows.map((w) => (
                  <TR key={w.id}>
                    <TD className="font-mono font-medium">{w.code}</TD>
                    <TD>{w.name}</TD>
                    <TD className="max-w-xs truncate text-muted-foreground">{w.description}</TD>
                    <TD>
                      {w.countsAsAvailable ? (
                        <Badge tone="success">Có</Badge>
                      ) : (
                        <Badge tone="danger">Không</Badge>
                      )}
                    </TD>
                    <TD className="text-right">{w._count?.serials ?? 0}</TD>
                    <TD>
                      {w.isActive ? (
                        <Badge tone="muted">Đang dùng</Badge>
                      ) : (
                        <Badge tone="warning">Ngừng</Badge>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm kho mới">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã kho *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="K-XX"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tên kho *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.countsAsAvailable}
              onChange={(e) => setForm({ ...form, countsAsAvailable: e.target.checked })}
            />
            Tính vào tồn khả dụng bán
          </label>
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
