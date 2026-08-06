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

interface Row {
  id: string;
  code: string;
  name: string;
  type: "SUPPLIER" | "CUSTOMER" | "BOTH";
  taxCode?: string | null;
  phone?: string | null;
  creditLimit?: string | number | null;
  isActive: boolean;
}

const TYPE_LABEL: Record<Row["type"], string> = {
  SUPPLIER: "Nhà cung cấp",
  CUSTOMER: "Khách hàng",
  BOTH: "NCC & Khách",
};

export default function PartnersPage() {
  const canWrite = useCan(PERMISSIONS.PARTNER_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "SUPPLIER",
    taxCode: "",
    phone: "",
    email: "",
    address: "",
    creditLimit: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/partners"));
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
      await apiFetch("/api/partners", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        }),
      });
      setOpen(false);
      setForm({ code: "", name: "", type: "SUPPLIER", taxCode: "", phone: "", email: "", address: "", creditLimit: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="NCC / Khách hàng"
        description="Đối tác dùng chung với Module Hỗ trợ. NCC là trường bắt buộc khi nhập kho."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm đối tác
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
                <TH>Tên</TH>
                <TH>Loại</TH>
                <TH>MST</TH>
                <TH>Điện thoại</TH>
                <TH className="text-right">Hạn mức công nợ</TH>
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
                    Chưa có đối tác
                  </TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">{r.code}</TD>
                    <TD>{r.name}</TD>
                    <TD>
                      <Badge tone={r.type === "SUPPLIER" ? "default" : r.type === "CUSTOMER" ? "success" : "warning"}>
                        {TYPE_LABEL[r.type]}
                      </Badge>
                    </TD>
                    <TD>{r.taxCode ?? "—"}</TD>
                    <TD>{r.phone ?? "—"}</TD>
                    <TD className="text-right">
                      {r.creditLimit ? formatNumber(Number(r.creditLimit)) + " ₫" : "—"}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm đối tác">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Loại *</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="SUPPLIER">Nhà cung cấp</option>
                <option value="CUSTOMER">Khách hàng</option>
                <option value="BOTH">NCC & Khách</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tên *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã số thuế</Label>
              <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Hạn mức công nợ (₫)</Label>
              <Input
                type="number"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              />
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
