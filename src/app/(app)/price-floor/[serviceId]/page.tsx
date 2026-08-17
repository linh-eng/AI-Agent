"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Send, CheckCircle2, Play, Ban, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { computeVersionCost, computeFloorPrice, maxDiscount, COST_CATEGORIES } from "@/lib/price-floor";
import { FLOOR_VERSION_STATUS_LABEL, FLOOR_VERSION_STATUS_TONE, FLOOR_METHOD_LABEL, COST_CATEGORY_LABEL, COST_CALC_TYPE_LABEL } from "@/lib/clinic-labels";

const CALC_TYPES = ["FIXED", "PER_SESSION", "PER_MINUTE", "PER_USE", "PERCENT_DIRECT", "PER_DURATION"];
const CAT_BLOCK: { key: string; letter: string }[] = [
  { key: "MATERIAL", letter: "A" }, { key: "STAFF", letter: "B" }, { key: "MACHINE", letter: "C" },
  { key: "ROOM", letter: "D" }, { key: "OPERATION", letter: "E" }, { key: "OTHER", letter: "F" },
];

export default function PriceFloorDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const canWrite = useCan(PERMISSIONS.PRICEFLOOR_WRITE);
  const canApprove = useCan(PERMISSIONS.PRICEFLOOR_APPROVE);
  const [data, setData] = useState<any>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<any[] | null>(null); // bản nháp đang sửa
  const [costForm, setCostForm] = useState<{ costingId: string; margin: string }>({ costingId: "", margin: "30" });
  const [editMeta, setEditMeta] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any>(`/api/price-floors/${serviceId}`);
      setData(d);
      setSelId((prev) => prev ?? d.versions.find((v: any) => v.status === "ACTIVE")?.id ?? d.versions[0]?.id ?? null);
    } finally { setLoading(false); }
  }, [serviceId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy dịch vụ.</p>;

  const fin = data.canSeeFinance;
  const sel = data.versions.find((v: any) => v.id === selId) ?? null;
  const editing = editLines != null;

  async function createVersion() {
    setError(null);
    try { const v = await apiFetch<any>(`/api/price-floors/${serviceId}`, { method: "POST", body: JSON.stringify({ minMarginPercent: sel?.minMarginPercent ?? 30, method: "MARGIN" }) }); await load(); setSelId(v.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  // PH2 — tạo Floor version từ Giá vốn (Costing) đã phát hành.
  async function createFromCosting() {
    setError(null);
    if (!costForm.costingId) { setError("Chọn version giá vốn đã phát hành"); return; }
    try {
      const v = await apiFetch<any>(`/api/price-floors/${serviceId}`, { method: "POST", body: JSON.stringify({ serviceCostingVersionId: costForm.costingId, minMarginPercent: Number(costForm.margin || 0) }) });
      await load(); setSelId(v.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  function startEdit() {
    setEditMeta({ method: sel.method, minMarginPercent: sel.minMarginPercent ?? 0, manualFloorPrice: sel.manualFloorPrice ?? "", roundingUnit: sel.roundingUnit ?? 1000, changeReason: sel.changeReason ?? "" });
    setEditLines((sel.lines ?? []).map((l: any) => ({ ...l })));
  }
  async function saveEdit() {
    setError(null);
    try {
      // Version từ Giá vốn: chỉ đổi biên/làm tròn — KHÔNG gửi cost lines (server chặn).
      const isCostingSel = !!sel?.serviceCostingVersionId;
      const body: any = { ...editMeta, minMarginPercent: Number(editMeta.minMarginPercent || 0), manualFloorPrice: editMeta.manualFloorPrice === "" ? null : Number(editMeta.manualFloorPrice), roundingUnit: Number(editMeta.roundingUnit || 1000) };
      if (!isCostingSel) body.lines = editLines;
      await apiFetch(`/api/price-floor-versions/${sel.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditLines(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }
  async function transition(action: string, extra?: any) {
    setError(null);
    try { await apiFetch(`/api/price-floor-versions/${sel.id}/status`, { method: "POST", body: JSON.stringify({ action, ...extra }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi"); }
  }

  // PH2 — version tạo từ Giá vốn (Costing): cost breakdown là SNAPSHOT từ costing,
  // không sửa cost lines ở màn giá sàn. totalCost lấy từ snapshot, chỉ đổi biên.
  const isCosting = !!sel?.serviceCostingVersionId;

  // preview khi đang sửa
  const previewLines = editing ? editLines! : (sel?.lines ?? []);
  const linesCost = fin ? computeVersionCost(previewLines.map((l: any) => ({ category: l.category, quantity: Number(l.quantity), unitCost: Number(l.unitCost), calcType: l.calcType, calcValue: l.calcValue == null || l.calcValue === "" ? null : Number(l.calcValue), minutes: l.minutes })), data.durationMinutes ?? 0) : null;
  const cost = fin
    ? (isCosting
        ? { byCategory: { MATERIAL: Number(sel?.breakdown?.MATERIAL ?? 0), STAFF: Number(sel?.breakdown?.STAFF ?? 0), MACHINE: Number(sel?.breakdown?.MACHINE ?? 0), ROOM: Number(sel?.breakdown?.ROOM ?? 0), OPERATION: Number(sel?.breakdown?.OPERATION ?? 0), OTHER: Number(sel?.breakdown?.OTHER ?? 0) }, totalCost: Number(sel?.totalCost ?? 0), lineAmounts: [] as number[], directCost: 0 }
        : linesCost)
    : null;
  const previewMethod = isCosting ? "MARGIN" : (editing ? editMeta.method : sel?.method);
  const previewMargin = editing ? Number(editMeta.minMarginPercent || 0) : Number(sel?.minMarginPercent ?? 0);
  const previewFloor = fin && cost
    ? (isCosting
        ? computeFloorPrice({ totalCost: cost.totalCost, method: "MARGIN", minMarginPercent: previewMargin, roundingUnit: editing ? Number(editMeta.roundingUnit || 1000) : sel?.roundingUnit })
        : computeFloorPrice({ totalCost: cost.totalCost, method: previewMethod, minMarginPercent: previewMargin, manualFloorPrice: editing ? (editMeta.manualFloorPrice === "" ? null : Number(editMeta.manualFloorPrice)) : sel?.manualFloorPrice, roundingUnit: editing ? Number(editMeta.roundingUnit || 1000) : sel?.roundingUnit }))
    : (sel ? Number(sel.floorPrice) : 0);
  const md = maxDiscount(data.standardPrice, previewFloor);
  const belowFloor = data.standardPrice + 1e-6 < previewFloor;

  return (
    <div>
      <Link href="/price-floor" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Danh sách giá sàn</Link>
      <PageHeader title={`Giá sàn — ${data.serviceName}`} description={`${data.serviceCode}${data.category ? " · " + data.category : ""} · Giá chuẩn ${formatCurrency(data.standardPrice)}`}
        action={canWrite && !editing && <Button onClick={createVersion}><Plus className="h-4 w-4" /> Tạo version mới</Button>} />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {!fin && <p className="mb-3 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700">Bạn chỉ xem được giá sàn & cảnh báo (không có quyền tài chính để xem chi tiết chi phí/biên).</p>}

      {/* PH2 — Tạo Giá sàn từ Giá vốn đã phát hành (khuyến nghị). */}
      {canWrite && fin && !editing && (
        <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="text-sm font-medium">Tạo giá sàn từ Giá vốn (khuyến nghị)</div>
          <div className="space-y-1"><Label className="text-xs">Version giá vốn (đã phát hành)</Label>
            <Select className="h-8" value={costForm.costingId} onChange={(e) => setCostForm({ ...costForm, costingId: e.target.value })}>
              <option value="">— Chọn —</option>
              {(data.publishedCostings ?? []).map((c: any) => <option key={c.id} value={c.id}>Giá vốn v{c.version}{c.totalEstimatedCost != null ? ` · ${formatCurrency(c.totalEstimatedCost)}` : ""}</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Biên tối thiểu (%)</Label><Input className="h-8 w-24" type="number" value={costForm.margin} onChange={(e) => setCostForm({ ...costForm, margin: e.target.value })} /></div>
          <Button size="sm" onClick={createFromCosting} disabled={!costForm.costingId}><Plus className="h-3.5 w-3.5" /> Tạo từ Giá vốn</Button>
          {(data.publishedCostings ?? []).length === 0 && <span className="text-xs text-amber-600">Dịch vụ chưa có Giá vốn phát hành. <Link href={`/services/${serviceId}/costing`} className="text-primary hover:underline">Thiết lập Giá vốn</Link></span>}
          <Link href={`/services/${serviceId}/costing`} className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Xem Giá vốn</Link>
        </CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Cột trái: danh sách version */}
        <Card><CardContent className="p-0">
          <div className="border-b px-3 py-2 text-sm font-medium">Phiên bản ({data.versions.length})</div>
          <div className="divide-y">
            {data.versions.length === 0 && <div className="p-3 text-sm text-muted-foreground">Chưa có version. Bấm &quot;Tạo version mới&quot; để tự dựng chi phí từ dịch vụ.</div>}
            {data.versions.map((v: any) => (
              <button key={v.id} onClick={() => { setEditLines(null); setSelId(v.id); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/40 ${selId === v.id ? "bg-muted/60" : ""}`}>
                <div>
                  <div className="font-medium">V{v.version} · <span className="text-primary">{formatCurrency(Number(v.floorPrice))}</span></div>
                  <div className="text-xs text-muted-foreground">{v.effectiveFrom ? `Từ ${formatDate(v.effectiveFrom)}` : "chưa áp dụng"}{v.costSource === "COSTING_VERSION" ? " · từ Giá vốn" : ""}</div>
                </div>
                <Badge tone={FLOOR_VERSION_STATUS_TONE[v.status] ?? "muted"}>{FLOOR_VERSION_STATUS_LABEL[v.status] ?? v.status}</Badge>
              </button>
            ))}
          </div>
        </CardContent></Card>

        {/* Cột phải: chi tiết version */}
        {!sel ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Chọn một version để xem chi tiết.</CardContent></Card> : (
          <div className="space-y-4">
            {/* Thanh hành động + trạng thái */}
            <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">
              <Badge tone={FLOOR_VERSION_STATUS_TONE[sel.status] ?? "muted"}>{FLOOR_VERSION_STATUS_LABEL[sel.status] ?? sel.status}</Badge>
              <span className="text-sm text-muted-foreground">V{sel.version}</span>
              {sel.approvedBy && <span className="text-xs text-muted-foreground">· Duyệt: {sel.approvedBy}{sel.approvedAt ? " · " + formatDate(sel.approvedAt) : ""}</span>}
              <div className="ml-auto flex flex-wrap gap-2">
                {canWrite && !editing && (sel.status === "DRAFT" || sel.status === "PENDING_APPROVAL") && <Button size="sm" variant="outline" onClick={startEdit}>Sửa chi phí</Button>}
                {editing && <><Button size="sm" variant="outline" onClick={() => setEditLines(null)}>Hủy sửa</Button><Button size="sm" onClick={saveEdit}><Save className="h-3.5 w-3.5" /> Lưu</Button></>}
                {canWrite && !editing && sel.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => transition("submit")}><Send className="h-3.5 w-3.5" /> Gửi duyệt</Button>}
                {canApprove && !editing && sel.status === "PENDING_APPROVAL" && <Button size="sm" variant="outline" onClick={() => transition("approve")}><CheckCircle2 className="h-3.5 w-3.5" /> Duyệt</Button>}
                {canApprove && !editing && sel.status === "APPROVED" && <Button size="sm" onClick={() => transition("activate")}><Play className="h-3.5 w-3.5" /> Áp dụng</Button>}
                {canWrite && !editing && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(sel.status) && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Hủy version này?")) transition("cancel", { reason: "Hủy thủ công" }); }}><Ban className="h-3.5 w-3.5" /> Hủy</Button>}
              </div>
            </CardContent></Card>

            {/* Cấu hình margin/method (sửa được khi editing) */}
            <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">Phương pháp</Label>
                {editing ? <Select className="h-8" value={editMeta.method} onChange={(e) => setEditMeta({ ...editMeta, method: e.target.value })}>{Object.keys(FLOOR_METHOD_LABEL).map((m) => <option key={m} value={m}>{FLOOR_METHOD_LABEL[m]}</option>)}</Select> : <div className="text-sm">{FLOOR_METHOD_LABEL[sel.method]}</div>}
              </div>
              <div className="space-y-1"><Label className="text-xs">Biên tối thiểu (%)</Label>
                {editing ? <Input className="h-8" type="number" value={editMeta.minMarginPercent} onChange={(e) => setEditMeta({ ...editMeta, minMarginPercent: e.target.value })} /> : <div className="text-sm">{fin ? `${Number(sel.minMarginPercent ?? 0)}%` : "•••"}</div>}
              </div>
              {(editing ? editMeta.method : sel.method) === "MANUAL" && <div className="space-y-1"><Label className="text-xs">Giá sàn nhập tay</Label>{editing ? <Input className="h-8" type="number" value={editMeta.manualFloorPrice} onChange={(e) => setEditMeta({ ...editMeta, manualFloorPrice: e.target.value })} /> : <div className="text-sm">{formatCurrency(Number(sel.manualFloorPrice ?? 0))}</div>}</div>}
              <div className="space-y-1"><Label className="text-xs">Làm tròn (đ)</Label>{editing ? <Input className="h-8" type="number" value={editMeta.roundingUnit} onChange={(e) => setEditMeta({ ...editMeta, roundingUnit: e.target.value })} /> : <div className="text-sm">{sel.roundingUnit}</div>}</div>
              {editing && <div className="space-y-1 sm:col-span-4"><Label className="text-xs">Lý do thay đổi (version)</Label><Input className="h-8" value={editMeta.changeReason} onChange={(e) => setEditMeta({ ...editMeta, changeReason: e.target.value })} placeholder="VD: giá gel tăng, phí master tăng..." /></div>}
              {!editing && sel.changeReason && <div className="space-y-1 sm:col-span-4"><Label className="text-xs">Lý do thay đổi</Label><div className="text-sm text-muted-foreground">{sel.changeReason}</div></div>}
            </CardContent></Card>

            {/* PH2 — version từ Giá vốn: breakdown là snapshot read-only, dẫn sang màn Giá vốn để sửa. */}
            {fin && isCosting && (
              <Card><CardContent className="p-3 text-xs text-muted-foreground">
                Chi phí cấu thành lấy SNAPSHOT từ <b>Giá vốn</b> (bất biến). Sửa chi phí ở màn Giá vốn.
                <Link href={`/services/${serviceId}/costing`} className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Xem Giá vốn</Link>
              </CardContent></Card>
            )}

            {/* Cost breakdown A–F (chỉ finance.read; version line-based) */}
            {fin && !isCosting ? (
              <>
                {CAT_BLOCK.map(({ key, letter }) => {
                  const lines = previewLines.map((l: any, i: number) => ({ ...l, _i: i })).filter((l: any) => l.category === key);
                  const catTotal = cost ? cost.byCategory[key as keyof typeof cost.byCategory] : 0;
                  if (!editing && lines.length === 0) return null;
                  return (
                    <Card key={key}><CardContent className="p-0">
                      <div className="flex items-center justify-between border-b px-4 py-2"><div className="text-sm font-medium">{letter}. {COST_CATEGORY_LABEL[key]}</div><div className="text-sm font-medium">{formatCurrency(catTotal)}</div></div>
                      <div className="overflow-x-auto p-2">
                        <table className="w-full text-xs">
                          <thead className="text-muted-foreground"><tr className="border-b"><th className="p-1 text-left">Tên</th><th className="p-1 text-right">SL</th><th className="p-1">ĐVT</th><th className="p-1 text-right">Đơn giá</th><th className="p-1">Cách tính</th><th className="p-1 text-right">Thành tiền</th><th className="p-1">Nguồn</th>{editing && <th></th>}</tr></thead>
                          <tbody>
                            {lines.length === 0 ? <tr><td colSpan={editing ? 8 : 7} className="p-2 text-center text-muted-foreground">—</td></tr> : lines.map((l: any) => (
                              <tr key={l._i} className="border-b last:border-0">
                                <td className="p-1">{editing ? <Input className="h-7 text-xs" value={l.name} onChange={(e) => updateLine(l._i, "name", e.target.value)} /> : l.name}</td>
                                <td className="p-1 text-right">{editing ? <Input className="h-7 w-14 text-xs" type="number" value={l.quantity} onChange={(e) => updateLine(l._i, "quantity", e.target.value)} /> : Number(l.quantity)}</td>
                                <td className="p-1">{editing ? <Input className="h-7 w-14 text-xs" value={l.unit ?? ""} onChange={(e) => updateLine(l._i, "unit", e.target.value)} /> : l.unit}</td>
                                <td className="p-1 text-right">{editing ? <Input className="h-7 w-24 text-xs" type="number" value={l.unitCost} onChange={(e) => updateLine(l._i, "unitCost", e.target.value)} /> : formatCurrency(Number(l.unitCost))}</td>
                                <td className="p-1">{editing ? <Select className="h-7 text-xs" value={l.calcType} onChange={(e) => updateLine(l._i, "calcType", e.target.value)}>{CALC_TYPES.map((t) => <option key={t} value={t}>{COST_CALC_TYPE_LABEL[t]}</option>)}</Select> : COST_CALC_TYPE_LABEL[l.calcType]}{(l.calcType === "PERCENT_DIRECT" || l.calcType === "PER_MINUTE" || l.calcType === "PER_DURATION") && editing && <Input className="mt-1 h-7 text-xs" type="number" placeholder={l.calcType === "PERCENT_DIRECT" ? "%" : "rate"} value={l.calcValue ?? ""} onChange={(e) => updateLine(l._i, "calcValue", e.target.value)} />}</td>
                                <td className="p-1 text-right font-medium">{cost ? formatCurrency(cost.lineAmounts[l._i]) : "—"}</td>
                                <td className="p-1 text-muted-foreground">{l.source ?? "—"}</td>
                                {editing && <td className="p-1"><Button size="icon" variant="ghost" onClick={() => removeLine(l._i)}><Trash2 className="h-3.5 w-3.5" /></Button></td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {editing && <Button size="sm" variant="ghost" className="mt-1" onClick={() => addLine(key)}><Plus className="h-3.5 w-3.5" /> Thêm dòng {COST_CATEGORY_LABEL[key]}</Button>}
                      </div>
                    </CardContent></Card>
                  );
                })}
              </>
            ) : null}

            {/* G. Tổng hợp & công thức */}
            <Card><CardContent className="space-y-2 p-4">
              <div className="text-sm font-medium">G. Tổng hợp &amp; công thức</div>
              {fin && cost && <div className="grid gap-1 text-sm sm:grid-cols-2">
                {COST_CATEGORIES.map((c) => (<div key={c} className="flex justify-between"><span className="text-muted-foreground">{COST_CATEGORY_LABEL[c]}</span><span>{formatCurrency(cost.byCategory[c as keyof typeof cost.byCategory])}</span></div>))}
              </div>}
              <div className="flex justify-between border-t pt-2 text-sm"><span className="font-medium">Tổng giá vốn dự kiến</span><span className="font-semibold">{fin && cost ? formatCurrency(cost.totalCost) : "•••"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Công thức</span><span className="text-xs text-muted-foreground">{previewMethod === "MARGIN" ? `Giá sàn = giá vốn / (1 − ${previewMargin}%)` : previewMethod === "MARKUP" ? `Giá sàn = giá vốn × (1 + ${previewMargin}%)` : "Giá sàn nhập tay"}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-medium">Giá sàn</span><span className="text-lg font-semibold text-primary">{formatCurrency(previewFloor)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Giá chuẩn</span><span className={belowFloor ? "font-medium text-destructive" : ""}>{formatCurrency(data.standardPrice)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Chiết khấu tối đa</span><span>{formatCurrency(md.amount)} <span className="text-xs text-muted-foreground">({md.percent}%)</span></span></div>
              {belowFloor && <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-700">⚠ Giá chuẩn hiện THẤP HƠN giá sàn — cần điều chỉnh giá chuẩn hoặc chi phí.</div>}
            </CardContent></Card>

            <div className="text-xs text-muted-foreground">Tạo bởi {sel.createdBy ?? "—"} · {formatDateTime(sel.createdAt)}</div>
          </div>
        )}
      </div>
    </div>
  );

  function updateLine(i: number, field: string, value: any) { setEditLines((prev) => prev!.map((l, idx) => idx === i ? { ...l, [field]: value } : l)); }
  function removeLine(i: number) { setEditLines((prev) => prev!.filter((_, idx) => idx !== i)); }
  function addLine(category: string) { setEditLines((prev) => [...prev!, { category, name: "", quantity: 1, unit: "", unitCost: 0, calcType: category === "OPERATION" ? "PERCENT_DIRECT" : "FIXED", calcValue: null, minutes: null, required: true, source: "Nhập tay" }]); }
}
