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
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { PLAN_STATUS_LABEL, PLAN_STATUS_TONE } from "@/lib/clinic-labels";

interface Plan {
  id: string;
  code: string;
  name: string;
  version: number;
  status: string;
  totalPrice?: string | number | null;
  customer: { code: string; fullName: string };
  _count: { sessions: number; stages: number };
}
interface Opt { id: string; code: string; fullName: string }

// Giai đoạn gợi ý (mục 7 phần bổ sung): Chuẩn bị → Can thiệp → Phục hồi → Duy trì
const DEFAULT_STAGES = ["Chuẩn bị", "Can thiệp", "Phục hồi", "Duy trì"];

export default function TreatmentPlansPage() {
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const [rows, setRows] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [form, setForm] = useState({ customerId: "", name: "", diagnosis: "", goals: "", totalPrice: "" });
  const [stages, setStages] = useState<string[]>([...DEFAULT_STAGES]);

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Plan[]>("/api/treatment-plans")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); apiFetch<Opt[]>("/api/customers").then(setCustomers).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = {
        customerId: form.customerId,
        name: form.name,
        diagnosis: form.diagnosis || undefined,
        goals: form.goals || undefined,
        totalPrice: form.totalPrice ? Number(form.totalPrice) : undefined,
        stages: stages.filter(Boolean).map((name, i) => ({ name, orderIndex: i })),
      };
      await apiFetch("/api/treatment-plans", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ customerId: "", name: "", diagnosis: "", goals: "", totalPrice: "" });
      setStages([...DEFAULT_STAGES]);
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Phác đồ điều trị"
        description="Treatment Plan riêng cho từng khách — nhiều giai đoạn, nhiều buổi, có version."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo phác đồ</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Khách hàng</TH><TH>Ver</TH><TH>Giai đoạn</TH><TH>Buổi</TH><TH className="text-right">Giá</TH><TH>Trạng thái</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có phác đồ</TD></TR>
              ) : (
                rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono font-medium"><Link href={`/treatment-plans/${p.id}`} className="text-primary hover:underline">{p.code}</Link></TD>
                    <TD><Link href={`/treatment-plans/${p.id}`} className="hover:underline">{p.name}</Link></TD>
                    <TD>{p.customer.fullName}</TD>
                    <TD>v{p.version}</TD>
                    <TD>{p._count.stages}</TD>
                    <TD>{p._count.sessions}</TD>
                    <TD className="text-right">{p.totalPrice ? formatNumber(Number(p.totalPrice)) + " ₫" : "—"}</TD>
                    <TD><Badge tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phác đồ">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Khách hàng *</Label>
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
              <option value="">— Chọn khách —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.fullName}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Tên phác đồ *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Tình trạng / vấn đề chính</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Mục tiêu</Label><Input value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tổng giá dự kiến (₫)</Label><Input type="number" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Giai đoạn</Label>
            {stages.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s} onChange={(e) => setStages(stages.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button type="button" variant="outline" size="sm" onClick={() => setStages(stages.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setStages([...stages, ""])}>+ Giai đoạn</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
