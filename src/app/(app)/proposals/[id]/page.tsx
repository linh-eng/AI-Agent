"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  PROPOSAL_KIND_LABEL,
  PROPOSAL_ITEM_TYPE_LABEL,
} from "@/lib/clinic-labels";

const KINDS = ["ESSENTIAL", "RECOMMENDED", "PREMIUM", "CUSTOM"];
const ITEM_TYPES = ["SERVICE", "TECHNOLOGY", "BRAND_PROTOCOL", "PRODUCT", "CUSTOM"];

function optionTotal(o: any): number {
  const sub = (o.items ?? []).reduce((s: number, it: any) => s + Number(it.unitPrice || 0) * (it.quantity || 1), 0);
  return Math.max(0, sub - Number(o.discount || 0));
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PROPOSAL_WRITE);
  const canAccept = useCan(PERMISSIONS.PROPOSAL_ACCEPT);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);

  const [p, setP] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [entities, setEntities] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/proposals/${id}`);
      setP(data);
      setOptions(data.options ?? []);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<any[]>("/api/services").then((r) => setEntities((e) => ({ ...e, SERVICE: r }))).catch(() => {});
    apiFetch<any[]>("/api/technologies").then((r) => setEntities((e) => ({ ...e, TECHNOLOGY: r }))).catch(() => {});
    apiFetch<any[]>("/api/brand-protocols").then((r) => setEntities((e) => ({ ...e, BRAND_PROTOCOL: r }))).catch(() => {});
    apiFetch<any[]>("/api/spa-products").then((r) => setEntities((e) => ({ ...e, PRODUCT: r }))).catch(() => {});
  }, []);

  const accepted = p?.status === "ACCEPTED";
  const editable = canWrite && !accepted;

  function mutate(fn: (opts: any[]) => void) {
    setOptions((prev) => { const copy = JSON.parse(JSON.stringify(prev)); fn(copy); return copy; });
  }
  const addOption = () => mutate((o) => o.push({ kind: "CUSTOM", name: `Phương án ${o.length + 1}`, discount: 0, items: [] }));
  const addItem = (oi: number) => mutate((o) => o[oi].items.push({ itemType: "SERVICE", name: "", quantity: 1, unitPrice: 0, isHomeCare: false }));

  function pickEntity(oi: number, ii: number, refId: string) {
    mutate((o) => {
      const it = o[oi].items[ii];
      const list = entities[it.itemType] ?? [];
      const ent = list.find((x) => x.id === refId);
      it.refId = refId;
      if (ent) {
        it.name = ent.name;
        const price = ent.standardPrice ?? ent.sellingPrice;
        if (price != null) it.unitPrice = Number(price);
        if (ent.cost != null) it.unitCost = Number(ent.cost);
        if (ent.expectedCost != null) it.unitCost = Number(ent.expectedCost);
        if (it.itemType === "PRODUCT") it.isHomeCare = ent.productType === "HOME_CARE";
      }
    });
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify({ options }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }
  async function setStatus(status: string) {
    try { await apiFetch(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!p) return <p className="text-destructive">Không tìm thấy báo giá.</p>;

  return (
    <div>
      <Link href="/proposals" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách báo giá
      </Link>
      <PageHeader
        title={p.title}
        description={`${p.code} · Khách: ${p.customer.fullName}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
            {editable && <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu"}</Button>}
            {canWrite && p.status === "DRAFT" && <Button variant="outline" onClick={() => setStatus("SENT")}><Send className="h-4 w-4" /> Gửi khách</Button>}
            {canAccept && !accepted && <Button variant="outline" onClick={() => setAcceptOpen(true)}><CheckCircle2 className="h-4 w-4" /> Khách chốt</Button>}
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {accepted && (
        <Card className="mb-4 border-emerald-500/40">
          <CardContent className="p-4 text-sm">
            <div className="font-medium text-emerald-700">✓ Khách đã chốt phương án</div>
            <div className="mt-1 text-muted-foreground">
              {p.acceptedSnapshot?.name} · Giá thống nhất <span className="font-semibold text-foreground">{formatNumber(Number(p.agreedPrice ?? 0))} ₫</span>
              {p.acceptedBy ? ` · bởi ${p.acceptedBy}` : ""}{p.acceptedAt ? ` · ${formatDate(p.acceptedAt)}` : ""}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Snapshot đã đông cứng — thay đổi bảng giá/catalog về sau không ảnh hưởng báo giá này.</p>
          </CardContent>
        </Card>
      )}

      {/* So sánh phương án cạnh nhau */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {options.map((o, oi) => (
          <Card key={oi} className="w-80 flex-shrink-0">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                {editable ? (
                  <Select className="h-8 w-32" value={o.kind} onChange={(e) => mutate((x) => (x[oi].kind = e.target.value))}>
                    {KINDS.map((k) => <option key={k} value={k}>{PROPOSAL_KIND_LABEL[k]}</option>)}
                  </Select>
                ) : <Badge>{PROPOSAL_KIND_LABEL[o.kind]}</Badge>}
                {editable && <Button size="icon" variant="ghost" className="ml-auto" onClick={() => mutate((x) => x.splice(oi, 1))}><Trash2 className="h-4 w-4" /></Button>}
              </div>
              {editable ? <Input value={o.name} onChange={(e) => mutate((x) => (x[oi].name = e.target.value))} /> : <div className="font-medium">{o.name}</div>}

              <div className="space-y-2">
                {(o.items ?? []).map((it: any, ii: number) => (
                  <div key={ii} className="rounded border p-2 text-xs">
                    {editable ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-1">
                          <Select className="h-7 text-xs" value={it.itemType} onChange={(e) => mutate((x) => { x[oi].items[ii].itemType = e.target.value; x[oi].items[ii].refId = ""; })}>
                            {ITEM_TYPES.map((t) => <option key={t} value={t}>{PROPOSAL_ITEM_TYPE_LABEL[t]}</option>)}
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => mutate((x) => x[oi].items.splice(ii, 1))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                        {it.itemType !== "CUSTOM" && (entities[it.itemType]?.length ?? 0) > 0 && (
                          <Select className="h-7 text-xs" value={it.refId ?? ""} onChange={(e) => pickEntity(oi, ii, e.target.value)}>
                            <option value="">— chọn để tự điền —</option>
                            {(entities[it.itemType] ?? []).map((ent) => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                          </Select>
                        )}
                        <Input className="h-7 text-xs" placeholder="Tên hạng mục" value={it.name} onChange={(e) => mutate((x) => (x[oi].items[ii].name = e.target.value))} />
                        <div className="flex gap-1">
                          <Input className="h-7 w-14 text-xs" type="number" title="SL" value={it.quantity} onChange={(e) => mutate((x) => (x[oi].items[ii].quantity = Number(e.target.value)))} />
                          <Input className="h-7 flex-1 text-xs" type="number" title="Đơn giá" value={it.unitPrice ?? ""} onChange={(e) => mutate((x) => (x[oi].items[ii].unitPrice = Number(e.target.value)))} />
                        </div>
                        {canFinance && <Input className="h-7 text-xs" type="number" placeholder="Giá vốn (nội bộ)" value={it.unitCost ?? ""} onChange={(e) => mutate((x) => (x[oi].items[ii].unitCost = Number(e.target.value)))} />}
                        <label className="flex items-center gap-1 text-xs"><Checkbox checked={!!it.isHomeCare} onChange={(e) => mutate((x) => (x[oi].items[ii].isHomeCare = e.target.checked))} /> Sản phẩm tại nhà</label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span>{it.name} {it.quantity > 1 ? `×${it.quantity}` : ""}{it.isHomeCare ? " (tại nhà)" : ""}</span>
                        <span className="font-medium">{formatNumber(Number(it.unitPrice || 0) * (it.quantity || 1))} ₫</span>
                      </div>
                    )}
                  </div>
                ))}
                {editable && <Button size="sm" variant="ghost" onClick={() => addItem(oi)}><Plus className="h-4 w-4" /> Hạng mục</Button>}
              </div>

              <div className="space-y-1 border-t pt-2 text-sm">
                {editable && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Chiết khấu</span>
                    <Input className="h-7 w-28 text-right text-xs" type="number" value={o.discount ?? ""} onChange={(e) => mutate((x) => (x[oi].discount = Number(e.target.value)))} />
                  </div>
                )}
                {o.sessions != null && <div className="flex justify-between text-xs text-muted-foreground"><span>Số buổi</span><span>{o.sessions}</span></div>}
                <div className="flex justify-between font-semibold">
                  <span>Tổng</span><span className="text-primary">{formatNumber(optionTotal(o))} ₫</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {editable && (
          <button onClick={addOption} className="flex h-auto w-40 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> Thêm phương án
          </button>
        )}
      </div>

      <AcceptModal
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        options={options.filter((o) => o.id)}
        onSubmit={async (body) => {
          setError(null);
          try { await apiFetch(`/api/proposals/${id}/accept`, { method: "POST", body: JSON.stringify(body) }); setAcceptOpen(false); load(); }
          catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
        }}
      />
    </div>
  );
}

function AcceptModal({ open, onClose, options, onSubmit }: { open: boolean; onClose: () => void; options: any[]; onSubmit: (b: any) => void }) {
  const [optionId, setOptionId] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");
  const sel = options.find((o) => o.id === optionId);
  const suggested = sel ? optionTotal(sel) : 0;
  return (
    <Modal open={open} onClose={onClose} title="Khách chốt phương án">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ optionId, agreedPrice: agreedPrice ? Number(agreedPrice) : undefined, acceptedBy: acceptedBy || undefined }); }} className="space-y-4">
        <p className="text-xs text-muted-foreground">Lưu ý: chốt xong sẽ đông cứng snapshot, không sửa được phương án nữa. Cần lưu các thay đổi trước khi chốt.</p>
        <div className="space-y-1.5">
          <Label>Phương án khách chọn *</Label>
          <Select value={optionId} onChange={(e) => { setOptionId(e.target.value); const o = options.find((x) => x.id === e.target.value); setAgreedPrice(o ? String(optionTotal(o)) : ""); }} required>
            <option value="">— Chọn —</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name} · {formatNumber(optionTotal(o))} ₫</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Giá thống nhất</Label><Input type="number" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} placeholder={String(suggested)} /></div>
          <div className="space-y-1.5"><Label>Người xác nhận</Label><Input value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={!optionId}>Xác nhận chốt</Button></div>
      </form>
    </Modal>
  );
}
