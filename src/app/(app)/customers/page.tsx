"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { GENDER_LABEL } from "@/lib/clinic-labels";

interface Row {
  id: string;
  code: string;
  fullName: string;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  group?: string | null;
  assignedTo?: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const canWrite = useCan(PERMISSIONS.CUSTOMER_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    gender: "",
    phone: "",
    email: "",
    dob: "",
    source: "",
    group: "",
    assignedTo: "",
    address: "",
    goals: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.gender) delete payload.gender;
      if (!form.dob) delete payload.dob;
      await apiFetch("/api/customers", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setForm({ fullName: "", gender: "", phone: "", email: "", dob: "", source: "", group: "", assignedTo: "", address: "", goals: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Khách hàng"
        description="Hồ sơ khách hàng — mọi dữ liệu (booking, phác đồ, CSKH, thanh toán) liên kết về đây."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm khách hàng
            </Button>
          )
        }
      />

      <div className="mb-4 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Tìm theo tên, mã, SĐT, email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button variant="outline" onClick={load}>
          Tìm
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Họ tên</TH>
                <TH>Giới tính</TH>
                <TH>Điện thoại</TH>
                <TH>Nguồn</TH>
                <TH>Phụ trách</TH>
                <TH>Ngày tạo</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có khách hàng</TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">
                      <Link href={`/customers/${r.id}`} className="text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>
                      <Link href={`/customers/${r.id}`} className="font-medium hover:underline">
                        {r.fullName}
                      </Link>
                    </TD>
                    <TD>{r.gender ? GENDER_LABEL[r.gender] : "—"}</TD>
                    <TD>{r.phone ?? "—"}</TD>
                    <TD>{r.source ? <Badge tone="muted">{r.source}</Badge> : "—"}</TD>
                    <TD>{r.assignedTo ?? "—"}</TD>
                    <TD>{formatDate(r.createdAt)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm khách hàng">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Họ tên *</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Giới tính</Label>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="FEMALE">Nữ</option>
                <option value="MALE">Nam</option>
                <option value="OTHER">Khác</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày sinh</Label>
              <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nguồn khách</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Facebook, giới thiệu..." />
            </div>
            <div className="space-y-1.5">
              <Label>Nhóm khách</Label>
              <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="VIP, Thường..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nhân viên phụ trách</Label>
            <Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Địa chỉ</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Mong muốn / mục tiêu</Label>
            <Input value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} />
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
