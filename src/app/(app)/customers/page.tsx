"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, computeAge } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { GENDER_LABEL } from "@/lib/clinic-labels";

interface Row {
  id: string;
  code: string;
  fullName: string;
  gender?: string | null;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  group?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  isActive: boolean;
}

interface Facets {
  sources: string[];
  assignees: string[];
  technicians: string[];
  services: { id: string; name: string }[];
}

const EMPTY_FILTER = { source: "", assignedTo: "", serviceId: "", technician: "", plan: "", status: "active", from: "", to: "" };

export default function CustomersPage() {
  const canWrite = useCan(PERMISSIONS.CUSTOMER_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState({ ...EMPTY_FILTER });
  const [showFilter, setShowFilter] = useState(false);
  const [facets, setFacets] = useState<Facets>({ sources: [], assignees: [], technicians: [], services: [] });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", gender: "", phone: "", email: "", dob: "",
    source: "", group: "", assignedTo: "", address: "", goals: "", note: "",
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (filter.source) p.set("source", filter.source);
      if (filter.assignedTo) p.set("assignedTo", filter.assignedTo);
      if (filter.serviceId) p.set("serviceId", filter.serviceId);
      if (filter.technician) p.set("technician", filter.technician);
      if (filter.plan) p.set("plan", filter.plan);
      if (filter.status && filter.status !== "active") p.set("status", filter.status);
      if (filter.from) p.set("from", filter.from);
      if (filter.to) p.set("to", filter.to);
      setRows(await apiFetch<Row[]>(`/api/customers${p.toString() ? `?${p}` : ""}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<Facets>("/api/customers/facets").then(setFacets).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFilterCount = Object.entries(filter).filter(([k, v]) => v && !(k === "status" && v === "active")).length;

  function resetFilters() {
    setFilter({ ...EMPTY_FILTER });
    setTimeout(load, 0);
  }

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
        description="Hồ sơ khách hàng 360° — booking, phác đồ, CSKH, thanh toán đều liên kết về đây."
        action={canWrite && (<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm khách hàng</Button>)}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 md:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm theo tên, mã khách, SĐT, email..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Button variant="outline" onClick={load}>Tìm</Button>
        <Button variant={activeFilterCount ? "default" : "outline"} onClick={() => setShowFilter((s) => !s)}>
          <SlidersHorizontal className="h-4 w-4" /> Bộ lọc{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Nguồn khách" value={filter.source} onChange={(v) => setFilter({ ...filter, source: v })} options={facets.sources} />
            <FilterSelect label="Nhân viên phụ trách" value={filter.assignedTo} onChange={(v) => setFilter({ ...filter, assignedTo: v })} options={facets.assignees} />
            <FilterSelect label="Kỹ thuật viên đã thực hiện" value={filter.technician} onChange={(v) => setFilter({ ...filter, technician: v })} options={facets.technicians} />
            <div className="space-y-1.5">
              <Label>Dịch vụ đã sử dụng</Label>
              <Select value={filter.serviceId} onChange={(e) => setFilter({ ...filter, serviceId: e.target.value })}>
                <option value="">— Tất cả —</option>
                {facets.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phác đồ (theo tên)</Label>
              <Input value={filter.plan} onChange={(e) => setFilter({ ...filter, plan: e.target.value })} placeholder="Tên phác đồ..." />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái khách</Label>
              <Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã lưu trữ</option>
                <option value="all">Tất cả</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Từ ngày (tạo hồ sơ)</Label>
              <Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Đến ngày</Label>
              <Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button onClick={load}>Áp dụng bộ lọc</Button>
              <Button variant="ghost" onClick={resetFilters}><X className="h-4 w-4" /> Xóa lọc</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Mã</TH>
                  <TH>Họ tên</TH>
                  <TH>Giới tính</TH>
                  <TH>Ngày sinh</TH>
                  <TH className="text-right">Tuổi</TH>
                  <TH>Điện thoại</TH>
                  <TH>Nguồn</TH>
                  <TH>Phụ trách</TH>
                  <TH>Ngày tạo</TH>
                  <TH>Trạng thái</TH>
                </TR>
              </THead>
              <TBody>
                {loading ? (
                  <TR><TD colSpan={10} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                ) : rows.length === 0 ? (
                  <TR><TD colSpan={10} className="py-8 text-center text-muted-foreground">Không có khách hàng phù hợp</TD></TR>
                ) : (
                  rows.map((r) => {
                    const age = computeAge(r.dob);
                    return (
                      <TR key={r.id} className={r.isActive ? "" : "opacity-50"}>
                        <TD className="font-mono font-medium"><Link href={`/customers/${r.id}`} className="text-primary hover:underline">{r.code}</Link></TD>
                        <TD><Link href={`/customers/${r.id}`} className="font-medium hover:underline">{r.fullName}</Link></TD>
                        <TD>{r.gender ? GENDER_LABEL[r.gender] : "—"}</TD>
                        <TD>{r.dob ? formatDate(r.dob) : "—"}</TD>
                        <TD className="text-right tabular-nums">{age ?? "—"}</TD>
                        <TD>{r.phone ?? "—"}</TD>
                        <TD>{r.source ? <Badge tone="muted">{r.source}</Badge> : "—"}</TD>
                        <TD>{r.assignedTo ?? "—"}</TD>
                        <TD>{formatDate(r.createdAt)}</TD>
                        <TD>{r.isActive ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="muted">Lưu trữ</Badge>}</TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
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

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Tất cả —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    </div>
  );
}
