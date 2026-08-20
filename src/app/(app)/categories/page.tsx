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
  code: string;
  name: string;
  note?: string | null;
  openMaxMonths?: number | null;
  storeWarnMonths?: number | null;
  _count: { products: number };
}

const EMPTY = { code: "", name: "", note: "", openMaxMonths: "", storeWarnMonths: "" };

export default function CategoriesPage() {
  const canWrite = useCan(PERMISSIONS.CATEGORY_WRITE);
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
      setRows(await apiFetch<Row[]>("/api/categories"));
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
    setForm({
      code: r.code,
      name: r.name,
      note: r.note ?? "",
      openMaxMonths: r.openMaxMonths != null ? String(r.openMaxMonths) : "",
      storeWarnMonths: r.storeWarnMonths != null ? String(r.storeWarnMonths) : "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      note: form.note || null,
      openMaxMonths: form.openMaxMonths ? Number(form.openMaxMonths) : null,
      storeWarnMonths: form.storeWarnMonths ? Number(form.storeWarnMonths) : null,
    };
    try {
      if (editing) {
        await apiFetch(`/api/categories/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          body: JSON.stringify({ code: form.code, ...payload }),
        });
      }
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const filtered = rows.filter((r) => normalizeSearch(`${r.code} ${r.name}`).includes(normalizeSearch(q)));

  return (
    <div>
      <PageHeader
        title="Nhóm hàng"
        description="Phân loại sản phẩm + cấu hình hạn dùng sau mở nắp (PAO) và cảnh báo tồn lâu chưa mở theo nhóm."
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm nhóm
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo mã / tên nhóm…"
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
                <TH>Mã</TH>
                <TH>Tên nhóm</TH>
                <TH className="text-right">Hạn sau mở (tháng)</TH>
                <TH className="text-right">Cảnh báo tồn chưa mở (tháng)</TH>
                <TH className="text-right">Số SP</TH>
                {canWrite && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canWrite ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={canWrite ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    {q ? "Không tìm thấy nhóm hàng phù hợp" : "Chưa có nhóm hàng"}
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">{r.code}</TD>
                    <TD>{r.name}</TD>
                    <TD className="text-right">{r.openMaxMonths != null ? `${r.openMaxMonths} tháng` : "—"}</TD>
                    <TD className="text-right">{r.storeWarnMonths != null ? `${r.storeWarnMonths} tháng` : "—"}</TD>
                    <TD className="text-right">{r._count.products}</TD>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Sửa nhóm ${editing.code}` : "Thêm nhóm hàng"}>
        <form onSubmit={save} onKeyDown={focusNextOnEnter} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã nhóm *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tên nhóm *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hạn dùng sau mở nắp (tháng)</Label>
              <Input
                type="number"
                min="1"
                placeholder="VD: Serum 6, Kem 12"
                value={form.openMaxMonths}
                onChange={(e) => setForm({ ...form, openMaxMonths: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cảnh báo tồn chưa mở (tháng)</Label>
              <Input
                type="number"
                min="1"
                placeholder="VD: 12"
                value={form.storeWarnMonths}
                onChange={(e) => setForm({ ...form, storeWarnMonths: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sau khi mở nắp: HSD thực tế = ngày mở nắp + hạn dùng sau mở (số tháng ở trên). Khi chưa mở nắp thì
            dùng HSD trên bao bì. Cảnh báo tồn chưa mở: nhắc khi sản phẩm đã mua quá số tháng này mà vẫn chưa mở nắp.
          </p>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
