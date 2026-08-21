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
 *
 * D6 — GỢI Ý theo SOP (Planned/Suggested): hiển thị vật tư dự kiến của dịch vụ,
 * bấm "Dùng" để PREFILL số lượng (Planned ≠ Actual — nhân viên sửa thành thực tế
 * rồi Ghi nhận), hoặc "Bỏ qua" (LÝ DO BẮT BUỘC). KHÔNG tự trừ kho; trừ kho chỉ khi
 * Ghi nhận qua engine tiêu hao hiện có. Auto-post khi hoàn thành = TẮT (không có).
 */
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function SpaMaterialConsume({ sessionId, customerId, canWrite }: { sessionId: string; customerId?: string; canWrite: boolean }) {
  const [containers, setContainers] = useState<any[]>([]);
  const [custMats, setCustMats] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);
  const [source, setSource] = useState<"SHARED_STOCK" | "CUSTOMER_OWNED">("SHARED_STOCK");
  const [refId, setRefId] = useState("");
  const [qty, setQty] = useState("");
  const [origin, setOrigin] = useState<"SOP" | "MANUAL">("MANUAL"); // D6 — trace nguồn (audit)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // FLOW-016 — chống double-submit trừ tồn 2 lần
  // D6 — gợi ý SOP + bỏ qua có lý do
  const [suggested, setSuggested] = useState<any[]>([]);
  const [skipped, setSkipped] = useState<any[]>([]);
  const [skipping, setSkipping] = useState<any | null>(null); // vật tư đang nhập lý do bỏ qua
  const [skipReason, setSkipReason] = useState("");

  const loadContainers = useCallback(() => {
    apiFetch<any[]>("/api/usage-materials").then((mats) => {
      setContainers(mats.flatMap((m) => m.containers.filter((c: any) => c.status !== "DISPOSED" && c.status !== "EMPTY").map((c: any) => ({ ...c, materialName: m.name }))));
    }).catch(() => setContainers([]));
  }, []);
  const loadUsages = useCallback(async () => {
    setUsages(await apiFetch<any[]>(`/api/material-usages?sessionId=${sessionId}`).catch(() => []));
  }, [sessionId]);
  const loadSuggested = useCallback(async () => {
    const r = await apiFetch<any>(`/api/session-suggested-materials?sessionId=${sessionId}`).catch(() => null);
    setSuggested(r?.suggested ?? []);
    setSkipped(r?.skipped ?? []);
  }, [sessionId]);

  useEffect(() => {
    loadContainers();
    if (customerId) apiFetch<any[]>(`/api/customer-materials?customerId=${customerId}`).then((r) => setCustMats(r.filter((m) => m.status !== "CANCELLED"))).catch(() => setCustMats([]));
    loadUsages();
    loadSuggested();
  }, [customerId, loadContainers, loadUsages, loadSuggested]);

  const options = source === "SHARED_STOCK" ? containers : custMats;
  const selected = options.find((o) => o.id === refId);
  const remaining = selected ? Number(selected.remainingQty) : null;
  const unit = selected ? selected.unit : "";

  // Trạng thái từng dòng gợi ý: đã dùng (khớp tên với usage) / đã bỏ qua.
  const usedNames = new Set(usages.map((u) => norm(u.container?.material?.name ?? u.customerMaterial?.name ?? "")));
  const skippedNames = new Set(skipped.map((s) => norm(s.materialName)));

  // "Dùng" — prefill số dự kiến; nếu có lọ trùng tên trong Kho vật tư → preselect.
  function prefillFromSop(s: any) {
    setSource("SHARED_STOCK");
    const match = containers.find((c) => norm(c.materialName) === norm(s.name));
    setRefId(match ? match.id : "");
    setQty(String(s.quantity ?? ""));
    setOrigin("SOP");
    setError(null);
  }

  async function submitSkip() {
    if (!skipping) return;
    setError(null);
    try {
      await apiFetch("/api/session-material-skip", { method: "POST", body: JSON.stringify({ sessionId, materialName: skipping.name, plannedQty: skipping.quantity, unit: skipping.unit, reason: skipReason }) });
      setSkipping(null); setSkipReason("");
      loadSuggested();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (busy) return; // chống double-click
    setBusy(true);
    try {
      // idempotencyKey: retry/double-submit cùng thao tác KHÔNG trừ tồn 2 lần (P4 server-side).
      const key = (globalThis.crypto?.randomUUID?.() ?? `${sessionId}-${Date.now()}-${Math.round(Number(qty) * 1000)}`);
      const body: any = { source, sessionId, quantity: Number(qty), idempotencyKey: key, origin };
      if (source === "SHARED_STOCK") body.containerId = refId; else body.customerMaterialId = refId;
      await apiFetch("/api/material-usages", { method: "POST", body: JSON.stringify(body) });
      setQty(""); setRefId(""); setOrigin("MANUAL");
      loadUsages(); loadContainers();
      if (customerId) apiFetch<any[]>(`/api/customer-materials?customerId=${customerId}`).then((r) => setCustMats(r.filter((m) => m.status !== "CANCELLED"))).catch(() => {});
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      {/* D6 — Vật tư dự kiến theo SOP (Planned/Suggested). KHÔNG tự trừ kho. */}
      {suggested.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
          <p className="text-xs font-semibold">Vật tư dự kiến theo SOP <span className="font-normal text-muted-foreground">(gợi ý — chưa trừ kho; sửa thành thực tế rồi Ghi nhận)</span></p>
          <div className="space-y-1">
            {suggested.map((s, i) => {
              const done = usedNames.has(norm(s.name));
              const skip = skippedNames.has(norm(s.name));
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{Number(s.quantity)}{s.unit}</span>
                  {s.isRequired && <Badge tone="warning">Bắt buộc</Badge>}
                  {done && <Badge tone="success">Đã dùng</Badge>}
                  {skip && <Badge tone="default">Đã bỏ qua</Badge>}
                  {canWrite && !done && !skip && (
                    <>
                      <Button type="button" size="sm" variant="outline" className="h-6 px-2" onClick={() => prefillFromSop(s)}>Dùng</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground" onClick={() => { setSkipping(s); setSkipReason(""); }}>Bỏ qua</Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {skipping && (
            <div className="mt-1 flex flex-wrap items-end gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Lý do bỏ qua &quot;{skipping.name}&quot; (bắt buộc)</Label>
                <Input value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="h-8" placeholder="Vd: khách chống chỉ định / không dùng bước này" />
              </div>
              <Button type="button" size="sm" disabled={skipReason.trim().length < 3} onClick={submitSkip}>Xác nhận bỏ qua</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setSkipping(null); setSkipReason(""); }}>Hủy</Button>
            </div>
          )}
          {skipped.length > 0 && (
            <p className="text-[11px] text-muted-foreground">Đã bỏ qua: {skipped.map((s) => `${s.materialName} (${s.reason})`).join("; ")}</p>
          )}
        </div>
      )}

      {canWrite && (
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Nguồn vật tư</Label>
              <Select value={source} onChange={(e) => { setSource(e.target.value as any); setRefId(""); setOrigin("MANUAL"); }} className="h-8">
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
            <div className="flex-1 space-y-1"><Label className="text-xs">Số lượng sử dụng{unit ? ` (${unit})` : ""}{origin === "SOP" ? " · từ SOP (sửa thành thực tế)" : ""}</Label><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="h-8" /></div>
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
