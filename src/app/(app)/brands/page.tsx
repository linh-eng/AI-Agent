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
  name: string;
  note?: string | null;
}

export default function BrandsPage() {
  const canWrite = useCan(PERMISSIONS.PRODUCT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/brands"));
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
      await apiFetch("/api/brands", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ name: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Thương hiệu"
        description="Danh sách thương hiệu — dùng để chọn khi khai báo sản phẩm (Dermalogica, DMK, Klapp…)."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm thương hiệu
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Tên thương hiệu</TH>
                <TH>Ghi chú</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={2} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={2} className="py-8 text-center text-muted-foreground">Chưa có thương hiệu</TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.name}</TD>
                    <TD className="text-muted-foreground">{r.note ?? "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm thương hiệu">
        <form onSubmit={create} onKeyDown={focusNextOnEnter} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tên thương hiệu *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
