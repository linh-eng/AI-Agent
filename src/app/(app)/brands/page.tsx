"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { focusNextOnEnter } from "@/lib/form";
import { normalizeSearch } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  id: string;
  name: string;
  note?: string | null;
}

const EMPTY = { name: "", note: "" };

export default function BrandsPage() {
  const canWrite = useCan(PERMISSIONS.PRODUCT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");

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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({ name: r.name, note: r.note ?? "" });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/brands/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await apiFetch("/api/brands", { method: "POST", body: JSON.stringify(form) });
      }
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const filtered = rows.filter((r) => normalizeSearch(`${r.name} ${r.note ?? ""}`).includes(normalizeSearch(q)));
  const cols = canWrite ? 3 : 2;

  return (
    <div>
      <PageHeader
        title="Thương hiệu"
        description="Danh sách thương hiệu — dùng để chọn khi khai báo sản phẩm (Dermalogica, DMK, Klapp…)."
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm thương hiệu
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo tên thương hiệu…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Tên thương hiệu</TH>
                <TH>Ghi chú</TH>
                {canWrite && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">
                    {q ? "Không tìm thấy thương hiệu phù hợp" : "Chưa có thương hiệu"}
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.name}</TD>
                    <TD className="text-muted-foreground">{r.note ?? "—"}</TD>
                    {canWrite && (
                      <TD className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TD>
                    )}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Sửa thương hiệu" : "Thêm thương hiệu"}>
        <form onSubmit={save} onKeyDown={focusNextOnEnter} className="space-y-4">
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
