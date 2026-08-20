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
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  note?: string | null;
}

const EMPTY = { code: "", name: "", contactPerson: "", phone: "", email: "", address: "", taxCode: "", note: "" };

export default function SuppliersPage() {
  const canWrite = useCan(PERMISSIONS.SUPPLIER_WRITE);
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
      setRows(await apiFetch<Row[]>("/api/suppliers"));
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
      contactPerson: r.contactPerson ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
      taxCode: r.taxCode ?? "",
      note: r.note ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        const { code, ...rest } = form; // không đổi mã khi sửa
        await apiFetch(`/api/suppliers/${editing.id}`, { method: "PATCH", body: JSON.stringify(rest) });
      } else {
        await apiFetch("/api/suppliers", { method: "POST", body: JSON.stringify(form) });
      }
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const filtered = rows.filter((r) =>
    normalizeSearch(`${r.code} ${r.name} ${r.contactPerson ?? ""} ${r.phone ?? ""} ${r.taxCode ?? ""}`).includes(normalizeSearch(q)),
  );
  const cols = canWrite ? 8 : 7;

  return (
    <div>
      <PageHeader
        title="Nhà cung cấp"
        description="Danh sách nhà cung cấp — dùng khi lập phiếu nhập kho."
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm NCC
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Tìm theo mã / tên / người liên hệ / ĐT / MST…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Tên</TH>
                <TH>Người liên hệ</TH>
                <TH>Điện thoại</TH>
                <TH>Email</TH>
                <TH>Địa chỉ</TH>
                <TH>Mã số thuế</TH>
                {canWrite && <TH className="text-right">Sửa</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">
                    {q ? "Không tìm thấy nhà cung cấp phù hợp" : "Chưa có nhà cung cấp"}
                  </TD>
                </TR>
              ) : (
                filtered.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">{r.code}</TD>
                    <TD>{r.name}</TD>
                    <TD className="text-muted-foreground">{r.contactPerson ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.phone ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.email ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.address ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.taxCode ?? "—"}</TD>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Sửa NCC ${editing.code}` : "Thêm nhà cung cấp"}>
        <form onSubmit={save} onKeyDown={focusNextOnEnter} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Mã số thuế</Label>
              <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tên NCC *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Người liên hệ</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Tên người phụ trách bên NCC"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
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
