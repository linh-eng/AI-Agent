"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { MATERIAL_SOURCE_LABEL } from "@/lib/clinic-labels";

/**
 * Ghi nhận tiêu hao vật tư cho MỘT buổi — chọn NGUỒN (Kho vật tư sử dụng /
 * Vật tư khách hàng) → chọn lọ/lô hoặc vật tư khách → hiện tồn còn lại → nhập số
 * dùng → lưu lịch sử + cập nhật remaining. Vật tư khách hàng chỉ liệt kê của
 * đúng khách (chống dùng chéo).
 */
export function SpaMaterialConsume({ sessionId, customerId, canWrite }: { sessionId: string; customerId?: string; canWrite: boolean }) {
  const [containers, setContainers] = useState<any[]>([]);
  const [custMats, setCustMats] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);
  const [source, setSource] = useState<"SHARED_STOCK" | "CUSTOMER_OWNED">("SHARED_STOCK");
  const [refId, setRefId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // FLOW-016 — chống double-submit trừ tồn 2 lần

  const loadUsages = useCallback(async () => {
    setUsages(await apiFetch<any[]>(`/api/material-usages?sessionId=${sessionId}`).catch(() => []));
  }, [sessionId]);

  useEffect(() => {
    apiFetch<any[]>("/api/usage-materials").then((mats) => {
      setContainers(mats.flatMap((m) => m.containers.filter((c: any) => c.status !== "DISPOSED" && c.status !== "EMPTY").map((c: any) => ({ ...c, materialName: m.name }))));
    }).catch(() => setContainers([]));
    if (customerId) apiFetch<any[]>(`/api/customer-materials?customerId=${customerId}`).then((r) => setCustMats(r.filter((m) => m.status !== "CANCELLED"))).catch(() => setCustMats([]));
    loadUsages();
  }, [customerId, loadUsages]);

  const options = source === "SHARED_STOCK" ? containers : custMats;
  const selected = options.find((o) => o.id === refId);
  const remaining = selected ? (source === "SHARED_STOCK" ? Number(selected.remainingQty) : Number(selected.remainingQty)) : null;
  const unit = selected ? (source === "SHARED_STOCK" ? selected.unit : selected.unit) : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (busy) return; // chống double-click
    setBusy(true);
    try {
      // idempotencyKey: retry/double-submit cùng thao tác KHÔNG trừ tồn 2 lần (P4 server-side).
      const key = (globalThis.crypto?.randomUUID?.() ?? `${sessionId}-${Date.now()}-${Math.round(Number(qty) * 1000)}`);
      const body: any = { source, sessionId, quantity: Number(qty), idempotencyKey: key };
      if (source === "SHARED_STOCK") body.containerId = refId; else body.customerMaterialId = refId;
      await apiFetch("/api/material-usages", { method: "POST", body: JSON.stringify(body) });
      setQty(""); setRefId("");
      loadUsages();
      // làm mới tồn
      apiFetch<any[]>("/api/usage-materials").then((mats) => setContainers(mats.flatMap((m) => m.containers.filter((c: any) => c.status !== "DISPOSED" && c.status !== "EMPTY").map((c: any) => ({ ...c, materialName: m.name }))))).catch(() => {});
      if (customerId) apiFetch<any[]>(`/api/customer-materials?customerId=${customerId}`).then((r) => setCustMats(r.filter((m) => m.status !== "CANCELLED"))).catch(() => {});
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      {canWrite && (
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Nguồn vật tư</Label>
              <Select value={source} onChange={(e) => { setSource(e.target.value as any); setRefId(""); }} className="h-8">
                <option value="SHARED_STOCK">Kho vật tư sử dụng</option>
                <option value="CUSTOMER_OWNED">Vật tư khách hàng</option>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Chọn vật tư / lọ</Label>
              <Select value={refId} onChange={(e) => setRefId(e.target.value)} className="h-8">
                <option value="">— Chọn —</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {source === "SHARED_STOCK" ? `${o.materialName} · ${o.containerNo} (còn ${Number(o.remainingQty)}${o.unit})` : `${o.name} (còn ${Number(o.remainingQty)}${o.unit})`}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {selected && <p className="text-xs text-muted-foreground">Còn lại: <strong>{remaining} {unit}</strong></p>}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1"><Label className="text-xs">Số lượng sử dụng{unit ? ` (${unit})` : ""}</Label><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="h-8" /></div>
            <Button type="submit" size="sm" disabled={!refId || !qty || busy}>{busy ? "Đang ghi…" : "Ghi nhận"}</Button>
          </div>
          {source === "CUSTOMER_OWNED" && custMats.length === 0 && <p className="text-xs text-muted-foreground">Khách chưa có vật tư riêng. Cấp ở menu &quot;Vật tư khách hàng&quot;.</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      )}
      {usages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Đã dùng trong buổi này:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="p-1 text-left">Nguồn</th><th className="p-1 text-left">Vật tư · Lọ/lô</th>
                  <th className="p-1 text-right">Tồn trước</th><th className="p-1 text-right">Dùng</th><th className="p-1 text-right">Tồn sau</th>
                  <th className="p-1 text-right">Chi phí</th><th className="p-1 text-right">Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {usages.map((u) => {
                  const unit = u.container?.material?.unit ?? u.customerMaterial?.unit ?? "";
                  const ct = u.container?.containerNo ? ` · ${u.container.containerNo}` : "";
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-1"><Badge tone={u.source === "SHARED_STOCK" ? "default" : "warning"}>{MATERIAL_SOURCE_LABEL[u.source]}</Badge></td>
                      <td className="p-1">{u.container?.material?.name ?? u.customerMaterial?.name}<span className="text-muted-foreground">{ct}</span></td>
                      <td className="p-1 text-right text-muted-foreground">{u.remainingBefore != null ? `${Number(u.remainingBefore)}${unit}` : "—"}</td>
                      <td className="p-1 text-right font-medium">{Number(u.quantity)}{unit}</td>
                      <td className="p-1 text-right text-muted-foreground">{u.remainingAfter != null ? `${Number(u.remainingAfter)}${unit}` : "—"}</td>
                      <td className="p-1 text-right">{u.costAllocated != null ? Number(u.costAllocated).toLocaleString("vi-VN") + "₫" : "—"}</td>
                      <td className="p-1 text-right text-muted-foreground">{formatDateTime(u.occurredAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
