"use client";
import { useEffect, useState } from "react";
import { Plus, Archive, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { useOpenNew } from "@/lib/use-open-new";
import { PERMISSIONS } from "@/lib/rbac";
import { PRICE_TYPE_LABEL, PRICE_TARGET_LABEL } from "@/lib/clinic-labels";

interface Rule {
  id: string; targetType: string; targetId: string; targetName?: string | null;
  priceType: string; branch?: string | null; price: string | number;
  effectiveFrom?: string | null; effectiveTo?: string | null; campaign?: string | null;
  version: number; isActive: boolean; createdAt: string;
}
const TARGET_TYPES = ["SERVICE", "PRODUCT", "TECHNOLOGY", "PACKAGE"];
const PRICE_TYPES = ["STANDARD", "BRANCH", "MEMBER", "VIP", "CAMPAIGN", "CUSTOM"];
const ENTITY_ENDPOINT: Record<string, string> = { SERVICE: "/api/services", PRODUCT: "/api/spa-products", TECHNOLOGY: "/api/technologies" };

export default function PricingPage() {
  const canWrite = useCan(PERMISSIONS.PRICE_WRITE);
  const [rows, setRows] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState<any>({ targetType: "SERVICE", targetId: "", targetName: "", priceType: "STANDARD", price: "", branch: "", campaign: "", effectiveFrom: "", effectiveTo: "", supersedesId: "" });

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("targetType", typeFilter);
      if (showAll) qs.set("all", "1");
      setRows(await apiFetch<Rule[]>(`/api/price-rules?${qs.toString()}`));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, showAll]);
  useEffect(() => {
    Object.entries(ENTITY_ENDPOINT).forEach(([t, url]) => apiFetch<any[]>(url).then((r) => setEntities((e) => ({ ...e, [t]: r }))).catch(() => {}));
  }, []);

  function openCreate(supersede?: Rule) {
    setError(null);
    if (supersede) {
      setForm({ targetType: supersede.targetType, targetId: supersede.targetId, targetName: supersede.targetName ?? "", priceType: supersede.priceType, price: "", branch: supersede.branch ?? "", campaign: supersede.campaign ?? "", effectiveFrom: "", effectiveTo: "", supersedesId: supersede.id });
    } else {
      setForm({ targetType: "SERVICE", targetId: "", targetName: "", priceType: "STANDARD", price: "", branch: "", campaign: "", effectiveFrom: "", effectiveTo: "", supersedesId: "" });
    }
    setOpen(true);
  }
  useOpenNew(() => openCreate(), canWrite); // ?new=1 → tự mở form Thêm giá

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form, price: Number(form.price) };
      ["branch", "campaign", "effectiveFrom", "effectiveTo", "supersedesId", "targetName"].forEach((k) => { if (!body[k]) delete body[k]; });
      await apiFetch("/api/price-rules", { method: "POST", body: JSON.stringify(body) });
      setOpen(false); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function archive(id: string) {
    await apiFetch(`/api/price-rules/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  function pickTarget(id: string) {
    const ent = (entities[form.targetType] ?? []).find((x) => x.id === id);
    setForm((f: any) => ({ ...f, targetId: id, targetName: ent?.name ?? "" }));
  }

  return (
    <div>
      <PageHeader
        title="Bảng giá (có version)"
        description="Giá theo dịch vụ/sản phẩm/công nghệ, theo chi nhánh/thành viên/khuyến mãi, có hiệu lực theo ngày. Đổi giá không ghi đè lịch sử."
        action={canWrite && <Button onClick={() => openCreate()}><Plus className="h-4 w-4" /> Thêm giá</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tất cả đối tượng</option>
          {TARGET_TYPES.map((t) => <option key={t} value={t}>{PRICE_TARGET_LABEL[t]}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Xem cả lịch sử (đã archive)</label>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Đối tượng</TH><TH>Loại giá</TH><TH className="text-right">Giá</TH><TH>Hiệu lực</TH><TH>CN/KM</TH><TH>Ver</TH><TH>Trạng thái</TH>{canWrite && <TH></TH>}</TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có bảng giá</TD></TR>
              ) : (
                rows.map((r) => (
                  <TR key={r.id} className={!r.isActive ? "opacity-50" : ""}>
                    <TD><span className="text-xs text-muted-foreground">{PRICE_TARGET_LABEL[r.targetType]}</span><div className="font-medium">{r.targetName ?? r.targetId}</div></TD>
                    <TD><Badge tone={r.priceType === "STANDARD" ? "muted" : r.priceType === "CAMPAIGN" ? "warning" : "default"}>{PRICE_TYPE_LABEL[r.priceType]}</Badge></TD>
                    <TD className="text-right font-medium">{formatNumber(Number(r.price))} ₫</TD>
                    <TD className="text-xs">{r.effectiveFrom ? formatDate(r.effectiveFrom) : "—"} → {r.effectiveTo ? formatDate(r.effectiveTo) : "∞"}</TD>
                    <TD className="text-xs">{[r.branch, r.campaign].filter(Boolean).join(" · ") || "—"}</TD>
                    <TD>v{r.version}</TD>
                    <TD><Badge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Hiệu lực" : "Lưu trữ"}</Badge></TD>
                    {canWrite && (
                      <TD>
                        {r.isActive && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => openCreate(r)} title="Đổi giá (tạo bản mới)"><RefreshCw className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => archive(r.id)} title="Ngừng hiệu lực"><Archive className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </TD>
                    )}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={form.supersedesId ? "Đổi giá (bản mới)" : "Thêm bảng giá"}>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đối tượng</Label>
              <Select value={form.targetType} disabled={!!form.supersedesId} onChange={(e) => setForm({ ...form, targetType: e.target.value, targetId: "", targetName: "" })}>
                {TARGET_TYPES.map((t) => <option key={t} value={t}>{PRICE_TARGET_LABEL[t]}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Loại giá</Label>
              <Select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value })}>
                {PRICE_TYPES.map((t) => <option key={t} value={t}>{PRICE_TYPE_LABEL[t]}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mục *</Label>
            {ENTITY_ENDPOINT[form.targetType] ? (
              <Select value={form.targetId} disabled={!!form.supersedesId} onChange={(e) => pickTarget(e.target.value)} required>
                <option value="">— Chọn —</option>
                {(entities[form.targetType] ?? []).map((ent) => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
              </Select>
            ) : (
              <Input value={form.targetName} onChange={(e) => setForm({ ...form, targetName: e.target.value, targetId: e.target.value })} placeholder="Tên gói" required />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Giá (₫) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Chi nhánh</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Hiệu lực từ</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Đến</Label><Input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Chương trình KM</Label><Input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></div>
          {form.supersedesId && <p className="text-xs text-amber-600">Tạo bản giá mới sẽ lưu trữ bản giá đang áp (giữ lịch sử).</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
