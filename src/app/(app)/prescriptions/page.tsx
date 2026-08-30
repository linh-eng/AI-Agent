"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/prescription";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { useOpenNew } from "@/lib/use-open-new";
import { QuickCreateButton } from "@/components/quick-create";

const TONE: Record<string, "muted" | "success" | "warning"> = { DRAFT: "warning", ISSUED: "success", CANCELLED: "muted" };
const blankItem = () => ({ spaProductId: "", name: "", quantity: "", unit: "", usage: "", frequency: "" });

export default function PrescriptionsPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  // Tạo toa
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cq, setCq] = useState("");
  const [form, setForm] = useState<any>({ customerId: "", diagnosis: "", advice: "", followUpDate: "", items: [blankItem()] });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      setRows(await apiFetch<any[]>(`/api/prescriptions${p.toString() ? `?${p}` : ""}`));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);
  useEffect(() => {
    if (!open) return;
    apiFetch<any[]>("/api/customers").then((r) => setCustomers(Array.isArray(r) ? r : (r as any).data ?? [])).catch(() => setCustomers([]));
    apiFetch<any[]>("/api/spa-products").then(setProducts).catch(() => setProducts([]));
  }, [open]);
  useOpenNew(() => setOpen(true), canWrite); // ?new=1 → tự mở "Tạo toa"

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.code?.toLowerCase().includes(s) || r.customer?.fullName?.toLowerCase().includes(s) || r.customer?.code?.toLowerCase().includes(s);
  });
  const custMatches = customers.filter((c) => { const s = cq.trim().toLowerCase(); return !s || c.fullName?.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s) || c.phone?.includes(s); }).slice(0, 30);

  const setItem = (i: number, patch: any) => setForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, ...patch } : it) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.customerId) { setErr("Vui lòng chọn khách hàng"); return; }
    const items = form.items.filter((it: any) => it.name.trim());
    setBusy(true); setErr(null);
    try {
      const body = {
        customerId: form.customerId,
        diagnosis: form.diagnosis || null, advice: form.advice || null, followUpDate: form.followUpDate || undefined,
        items: items.map((it: any) => ({ spaProductId: it.spaProductId || null, name: it.name.trim(), quantity: it.quantity ? Number(it.quantity) : null, unit: it.unit || null, usage: it.usage || null, frequency: it.frequency || null })),
      };
      const row = await apiFetch<any>("/api/prescriptions", { method: "POST", body: JSON.stringify(body) });
      router.push(`/prescriptions/${row.id}`);
    } catch (e: any) { setErr(e?.message ?? "Không tạo được toa"); setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Kê toa (toa chăm sóc)" description="Toa sản phẩm dùng tại nhà + lời dặn. Kê từ màn Ghi nhận buổi (khối H) hoặc tạo toa mới tại đây."
        action={canWrite && <Button onClick={() => { setForm({ customerId: "", diagnosis: "", advice: "", followUpDate: "", items: [blankItem()] }); setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Tạo toa</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm mã toa / tên / mã KH..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">— Mọi trạng thái —</option>
          {Object.entries(PRESCRIPTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button variant="outline" onClick={load}>Tải lại</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Mã toa</TH><TH>Khách hàng</TH><TH>Buổi</TH><TH className="text-right">Số SP</TH><TH>Ngày</TH><TH>Trạng thái</TH></TR></THead>
          <TBody>
            {loading ? <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR> :
              filtered.length === 0 ? <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có toa nào</TD></TR> :
              filtered.map((r) => (
                <TR key={r.id} className="cursor-pointer hover:bg-muted/40">
                  <TD className="font-mono font-medium"><Link href={`/prescriptions/${r.id}`} className="text-primary hover:underline">{r.code}</Link></TD>
                  <TD>{r.customer?.fullName} <span className="font-mono text-xs text-muted-foreground">{r.customer?.code}</span></TD>
                  <TD className="text-muted-foreground">{r.session?.code ?? "—"}</TD>
                  <TD className="text-right">{(r.items ?? []).length}</TD>
                  <TD>{formatDate(r.issuedAt || r.createdAt)}</TD>
                  <TD><Badge tone={TONE[r.status] ?? "muted"}>{PRESCRIPTION_STATUS_LABEL[r.status] ?? r.status}</Badge></TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </div></CardContent></Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo toa chăm sóc" className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Khách hàng *</Label>
            {form.customerId ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span>{customers.find((c) => c.id === form.customerId)?.fullName} <span className="font-mono text-xs text-muted-foreground">{customers.find((c) => c.id === form.customerId)?.code}</span></span>
                <button type="button" className="ml-auto text-xs text-primary hover:underline" onClick={() => setForm((f: any) => ({ ...f, customerId: "" }))}>Đổi</button>
              </div>
            ) : (
              <>
                <Input placeholder="Tìm khách theo tên / mã / SĐT…" value={cq} onChange={(e) => setCq(e.target.value)} />
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {custMatches.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Không có khách phù hợp.</p> :
                    custMatches.map((c) => (
                      <button key={c.id} type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50" onClick={() => { setForm((f: any) => ({ ...f, customerId: c.id })); setCq(""); }}>
                        {c.fullName} <span className="font-mono text-xs text-muted-foreground">{c.code}</span>{c.phone && <span className="text-xs text-muted-foreground">· {c.phone}</span>}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="mb-0">Sản phẩm / hạng mục</Label>
              <div className="flex items-center gap-3">
                <QuickCreateButton label="Sản phẩm" endpoint="/api/spa-products" fields={[{ key: "name", label: "Tên sản phẩm", required: true }]} onCreated={(r) => setProducts((p) => [...p, r])} />
                <button type="button" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline" onClick={() => setForm((f: any) => ({ ...f, items: [...f.items, blankItem()] }))}><Plus className="h-3.5 w-3.5" /> Thêm dòng</button>
              </div>
            </div>
            {form.items.map((it: any, i: number) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4">
                  <Select value={it.spaProductId} onChange={(e) => { const pr = products.find((x) => x.id === e.target.value); setItem(i, { spaProductId: e.target.value, name: pr?.name ?? it.name, unit: it.unit || pr?.unit || "", usage: it.usage || pr?.usage || "" }); }} className="h-8">
                    <option value="">— Chọn SP (hoặc gõ tên) —</option>
                    {products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                </div>
                <Input className="col-span-3 h-8" placeholder="Tên hạng mục" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                <Input className="col-span-1 h-8" placeholder="SL" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                <Input className="col-span-1 h-8" placeholder="ĐVT" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                <Input className="col-span-2 h-8" placeholder="Cách dùng" value={it.usage} onChange={(e) => setItem(i, { usage: e.target.value })} />
                <button type="button" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nhận định</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hẹn tái khám</Label><Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Lời dặn</Label><Input value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} /></div>

          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo toa (nháp)"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Tạo xong mở màn chi tiết để kê & in. Toa đã kê sẽ khóa nội dung.</p>
        </form>
      </Modal>
    </div>
  );
}
