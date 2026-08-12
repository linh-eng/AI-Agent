"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { focusNextOnEnter } from "@/lib/form";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  id: string;
  code: string;
  name: string;
  address?: string | null;
}

export default function WarehousesPage() {
  const canWrite = useCan(PERMISSIONS.WAREHOUSE_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", address: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/warehouses"));
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
      setForm({ code: "", name: "", address: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Kho"
        description="Danh mục kho — mỗi bản ghi tồn/nhập/xuất đều gắn với một kho."
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
                <TH>Mã kho</TH>
                <TH>Tên kho</TH>
                <TH>Địa chỉ</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={3} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={3} className="py-8 text-center text-muted-foreground">
                    Chưa có kho
                  </TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">{r.code}</TD>
                    <TD>{r.name}</TD>
                    <TD className="text-muted-foreground">{r.address ?? "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm kho">
        <form onSubmit={create} onKeyDown={focusNextOnEnter} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mã kho *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tên kho *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Địa chỉ</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
