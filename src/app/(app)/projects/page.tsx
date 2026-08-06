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
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Row {
  id: string;
  code: string;
  name: string;
  status: string;
  customerPo?: string | null;
  contractNo?: string | null;
  createdAt: string;
  customer?: { id: string; code: string; name: string } | null;
}
interface PartnerOpt {
  id: string;
  code: string;
  name: string;
}

export default function ProjectsPage() {
  const canWrite = useCan(PERMISSIONS.PROJECT_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<PartnerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", customerId: "", customerPo: "", contractNo: "" });

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiFetch<Row[]>("/api/projects"),
        apiFetch<PartnerOpt[]>("/api/partners?type=CUSTOMER").catch(() => []),
      ]);
      setRows(p);
      setCustomers(c);
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
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ ...form, customerId: form.customerId || null }),
      });
      setOpen(false);
      setForm({ code: "", name: "", customerId: "", customerPo: "", contractNo: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Dự án"
        description="Danh mục dự án dùng chung với Module Hỗ trợ. Hàng gắn dự án bị khóa theo mã dự án."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm dự án
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
                <TH>Tên dự án</TH>
                <TH>Khách hàng</TH>
                <TH>PO khách</TH>
                <TH>Trạng thái</TH>
                <TH>Ngày tạo</TH>
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
                    Chưa có dự án
                  </TD>
                </TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/projects/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                        {r.code}
                      </Link>
                    </TD>
                    <TD>{r.name}</TD>
                    <TD>{r.customer?.name ?? "—"}</TD>
                    <TD>{r.customerPo ?? "—"}</TD>
                    <TD>
                      <Badge tone={r.status === "ACTIVE" ? "success" : "muted"}>{r.status}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{formatDate(r.createdAt)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm dự án">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã dự án *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tên dự án *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Khách hàng</Label>
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>PO khách</Label>
              <Input value={form.customerPo} onChange={(e) => setForm({ ...form, customerPo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Số hợp đồng</Label>
              <Input value={form.contractNo} onChange={(e) => setForm({ ...form, contractNo: e.target.value })} />
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
