"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Printer, FileText } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/prescription";
import { formatDate } from "@/lib/utils";

type Item = { spaProductId: string; name: string; quantity: string; unit: string; usage: string; frequency: string; timing: string; durationDays: string; note: string };
const emptyItem = (): Item => ({ spaProductId: "", name: "", quantity: "", unit: "", usage: "", frequency: "", timing: "", durationDays: "", note: "" });
const TONE: Record<string, "muted" | "success" | "warning"> = { DRAFT: "warning", ISSUED: "success", CANCELLED: "muted" };

/**
 * Kê toa sau thực hiện (khối H màn buổi): kê sản phẩm dùng tại nhà + lời dặn →
 * lưu Nháp → Kê toa (khóa + ghi timeline khách) → In. Không trừ kho.
 */
export function SessionPrescription({ sessionId, customerId, canWrite, defaultIssuedBy }: { sessionId: string; customerId: string; canWrite: boolean; defaultIssuedBy?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await apiFetch<any[]>(`/api/prescriptions?sessionId=${sessionId}`).catch(() => []));
  }, [sessionId]);
  useEffect(() => { load(); apiFetch<any[]>("/api/spa-products").then(setProducts).catch(() => {}); }, [load]);

  const upd = (i: number, patch: Partial<Item>) => setItems((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const body = () => ({
    customerId, sessionId, diagnosis: diagnosis || null, advice: advice || null,
    followUpDate: followUpDate || null, issuedBy: defaultIssuedBy || null,
    items: items.filter((i) => i.name.trim()).map((i) => ({
      spaProductId: i.spaProductId || null, name: i.name.trim(),
      quantity: i.quantity !== "" ? Number(i.quantity) : null, unit: i.unit || null,
      usage: i.usage || null, frequency: i.frequency || null, timing: i.timing || null,
      durationDays: i.durationDays !== "" ? Number(i.durationDays) : null, note: i.note || null,
    })),
  });

  async function create(issue: boolean) {
    setSaving(true); setError(null);
    try {
      const p = await apiFetch<any>("/api/prescriptions", { method: "POST", body: JSON.stringify(body()) });
      if (issue) await apiFetch(`/api/prescriptions/${p.id}`, { method: "PATCH", body: JSON.stringify({ action: "issue" }) });
      setOpen(false); setItems([emptyItem()]); setDiagnosis(""); setAdvice(""); setFollowUpDate("");
      await load();
      if (issue) window.open(`/prescriptions/${p.id}`, "_blank");
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
    finally { setSaving(false); }
  }
  async function act(id: string, action: "issue" | "cancel") {
    let cancelReason: string | undefined;
    if (action === "cancel") { cancelReason = window.prompt("Lý do hủy toa?") ?? undefined; if (!cancelReason) return; }
    try { await apiFetch(`/api/prescriptions/${id}`, { method: "PATCH", body: JSON.stringify({ action, cancelReason }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && !open && <p className="text-sm text-muted-foreground">Chưa kê toa cho buổi này.</p>}

      {rows.map((r) => (
        <div key={r.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-medium">{r.code}</span>
            <Badge tone={TONE[r.status] ?? "muted"}>{PRESCRIPTION_STATUS_LABEL[r.status] ?? r.status}</Badge>
            <span className="text-xs text-muted-foreground">{(r.items ?? []).length} sản phẩm</span>
            <div className="ml-auto flex gap-1.5">
              <Link href={`/prescriptions/${r.id}`} target="_blank"><Button size="sm" variant="outline"><Printer className="h-3.5 w-3.5" /> In</Button></Link>
              {canWrite && r.status === "DRAFT" && <Button size="sm" onClick={() => act(r.id, "issue")}>Kê toa</Button>}
              {canWrite && r.status !== "CANCELLED" && <Button size="sm" variant="ghost" onClick={() => act(r.id, "cancel")}>Hủy</Button>}
            </div>
          </div>
          {(r.items ?? []).length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {r.items.map((it: any) => <li key={it.id}>• {it.name}{it.quantity ? ` — ${Number(it.quantity)}${it.unit ?? ""}` : ""}{it.frequency ? ` · ${it.frequency}` : ""}{it.timing ? ` (${it.timing})` : ""}</li>)}
            </ul>
          )}
        </div>
      ))}

      {canWrite && !open && <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Kê toa mới</Button>}

      {open && (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_.5fr_.5fr_1fr_.9fr_.7fr_.5fr_auto] items-center gap-1.5">
                <Select value={it.spaProductId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); upd(i, { spaProductId: e.target.value, name: p?.name ?? it.name, unit: it.unit || p?.volume || "", usage: it.usage || p?.usage || "", frequency: it.frequency || p?.frequency || "" }); }}>
                  <option value="">— Sản phẩm / gõ tên —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input type="number" value={it.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} placeholder="SL" />
                <Input value={it.unit} onChange={(e) => upd(i, { unit: e.target.value })} placeholder="ĐVT" />
                <Input value={it.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Tên *" />
                <Input value={it.frequency} onChange={(e) => upd(i, { frequency: e.target.value })} placeholder="Tần suất" />
                <Input value={it.timing} onChange={(e) => upd(i, { timing: e.target.value })} placeholder="Sáng/Tối" />
                <Input type="number" value={it.durationDays} onChange={(e) => upd(i, { durationDays: e.target.value })} placeholder="Ngày" />
                <Button type="button" size="icon" variant="ghost" onClick={() => setItems((s) => s.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setItems((s) => [...s, emptyItem()])}><Plus className="h-3 w-3" /> Thêm sản phẩm</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1"><Label>Nhận định / tình trạng da</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
            <div className="space-y-1"><Label>Hẹn tái khám</Label><Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Lời dặn chung</Label><Input value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="VD: Tránh nắng, uống đủ nước..." /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => create(false)}>Lưu nháp</Button>
            <Button type="button" disabled={saving} onClick={() => create(true)}><FileText className="h-4 w-4" /> Kê & In</Button>
          </div>
        </div>
      )}
    </div>
  );
}
