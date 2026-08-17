"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Redesign P4 — Dịch vụ THỰC TẾ đã làm trong buổi (SessionExecutionItem).
 * "Đã đặt" (BookingItem) khác "Thực hiện thực tế" (execution item). Mỗi lần thêm sẽ
 * ĐÔNG CỨNG snapshot (bất biến). Chọn phương án (SOP option) + giá trị thực tế (qtyStd/qtyActual).
 */
export function SessionExecutions({ sessionId, canWrite, bookingItems }: { sessionId: string; canWrite: boolean; bookingItems?: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [optId, setOptId] = useState("");
  const [optName, setOptName] = useState("");
  const [qtyStd, setQtyStd] = useState("");
  const [qtyActual, setQtyActual] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await apiFetch<any[]>(`/api/session-executions?sessionId=${sessionId}`).catch(() => []));
  }, [sessionId]);
  useEffect(() => { load(); apiFetch<any[]>("/api/services?status=ACTIVE").then(setServices).catch(() => {}); }, [load]);

  // Nạp SOP option của dịch vụ đã chọn (để chọn phương án thực tế).
  useEffect(() => {
    setDetail(null); setOptId(""); setOptName("");
    if (serviceId) apiFetch<any>(`/api/services/${serviceId}`).then(setDetail).catch(() => {});
  }, [serviceId]);
  const options: any[] = (detail?.steps ?? []).flatMap((st: any) => (st.options ?? []).map((o: any) => ({ ...o, stepName: st.name })));

  async function add() {
    if (!serviceId) return;
    setError(null);
    try {
      const body: any = {
        sessionId, serviceId,
        selectedOptionSource: optId ? "SERVICE_SOP_OPTION" : "PRACTITIONER_ADHOC",
        selectedOptionId: optId || null, selectedOptionName: optName || null,
        actualValues: (qtyStd || qtyActual) ? [{ stepName: options.find((o) => o.id === optId)?.stepName ?? null, productName: optName || null, qtyStd: qtyStd ? Number(qtyStd) : null, qtyActual: qtyActual ? Number(qtyActual) : null }] : [],
      };
      await apiFetch("/api/session-executions", { method: "POST", body: JSON.stringify(body) });
      setServiceId(""); setOptId(""); setOptName(""); setQtyStd(""); setQtyActual("");
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function remove(id: string) {
    await apiFetch(`/api/session-executions/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <div className="space-y-3">
      {bookingItems && bookingItems.length > 0 && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <span className="font-medium">Đã đặt:</span> {bookingItems.map((b: any) => b.service?.name ?? b.serviceId).join(" · ")} — chọn để ghi <b>thực hiện thực tế</b> bên dưới (không sửa dữ liệu đã đặt).
        </div>
      )}

      {items.length === 0 ? <p className="text-sm text-muted-foreground">Chưa ghi dịch vụ thực tế nào.</p> : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={it.id} className="rounded-md border bg-card p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                <span className="font-medium">{it.service?.name ?? it.serviceId}</span>
                {it.selectedOptionName && <Badge tone="muted">{it.selectedOptionName}</Badge>}
                <span className="text-xs text-muted-foreground">v{it.sourceVersion ?? "?"} · đông cứng</span>
                {canWrite && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(it.id)}>Xóa</Button>}
              </div>
              {(it.executionSnapshot?.actualValues ?? []).length > 0 && (
                <div className="mt-1 pl-7 text-xs text-muted-foreground">
                  {it.executionSnapshot.actualValues.map((v: any, j: number) => (
                    <div key={j}>{v.productName ?? v.stepName}: chuẩn nguồn <b>{v.qtyStd ?? "—"}{v.unit ?? ""}</b> → thực tế <b className="text-foreground">{v.qtyActual ?? "—"}{v.unit ?? ""}</b></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Thêm dịch vụ thực hiện thực tế (đông cứng snapshot)</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Dịch vụ</Label><Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}><option value="">— Chọn —</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div className="space-y-1"><Label>Phương án thực tế</Label>
              <Select value={optId} onChange={(e) => { setOptId(e.target.value); const o = options.find((x) => x.id === e.target.value); setOptName(o?.name ?? ""); setQtyStd(o?.quantity != null ? String(o.quantity) : ""); }} disabled={!options.length}>
                <option value="">{options.length ? "— Tùy kỹ thuật viên —" : "Không có phương án"}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.stepName}: {o.name}{o.isDefault ? " (mặc định)" : ""}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label>Chuẩn nguồn (qty)</Label><Input type="number" value={qtyStd} onChange={(e) => setQtyStd(e.target.value)} placeholder="std" /></div>
            <div className="space-y-1"><Label>Thực tế dùng (qty)</Label><Input type="number" value={qtyActual} onChange={(e) => setQtyActual(e.target.value)} placeholder="actual" /></div>
            <div className="flex items-end"><Button type="button" onClick={add} disabled={!serviceId}>Ghi thực hiện</Button></div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
