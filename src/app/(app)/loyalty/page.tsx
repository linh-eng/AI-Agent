"use client";
// =============================================================================
// LOY-PH1 — Workspace Khách hàng thân thiết (loyalty.read xem; thao tác cần
// loyalty.write). 3 tab: Thành viên (tra khách + điểm/ví + thao tác) · Hạng
// thành viên · Voucher. Ví trả trước KHÁC Deposit; KHÔNG tự trừ hóa đơn.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

const LTXN: Record<string, string> = { EARN: "Tích điểm", REDEEM: "Đổi điểm", ADJUST: "Điều chỉnh", EXPIRE: "Hết hạn" };
const PTXN: Record<string, string> = { TOP_UP: "Nạp ví", REDEEM: "Trừ ví", REFUND: "Hoàn ví", ADJUST: "Điều chỉnh" };
const TABS = [{ k: "members", label: "Thành viên" }, { k: "tiers", label: "Hạng thành viên" }, { k: "vouchers", label: "Voucher" }];

export default function LoyaltyPage() {
  const canWrite = useCan(PERMISSIONS.LOYALTY_WRITE);
  const [tab, setTab] = useState("members");
  return (
    <div className="space-y-4">
      <PageHeader title="Khách hàng thân thiết" description="Điểm tích lũy · Hạng thành viên · Ví trả trước · Voucher. Ví trả trước tách biệt Đặt cọc; không tự trừ vào hóa đơn (kế toán quyết định khi lập hóa đơn)." />
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-2 text-sm ${tab === t.k ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>{t.label}</button>)}
      </div>
      {tab === "members" && <MembersTab canWrite={canWrite} />}
      {tab === "tiers" && <TiersTab canWrite={canWrite} />}
      {tab === "vouchers" && <VouchersTab canWrite={canWrite} />}
    </div>
  );
}

export function LoyaltyMemberPanel({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const [s, setS] = useState<any | null>(null);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ points: "", amount: "", paymentId: "" });
  const load = useCallback(() => apiFetch<any>(`/api/loyalty/${customerId}`).then(setS).catch(() => setS(null)), [customerId]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string, body: any) {
    setMsg("");
    try { const r = await apiFetch<any>("/api/loyalty/actions", { method: "POST", body: JSON.stringify({ action, customerId, ...body }) }); setMsg("Xong: " + JSON.stringify(r)); load(); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  if (!s) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Đang tải…</CardContent></Card>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Điểm hiện có" value={s.points} />
        <Stat label="Hạng" value={s.tier ? s.tier.name : "—"} />
        <Stat label="Số dư ví trả trước" value={formatCurrency(s.prepaidBalance)} />
        <Stat label="Tổng chi tiêu" value={formatCurrency(s.lifetimeSpend)} />
      </div>
      {canWrite && <Card><CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">Thao tác</div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">Tích điểm từ phiếu thu (paymentId)</Label><Input className="w-56" value={f.paymentId} onChange={(e) => setF({ ...f, paymentId: e.target.value })} /></div>
          <Button size="sm" variant="outline" disabled={!f.paymentId} onClick={() => act("earn", { paymentId: f.paymentId })}>Tích điểm</Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">Số điểm</Label><Input className="w-28" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /></div>
          <Button size="sm" variant="outline" disabled={!f.points} onClick={() => act("redeemPoints", { points: Number(f.points) })}>Đổi điểm → ví</Button>
          <Button size="sm" variant="ghost" disabled={!f.points} onClick={() => act("adjustPoints", { points: Number(f.points), note: "Điều chỉnh thủ công" })}>Điều chỉnh điểm (±)</Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">Số tiền ví</Label><Input className="w-36" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <Button size="sm" disabled={!f.amount} onClick={() => act("topup", { amount: Number(f.amount), method: "CASH" })}>Nạp ví</Button>
          <Button size="sm" variant="outline" disabled={!f.amount} onClick={() => act("redeemPrepaid", { amount: Number(f.amount) })}>Trừ ví</Button>
          <Button size="sm" variant="ghost" disabled={!f.amount} onClick={() => act("refundPrepaid", { amount: Number(f.amount), note: "Hoàn ví" })}>Hoàn ví</Button>
        </div>
      </CardContent></Card>}
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-xs">{msg}</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        <LedgerTable title="Sổ điểm" rows={s.loyaltyTransactions} cols={["Loại", "Điểm", "Số dư"]} render={(t: any) => [LTXN[t.type] ?? t.type, `${t.points > 0 ? "+" : ""}${t.points}`, t.balanceAfter]} />
        <LedgerTable title="Sổ ví trả trước" rows={s.prepaidTransactions} cols={["Loại", "Số tiền", "Số dư"]} render={(t: any) => [PTXN[t.type] ?? t.type, formatCurrency(Number(t.amount)), formatCurrency(Number(t.balanceAfter))]} />
      </div>
      {s.vouchers?.length > 0 && <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th><th className="px-3 py-2">Giảm</th><th className="px-3 py-2">Trạng thái</th></tr></thead>
        <tbody>{s.vouchers.map((v: any) => <tr key={v.id ?? v.code} className="border-b last:border-0"><td className="px-3 py-2">{v.code}</td><td className="px-3 py-2">{v.name}</td><td className="px-3 py-2">{v.type === "FIXED" ? formatCurrency(Number(v.value)) : `${Number(v.value)}%`}</td><td className="px-3 py-2"><Badge tone={v.status === "ACTIVE" ? "success" : "muted"}>{v.status}</Badge></td></tr>)}</tbody>
      </table></div></CardContent></Card>}
    </div>
  );
}

function MembersTab({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState<any | null>(null);
  const [msg, setMsg] = useState("");
  async function search() {
    setMsg("");
    try { const rows = await apiFetch<any[]>(`/api/customers?q=${encodeURIComponent(q)}`); if (rows[0]) setCustomer(rows[0]); else { setCustomer(null); setMsg("Không tìm thấy khách"); } }
    catch (e: any) { setMsg(e?.message ?? "Lỗi"); }
  }
  return (
    <div className="space-y-3">
      <Card><CardContent className="flex items-end gap-2 p-4">
        <div className="flex-1"><Label>Tìm khách (mã/tên/SĐT)</Label><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="KH-... / tên / SĐT" /></div>
        <Button size="sm" onClick={search}>Tìm</Button>
      </CardContent></Card>
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}
      {customer && <>
        <div className="text-sm font-medium">{customer.fullName} <span className="text-muted-foreground">({customer.code})</span></div>
        <LoyaltyMemberPanel customerId={customer.id} canWrite={canWrite} />
      </>}
    </div>
  );
}

function TiersTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ code: "", name: "", minLifetimeSpend: "", pointsPerThousand: "1", discountPercent: "0" });
  const load = useCallback(() => apiFetch<any[]>("/api/membership-tiers").then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function add() { try { await apiFetch("/api/membership-tiers", { method: "POST", body: JSON.stringify({ ...f, minLifetimeSpend: Number(f.minLifetimeSpend) || 0, pointsPerThousand: Number(f.pointsPerThousand) || 1, discountPercent: Number(f.discountPercent) || 0 }) }); setF({ ...f, code: "", name: "" }); load(); } catch { /* noop */ } }
  return (
    <div className="space-y-3">
      {canWrite && <Card><CardContent className="grid gap-2 p-4 sm:grid-cols-5">
        <Input placeholder="Mã" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <Input placeholder="Tên hạng" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Ngưỡng chi tiêu" value={f.minLifetimeSpend} onChange={(e) => setF({ ...f, minLifetimeSpend: e.target.value })} />
        <Input placeholder="Điểm/1.000₫" value={f.pointsPerThousand} onChange={(e) => setF({ ...f, pointsPerThousand: e.target.value })} />
        <div className="flex gap-2"><Input placeholder="Ưu đãi %" value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: e.target.value })} /><Button size="sm" disabled={!f.code || !f.name} onClick={add}>Thêm</Button></div>
      </CardContent></Card>}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th><th className="px-3 py-2 text-right">Ngưỡng chi tiêu</th><th className="px-3 py-2 text-right">Điểm/1.000₫</th><th className="px-3 py-2 text-right">Ưu đãi</th></tr></thead>
        <tbody>{rows.map((t) => <tr key={t.id} className="border-b last:border-0"><td className="px-3 py-2">{t.code}</td><td className="px-3 py-2">{t.name}</td><td className="px-3 py-2 text-right">{formatCurrency(Number(t.minLifetimeSpend))}</td><td className="px-3 py-2 text-right">{Number(t.pointsPerThousand)}</td><td className="px-3 py-2 text-right">{Number(t.discountPercent)}%</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Chưa có hạng thành viên.</td></tr>}</tbody>
      </table></div></CardContent></Card>
    </div>
  );
}

function VouchersTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ code: "", name: "", type: "FIXED", value: "", maxDiscount: "", minSpend: "", maxRedemptions: "1" });
  const [chk, setChk] = useState({ code: "", spend: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => apiFetch<any[]>("/api/vouchers").then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function add() { setMsg(""); try { await apiFetch("/api/vouchers", { method: "POST", body: JSON.stringify({ code: f.code, name: f.name, type: f.type, value: Number(f.value) || 0, maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null, minSpend: f.minSpend ? Number(f.minSpend) : null, maxRedemptions: Number(f.maxRedemptions) || 1 }) }); setF({ ...f, code: "", name: "", value: "" }); load(); } catch (e: any) { setMsg(e?.message ?? "Lỗi"); } }
  async function check() { setMsg(""); try { const r = await apiFetch<any>("/api/vouchers/validate", { method: "POST", body: JSON.stringify({ code: chk.code, spend: Number(chk.spend) || 0 }) }); setMsg(r.ok ? `Hợp lệ — giảm ${formatCurrency(r.discount)}` : `Không hợp lệ: ${r.reason}`); } catch (e: any) { setMsg(e?.message ?? "Lỗi"); } }
  return (
    <div className="space-y-3">
      {canWrite && <Card><CardContent className="grid gap-2 p-4 sm:grid-cols-4">
        <Input placeholder="Mã" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <Input placeholder="Tên" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="FIXED">Số tiền</option><option value="PERCENT">Phần trăm</option></Select>
        <Input placeholder={f.type === "FIXED" ? "Số tiền giảm" : "% giảm"} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        {f.type === "PERCENT" && <Input placeholder="Trần giảm" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} />}
        <Input placeholder="Chi tiêu tối thiểu" value={f.minSpend} onChange={(e) => setF({ ...f, minSpend: e.target.value })} />
        <Input placeholder="Số lượt" value={f.maxRedemptions} onChange={(e) => setF({ ...f, maxRedemptions: e.target.value })} />
        <Button size="sm" disabled={!f.code || !f.name || !f.value} onClick={add}>Tạo voucher</Button>
      </CardContent></Card>}
      <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
        <div><Label className="text-xs">Kiểm tra voucher</Label><Input className="w-40" placeholder="Mã voucher" value={chk.code} onChange={(e) => setChk({ ...chk, code: e.target.value })} /></div>
        <Input className="w-40" placeholder="Chi tiêu" value={chk.spend} onChange={(e) => setChk({ ...chk, spend: e.target.value })} />
        <Button size="sm" variant="outline" onClick={check}>Kiểm tra</Button>
      </CardContent></Card>
      {msg && <div className="rounded bg-muted/40 px-3 py-2 text-sm">{msg}</div>}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th><th className="px-3 py-2">Giảm</th><th className="px-3 py-2 text-right">Lượt</th><th className="px-3 py-2">Trạng thái</th></tr></thead>
        <tbody>{rows.map((v) => <tr key={v.id} className="border-b last:border-0"><td className="px-3 py-2">{v.code}</td><td className="px-3 py-2">{v.name}</td><td className="px-3 py-2">{v.type === "FIXED" ? formatCurrency(Number(v.value)) : `${Number(v.value)}%`}</td><td className="px-3 py-2 text-right">{v.redeemedCount}/{v.maxRedemptions}</td><td className="px-3 py-2"><Badge tone={v.status === "ACTIVE" ? "success" : "muted"}>{v.status}</Badge></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Chưa có voucher.</td></tr>}</tbody>
      </table></div></CardContent></Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></CardContent></Card>;
}
function LedgerTable({ title, rows, cols, render }: { title: string; rows: any[]; cols: string[]; render: (r: any) => any[] }) {
  return <Card><CardContent className="p-0">
    <div className="border-b px-3 py-2 text-sm font-medium">{title}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">{cols.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}<th className="px-3 py-2">Thời điểm</th></tr></thead>
      <tbody>{(rows ?? []).map((r, i) => <tr key={i} className="border-b last:border-0">{render(r).map((v, j) => <td key={j} className="px-3 py-2">{v}</td>)}<td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.createdAt)}</td></tr>)}
      {(!rows || rows.length === 0) && <tr><td colSpan={cols.length + 1} className="px-3 py-4 text-center text-muted-foreground">Chưa có giao dịch.</td></tr>}</tbody>
    </table></div>
  </CardContent></Card>;
}
