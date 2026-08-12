"use client";
import { useEffect, useState } from "react";
import { Plus, Boxes, AlertTriangle, Clock, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { CONTAINER_STATUS_LABEL, CONTAINER_STATUS_TONE } from "@/lib/clinic-labels";

export default function MaterialsPage() {
  const canWrite = useCan(PERMISSIONS.MATERIAL_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [dash, setDash] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matOpen, setMatOpen] = useState(false);
  const [contOpen, setContOpen] = useState(false);
  const [consume, setConsume] = useState<any>(null);
  const [matForm, setMatForm] = useState({ name: "", unit: "", category: "", expectedPerSession: "", lowThreshold: "" });
  const [contForm, setContForm] = useState({ usageMaterialId: "", containerNo: "", initialQty: "", costSnapshot: "", openedAt: "", expiryDate: "" });
  const [cForm, setCForm] = useState({ quantity: "", note: "" });

  async function load() {
    setLoading(true);
    try {
      setDash(await apiFetch("/api/materials/dashboard").catch(() => null));
      setMaterials(await apiFetch<any[]>("/api/usage-materials"));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const containers = materials.flatMap((m) => m.containers.map((c: any) => ({ ...c, materialName: m.name })));

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const body: any = { name: matForm.name, unit: matForm.unit };
      if (matForm.category) body.category = matForm.category;
      if (matForm.expectedPerSession) body.expectedPerSession = Number(matForm.expectedPerSession);
      if (matForm.lowThreshold) body.lowThreshold = Number(matForm.lowThreshold);
      await apiFetch("/api/usage-materials", { method: "POST", body: JSON.stringify(body) });
      setMatOpen(false); setMatForm({ name: "", unit: "", category: "", expectedPerSession: "", lowThreshold: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function addContainer(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const body: any = { usageMaterialId: contForm.usageMaterialId, containerNo: contForm.containerNo, initialQty: Number(contForm.initialQty) };
      if (contForm.costSnapshot) body.costSnapshot = Number(contForm.costSnapshot);
      if (contForm.openedAt) body.openedAt = contForm.openedAt;
      if (contForm.expiryDate) body.expiryDate = contForm.expiryDate;
      await apiFetch("/api/material-containers", { method: "POST", body: JSON.stringify(body) });
      setContOpen(false); setContForm({ usageMaterialId: "", containerNo: "", initialQty: "", costSnapshot: "", openedAt: "", expiryDate: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function doConsume(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await apiFetch("/api/material-usages", { method: "POST", body: JSON.stringify({ source: "SHARED_STOCK", containerId: consume.id, quantity: Number(cForm.quantity), note: cForm.note || null }) });
      setConsume(null); setCForm({ quantity: "", note: "" }); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function dispose(id: string) {
    try { await apiFetch(`/api/material-containers/${id}`, { method: "PATCH", body: JSON.stringify({ dispose: true }) }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  const c = dash?.cards ?? {};
  const cards = [
    { icon: Boxes, label: "Đang sử dụng", value: c.inUse ?? 0 },
    { icon: PackageOpen, label: "Lọ đang mở", value: c.opened ?? 0 },
    { icon: AlertTriangle, label: "Sắp hết", value: c.low ?? 0, tone: "warning" },
    { icon: Clock, label: "Sắp hết hạn", value: c.expiringSoon ?? 0, tone: "warning" },
    { icon: Boxes, label: "Tiêu hao hôm nay", value: c.usedTodayCount ?? 0 },
    ...(canFinance ? [{ icon: Boxes, label: "Chi phí hôm nay", value: formatCurrency(c.usedTodayCost ?? 0) }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Kho vật tư sử dụng"
        description="Vật tư/sản phẩm chuyên môn dùng trong dịch vụ — theo lọ/chai/lô, dùng chung nhiều khách, nhiều buổi. Theo dõi tồn còn lại + chi phí."
        action={canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMatOpen(true)}><Plus className="h-4 w-4" /> Thêm vật tư</Button>
            <Button onClick={() => setContOpen(true)}><Plus className="h-4 w-4" /> Thêm lọ/lô</Button>
          </div>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((k, i) => (
          <Card key={i}><CardContent className="flex items-center gap-3 p-4">
            <k.icon className={`h-5 w-5 ${k.tone === "warning" ? "text-amber-500" : "text-primary"}`} />
            <div><div className="text-lg font-semibold leading-none">{k.value}</div><div className="mt-1 text-xs text-muted-foreground">{k.label}</div></div>
          </CardContent></Card>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lọ / lô đang có</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Vật tư</TH><TH>Lọ/Lô</TH><TH className="text-right">Còn / Ban đầu</TH>{canFinance && <TH className="text-right">Giá vốn lọ</TH>}<TH>Ngày mở</TH><TH>Hạn</TH><TH>Trạng thái</TH><TH></TH></TR></THead>
            <TBody>
              {loading ? <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
                : containers.length === 0 ? <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có lọ/lô nào. Bấm &quot;Thêm vật tư&quot; rồi &quot;Thêm lọ/lô&quot;.</TD></TR>
                : containers.map((ct) => (
                  <TR key={ct.id}>
                    <TD className="font-medium">{ct.materialName}</TD>
                    <TD className="font-mono text-sm">{ct.containerNo}</TD>
                    <TD className="text-right tabular-nums">{Number(ct.remainingQty)} / {Number(ct.initialQty)} {ct.unit}</TD>
                    {canFinance && <TD className="text-right text-muted-foreground">{ct.costSnapshot != null ? formatCurrency(ct.costSnapshot) : "—"}</TD>}
                    <TD className="text-muted-foreground">{ct.openedAt ? formatDate(ct.openedAt) : "—"}</TD>
                    <TD className="text-muted-foreground">{ct.expiryDate ? formatDate(ct.expiryDate) : "—"}</TD>
                    <TD><Badge tone={CONTAINER_STATUS_TONE[ct.status]}>{CONTAINER_STATUS_LABEL[ct.status]}</Badge></TD>
                    <TD>{canWrite && ct.status !== "DISPOSED" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setConsume(ct); setCForm({ quantity: "", note: "" }); }} disabled={ct.status === "EMPTY"}>Dùng</Button>
                        <Button size="sm" variant="ghost" onClick={() => dispose(ct.id)}>Hủy lọ</Button>
                      </div>
                    )}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={matOpen} onClose={() => setMatOpen(false)} title="Thêm vật tư dùng chung">
        <form onSubmit={addMaterial} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên vật tư *</Label><Input value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Đơn vị tiêu hao *</Label><Input value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} placeholder="ml, cái, lần..." required /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Nhóm</Label><Input value={matForm.category} onChange={(e) => setMatForm({ ...matForm, category: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Định mức/buổi</Label><Input type="number" value={matForm.expectedPerSession} onChange={(e) => setMatForm({ ...matForm, expectedPerSession: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ngưỡng sắp hết</Label><Input type="number" value={matForm.lowThreshold} onChange={(e) => setMatForm({ ...matForm, lowThreshold: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMatOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>

      <Modal open={contOpen} onClose={() => setContOpen(false)} title="Thêm lọ / lô">
        <form onSubmit={addContainer} className="space-y-4">
          <div className="space-y-1.5"><Label>Vật tư *</Label>
            <Select value={contForm.usageMaterialId} onChange={(e) => setContForm({ ...contForm, usageMaterialId: e.target.value })} required>
              <option value="">— Chọn vật tư —</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Mã lọ/lô *</Label><Input value={contForm.containerNo} onChange={(e) => setContForm({ ...contForm, containerNo: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Số lượng ban đầu *</Label><Input type="number" step="any" value={contForm.initialQty} onChange={(e) => setContForm({ ...contForm, initialQty: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Giá vốn cả lọ (₫)</Label><Input type="number" value={contForm.costSnapshot} onChange={(e) => setContForm({ ...contForm, costSnapshot: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ngày mở</Label><Input type="date" value={contForm.openedAt} onChange={(e) => setContForm({ ...contForm, openedAt: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hạn dùng</Label><Input type="date" value={contForm.expiryDate} onChange={(e) => setContForm({ ...contForm, expiryDate: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setContOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>

      <Modal open={!!consume} onClose={() => setConsume(null)} title={`Ghi nhận sử dụng — ${consume?.materialName ?? ""}`}>
        <form onSubmit={doConsume} className="space-y-4">
          <p className="text-sm text-muted-foreground">Lọ {consume?.containerNo} · còn lại <strong>{Number(consume?.remainingQty)} {consume?.unit}</strong></p>
          <div className="space-y-1.5"><Label>Số lượng sử dụng ({consume?.unit}) *</Label><Input type="number" step="any" value={cForm.quantity} onChange={(e) => setCForm({ ...cForm, quantity: e.target.value })} required autoFocus /></div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={cForm.note} onChange={(e) => setCForm({ ...cForm, note: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setConsume(null)}>Hủy</Button><Button type="submit">Ghi nhận</Button></div>
        </form>
      </Modal>
    </div>
  );
}
