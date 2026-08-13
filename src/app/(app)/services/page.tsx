"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X, ChevronDown, SlidersHorizontal, Search, Trash2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/clinic-labels";

/* ---------- types ---------- */
interface Service {
  id: string; code: string; name: string; status: string;
  durationMinutes?: number | null; standardPrice: string | number; expectedCost?: string | number | null;
  floorPrice?: number | null; technologyCount?: number; materialCount?: number;
  category?: { name: string } | null; categoryId?: string | null;
}
interface Cat { id: string; code: string; name: string; isActive?: boolean }
interface Tech { id: string; name: string; isActive?: boolean }
interface Proto { id: string; name: string; code: string; status?: string }
interface Resource { id: string; name: string; type: "ROOM" | "BED" | "MACHINE" }

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Hoạt động", PAUSED: "Tạm ngưng", ARCHIVED: "Lưu trữ" };
const STATUS_TONE: Record<string, "success" | "warning" | "muted"> = { ACTIVE: "success", PAUSED: "warning", ARCHIVED: "muted" };

/* ============================ Page ============================ */
export default function ServicesPage() {
  const canWrite = useCan(PERMISSIONS.SERVICE_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [rows, setRows] = useState<Service[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [protos, setProtos] = useState<Proto[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState({ categoryId: "", status: "", technology: "" });
  const [showFilter, setShowFilter] = useState(false);
  const [editing, setEditing] = useState<null | "new" | Service>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (filter.categoryId) p.set("categoryId", filter.categoryId);
      if (filter.status) p.set("status", filter.status);
      if (filter.technology) p.set("technology", filter.technology);
      setRows(await apiFetch<Service[]>(`/api/services${p.toString() ? `?${p}` : ""}`));
    } finally { setLoading(false); }
  }
  async function loadCats() { setCats(await apiFetch<Cat[]>("/api/service-categories").catch(() => [])); }
  useEffect(() => {
    load(); loadCats();
    apiFetch<Tech[]>("/api/technologies").then(setTechs).catch(() => {});
    apiFetch<Proto[]>("/api/brand-protocols").then(setProtos).catch(() => {});
    apiFetch<Resource[]>("/api/booking-resources?active=1").then(setResources).catch(() => {});
    apiFetch<any[]>("/api/spa-products").then(setProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFilterCount = Object.values(filter).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Dịch vụ"
        description="Dữ liệu nền cho Lịch hẹn / Phác đồ: thời lượng, công nghệ, protocol, nhân sự, vật tư định mức, giá & giá sàn."
        action={canWrite && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Thêm dịch vụ</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm theo tên, mã dịch vụ..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Button variant="outline" onClick={load}>Tìm</Button>
        <Button variant={activeFilterCount ? "default" : "outline"} onClick={() => setShowFilter((s) => !s)}>
          <SlidersHorizontal className="h-4 w-4" /> Bộ lọc{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      {showFilter && (
        <Card className="mb-4"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5"><Label>Nhóm dịch vụ</Label><Select value={filter.categoryId} onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}><option value="">— Tất cả —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Trạng thái</Label><Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">— Tất cả —</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Công nghệ</Label><Select value={filter.technology} onChange={(e) => setFilter({ ...filter, technology: e.target.value })}><option value="">— Tất cả —</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
          <div className="flex items-end gap-2"><Button onClick={load}>Áp dụng</Button><Button variant="ghost" onClick={() => { setFilter({ categoryId: "", status: "", technology: "" }); setTimeout(load, 0); }}><X className="h-4 w-4" /> Xóa lọc</Button></div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <Table>
          <THead><TR>
            <TH>Mã</TH><TH>Tên</TH><TH>Nhóm</TH><TH className="text-right">Thời lượng</TH>
            <TH className="text-right">Giá chuẩn</TH>
            {canFinance && <TH className="text-right">Giá vốn</TH>}
            {canFinance && <TH className="text-right">Giá sàn</TH>}
            <TH>Trạng thái</TH>
          </TR></THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={canFinance ? 8 : 6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
            ) : rows.length === 0 ? (
              <TR><TD colSpan={canFinance ? 8 : 6} className="py-8 text-center text-muted-foreground">Chưa có dịch vụ</TD></TR>
            ) : rows.map((s) => (
              <TR key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailId(s.id)}>
                <TD className="font-mono font-medium">{s.code}</TD>
                <TD className="font-medium">{s.name}{(s.technologyCount || s.materialCount) ? <span className="ml-1 text-xs text-muted-foreground">· {s.technologyCount || 0} CN · {s.materialCount || 0} VT</span> : null}</TD>
                <TD>{s.category?.name ?? "—"}</TD>
                <TD className="text-right">{s.durationMinutes ? `${s.durationMinutes}′` : "—"}</TD>
                <TD className="text-right">{formatNumber(Number(s.standardPrice))} ₫</TD>
                {canFinance && <TD className="text-right text-muted-foreground">{s.expectedCost != null ? formatNumber(Number(s.expectedCost)) + " ₫" : "—"}</TD>}
                {canFinance && <TD className="text-right text-muted-foreground">{s.floorPrice != null ? formatNumber(Number(s.floorPrice)) + " ₫" : "—"}</TD>}
                <TD><Badge tone={STATUS_TONE[s.status] ?? "muted"}>{STATUS_LABEL[s.status] ?? s.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div></CardContent></Card>

      {editing && (
        <ServiceFormModal
          service={editing === "new" ? null : editing}
          cats={cats} techs={techs} protos={protos} resources={resources} products={products}
          onClose={() => setEditing(null)} onCatCreated={loadCats}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {detailId && <ServiceDetailModal id={detailId} canFinance={canFinance} canWrite={canWrite} onClose={() => setDetailId(null)} onEdit={(s) => { setDetailId(null); setEditing(s); }} />}
    </div>
  );
}

/* ============================ Small selects ============================ */
function SearchSelect({ options, value, onChange, placeholder }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState("");
  const cur = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <div className="flex h-9 cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-2 text-sm" onClick={() => setOpen((o) => !o)}>
        <span className={`flex-1 truncate ${cur ? "" : "text-muted-foreground"}`}>{cur?.label || placeholder || "— Chọn —"}</span>
        {value && <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg">
          <input autoFocus className="mb-1 w-full rounded border border-input bg-card px-2 py-1 text-sm" placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
          {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-muted-foreground">Không có</div> :
            filtered.map((o) => <button key={o.value} type="button" className={`block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted ${o.value === value ? "bg-primary/10 text-primary" : ""}`} onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}>{o.label}</button>)}
        </div></>)}
    </div>
  );
}
function MultiPick({ options, values, onChange, placeholder }: { options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState("");
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()) && !values.includes(o.value));
  return (
    <div className="relative">
      <div className="flex min-h-9 cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-sm" onClick={() => setOpen(true)}>
        {values.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{label(v)}<button type="button" onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}><X className="h-3 w-3" /></button></span>)}
        {values.length === 0 && <span className="text-muted-foreground">{placeholder || "— Chọn —"}</span>}
      </div>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg">
          <input autoFocus className="mb-1 w-full rounded border border-input bg-card px-2 py-1 text-sm" placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
          {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-muted-foreground">Không có</div> :
            filtered.map((o) => <button key={o.value} type="button" className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { onChange([...values, o.value]); setQ(""); }}>{o.label}</button>)}
        </div></>)}
    </div>
  );
}

/* ============================ Form ============================ */
function Block({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">{letter}</span><h3 className="text-sm font-semibold">{title}</h3></div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ServiceFormModal({ service, cats, techs, protos, resources, products, onClose, onSaved, onCatCreated }: {
  service: Service | null; cats: Cat[]; techs: Tech[]; protos: Proto[]; resources: Resource[]; products: any[];
  onClose: () => void; onSaved: () => void; onCatCreated: () => void;
}) {
  const editing = !!service;
  const [f, setF] = useState<any>({
    name: "", categoryId: "", description: "", status: "ACTIVE",
    durationMinutes: "", machineMinutes: "", roomMinutes: "",
    standardPrice: "", expectedCost: "",
    technologyIds: [], protocolIds: [], defaultTechnologyId: "", defaultProtocolId: "",
    staffRequirements: [], resourceRequirements: { room: { required: false, default: "" }, bed: { required: false, default: "" }, machine: { required: false, default: "" } },
    materials: [],
  });
  const [floorSummary, setFloorSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catQuick, setCatQuick] = useState(false);
  const [catName, setCatName] = useState("");
  const [localCats, setLocalCats] = useState<Cat[]>(cats);
  useEffect(() => { setLocalCats(cats); }, [cats]);

  // Nạp chi tiết khi sửa.
  useEffect(() => {
    if (!service) return;
    apiFetch<any>(`/api/services/${service.id}`).then((d) => {
      setF({
        name: d.name ?? "", categoryId: d.categoryId ?? "", description: d.description ?? "", status: d.status ?? "ACTIVE",
        durationMinutes: d.durationMinutes ?? "", machineMinutes: d.machineMinutes ?? "", roomMinutes: d.roomMinutes ?? "",
        standardPrice: d.standardPrice ?? "", expectedCost: d.expectedCost ?? "",
        technologyIds: d.technologyIds ?? [], protocolIds: d.protocolIds ?? [],
        defaultTechnologyId: d.defaultTechnologyId ?? "", defaultProtocolId: d.defaultProtocolId ?? "",
        staffRequirements: d.staffRequirements ?? [],
        resourceRequirements: d.resourceRequirements ?? { room: { required: false, default: "" }, bed: { required: false, default: "" }, machine: { required: false, default: "" } },
        materials: (d.materialStandards ?? []).map((m: any) => ({ name: m.name, quantity: Number(m.quantity), unit: m.unit, note: m.note ?? "", required: m.required, spaProductId: m.spaProductId ?? "" })),
      });
      setFloorSummary(d.floorSummary ?? null);
    }).catch(() => {});
  }, [service]);

  const techOpts = techs.map((t) => ({ value: t.id, label: t.name }));
  const protoOpts = protos.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));
  const roomOpts = resources.filter((r) => r.type === "ROOM").map((r) => r.name);
  const bedOpts = resources.filter((r) => r.type === "BED").map((r) => r.name);
  const machineOpts = resources.filter((r) => r.type === "MACHINE").map((r) => r.name);

  async function quickCat(e: React.MouseEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      const c = await apiFetch<Cat>("/api/service-categories", { method: "POST", body: JSON.stringify({ name: catName.trim() }) });
      setLocalCats((s) => [...s, c]); setF((p: any) => ({ ...p, categoryId: c.id }));
      setCatName(""); setCatQuick(false); onCatCreated();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  function buildBody() {
    const body: any = {
      name: f.name, categoryId: f.categoryId || null, description: f.description || null, status: f.status,
      technologyIds: f.technologyIds, protocolIds: f.protocolIds,
      defaultTechnologyId: f.defaultTechnologyId || null, defaultProtocolId: f.defaultProtocolId || null,
      staffRequirements: f.staffRequirements,
      resourceRequirements: f.resourceRequirements,
      materials: f.materials.filter((m: any) => m.name && m.unit).map((m: any) => ({ name: m.name, quantity: Number(m.quantity) || 0, unit: m.unit, note: m.note || null, required: !!m.required, spaProductId: m.spaProductId || null })),
      standardPrice: Number(f.standardPrice) || 0,
    };
    ["durationMinutes", "machineMinutes", "roomMinutes", "expectedCost"].forEach((k) => { if (f[k] !== "" && f[k] != null) body[k] = Number(f[k]); });
    return body;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const body = buildBody();
      if (editing) await apiFetch(`/api/services/${service!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await apiFetch("/api/services", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Sửa dịch vụ ${service!.code}` : "Thêm dịch vụ"} className="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        {/* A. Thông tin cơ bản */}
        <Block letter="A" title="Thông tin cơ bản">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên dịch vụ *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label>Nhóm dịch vụ</Label>{!catQuick && <button type="button" className="text-xs text-primary hover:underline" onClick={() => setCatQuick(true)}>+ Tạo nhóm mới</button>}</div>
              {catQuick ? (
                <div className="flex gap-1">
                  <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Tên nhóm mới" autoFocus />
                  <Button type="button" size="sm" onClick={quickCat}>Lưu</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setCatQuick(false); setCatName(""); }}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <SearchSelect options={localCats.map((c) => ({ value: c.id, label: c.name }))} value={f.categoryId} onChange={(v) => setF({ ...f, categoryId: v })} placeholder="Chọn nhóm" />
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label>Mô tả</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5 w-48"><Label>Trạng thái</Label><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        </Block>

        {/* B. Thời gian & tài nguyên */}
        <Block letter="B" title="Thời gian & tài nguyên">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} placeholder="VD 60" /></div>
            <div className="space-y-1.5"><Label>Thời gian máy (phút)</Label><Input type="number" value={f.machineMinutes} onChange={(e) => setF({ ...f, machineMinutes: e.target.value })} placeholder="Bỏ trống = cả buổi" /></div>
            <div className="space-y-1.5"><Label>Thời gian phòng (phút)</Label><Input type="number" value={f.roomMinutes} onChange={(e) => setF({ ...f, roomMinutes: e.target.value })} placeholder="Tùy chọn" /></div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">Tài nguyên yêu cầu (bắt buộc / mặc định)</div>
          {(["room", "bed", "machine"] as const).map((key) => {
            const label = key === "room" ? "Phòng" : key === "bed" ? "Giường" : "Máy/thiết bị";
            const opts = key === "room" ? roomOpts : key === "bed" ? bedOpts : machineOpts;
            const rr = f.resourceRequirements[key] ?? { required: false, default: "" };
            return (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-40 items-center gap-2 text-sm"><Checkbox checked={rr.required} onChange={(e) => setF({ ...f, resourceRequirements: { ...f.resourceRequirements, [key]: { ...rr, required: e.target.checked } } })} /> {label} bắt buộc</label>
                <div className="flex-1"><Select value={rr.default ?? ""} onChange={(e) => setF({ ...f, resourceRequirements: { ...f.resourceRequirements, [key]: { ...rr, default: e.target.value } } })}><option value="">— Mặc định (tùy chọn) —</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</Select></div>
              </div>
            );
          })}
        </Block>

        {/* C. Chuyên môn */}
        <Block letter="C" title="Chuyên môn (công nghệ · protocol · nhân sự)">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Công nghệ liên quan</Label><MultiPick options={techOpts} values={f.technologyIds} onChange={(v) => setF({ ...f, technologyIds: v, defaultTechnologyId: v.includes(f.defaultTechnologyId) ? f.defaultTechnologyId : "" })} placeholder="Chọn công nghệ" /></div>
            <div className="space-y-1.5"><Label>Công nghệ mặc định</Label><Select value={f.defaultTechnologyId} onChange={(e) => setF({ ...f, defaultTechnologyId: e.target.value })} disabled={!f.technologyIds.length}><option value="">— Không —</option>{f.technologyIds.map((id: string) => <option key={id} value={id}>{techs.find((t) => t.id === id)?.name ?? id}</option>)}</Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Protocol liên quan</Label><MultiPick options={protoOpts} values={f.protocolIds} onChange={(v) => setF({ ...f, protocolIds: v, defaultProtocolId: v.includes(f.defaultProtocolId) ? f.defaultProtocolId : "" })} placeholder="Chọn protocol" /></div>
            <div className="space-y-1.5"><Label>Protocol mặc định</Label><Select value={f.defaultProtocolId} onChange={(e) => setF({ ...f, defaultProtocolId: e.target.value })} disabled={!f.protocolIds.length}><option value="">— Không —</option>{f.protocolIds.map((id: string) => <option key={id} value={id}>{protos.find((p) => p.id === id)?.name ?? id}</option>)}</Select></div>
          </div>
          <StaffReqEditor value={f.staffRequirements} onChange={(v) => setF({ ...f, staffRequirements: v })} />
        </Block>

        {/* D. Vật tư định mức */}
        <Block letter="D" title="Vật tư định mức">
          <MaterialEditor value={f.materials} onChange={(v) => setF({ ...f, materials: v })} products={products} />
        </Block>

        {/* E. Giá & chi phí */}
        <Block letter="E" title="Giá & chi phí">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Giá chuẩn (₫) *</Label><Input type="number" value={f.standardPrice} onChange={(e) => setF({ ...f, standardPrice: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Giá vốn dự kiến (₫)</Label><Input type="number" value={f.expectedCost} onChange={(e) => setF({ ...f, expectedCost: e.target.value })} placeholder="Ước tính" /></div>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            {floorSummary?.hasFloor ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span>Tổng chi phí dự kiến: <b>{formatCurrency(floorSummary.totalCost)}</b></span>
                <span>Biên tối thiểu: <b>{floorSummary.minMarginPercent}%</b></span>
                <span>Giá sàn: <b className="text-amber-600">{formatCurrency(floorSummary.floorPrice)}</b></span>
                <Link href="/price-floor" className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Xem / Thiết lập giá sàn</Link>
              </div>
            ) : (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Chưa thiết lập cấu trúc chi phí / giá sàn cho dịch vụ này.</span>
                <Link href="/price-floor" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Thiết lập giá sàn</Link>
              </div>
            )}
          </div>
        </Block>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving || !f.name}>{saving ? "Đang lưu..." : "Lưu dịch vụ"}</Button></div>
      </form>
    </Modal>
  );
}

function StaffReqEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const add = () => onChange([...value, { role: EMPLOYEE_ROLE_OPTIONS[0], quantity: 1, required: true }]);
  const upd = (i: number, patch: any) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const del = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><Label>Nhân sự yêu cầu (vai trò · số lượng · bắt buộc)</Label><Button type="button" size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /> Thêm vai trò</Button></div>
      {value.length === 0 ? <p className="text-xs text-muted-foreground">Chưa cấu hình vai trò nhân sự.</p> : value.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select className="flex-1" value={r.role} onChange={(e) => upd(i, { role: e.target.value })}>{EMPLOYEE_ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
          <Input type="number" className="w-20" value={r.quantity} onChange={(e) => upd(i, { quantity: Number(e.target.value) })} />
          <label className="flex w-28 items-center gap-1 text-sm"><Checkbox checked={r.required} onChange={(e) => upd(i, { required: e.target.checked })} /> Bắt buộc</label>
          <Button type="button" size="icon" variant="ghost" onClick={() => del(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}

function MaterialEditor({ value, onChange, products }: { value: any[]; onChange: (v: any[]) => void; products: any[] }) {
  const add = () => onChange([...value, { name: "", quantity: 1, unit: "", note: "", required: false, spaProductId: "" }]);
  const upd = (i: number, patch: any) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const del = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Vật tư/sản phẩm chuyên môn dùng định mức mỗi buổi (làm &quot;vật tư dự kiến&quot; khi ghi buổi).</span><Button type="button" size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /> Thêm vật tư</Button></div>
      {value.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có vật tư định mức.</p> : value.map((m, i) => (
        <div key={i} className="grid grid-cols-[1.4fr_.6fr_.6fr_1fr_auto_auto] items-center gap-2">
          <div>
            <Input value={m.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Tên vật tư" list={`sp-${i}`} />
            <datalist id={`sp-${i}`}>{products.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
          <Input type="number" value={m.quantity} onChange={(e) => upd(i, { quantity: Number(e.target.value) })} placeholder="SL" />
          <Input value={m.unit} onChange={(e) => upd(i, { unit: e.target.value })} placeholder="ĐVT" />
          <Input value={m.note} onChange={(e) => upd(i, { note: e.target.value })} placeholder="Ghi chú" />
          <label className="flex items-center gap-1 text-xs"><Checkbox checked={m.required} onChange={(e) => upd(i, { required: e.target.checked })} /> BB</label>
          <Button type="button" size="icon" variant="ghost" onClick={() => del(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}

/* ============================ Detail ============================ */
function ServiceDetailModal({ id, canFinance, canWrite, onClose, onEdit }: { id: string; canFinance: boolean; canWrite: boolean; onClose: () => void; onEdit: (s: Service) => void }) {
  const [d, setD] = useState<any | null>(null);
  useEffect(() => { apiFetch<any>(`/api/services/${id}`).then(setD).catch(() => {}); }, [id]);
  if (!d) return <Modal open onClose={onClose} title="Chi tiết dịch vụ"><p className="text-muted-foreground">Đang tải...</p></Modal>;
  const rr = d.resourceRequirements ?? {};
  const resLine = (["room", "bed", "machine"] as const).map((k) => {
    const lbl = k === "room" ? "Phòng" : k === "bed" ? "Giường" : "Máy";
    const v = rr[k]; if (!v || (!v.required && !v.default)) return null;
    return `${lbl}${v.required ? " (bắt buộc)" : ""}${v.default ? ": " + v.default : ""}`;
  }).filter(Boolean).join(" · ");
  return (
    <Modal open onClose={onClose} title={`${d.name} · ${d.code}`} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[d.status] ?? "muted"}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
          <span className="text-muted-foreground">{d.category?.name ?? "Chưa phân nhóm"}</span>
          {canWrite && <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(d)}>Sửa</Button>}
        </div>
        {d.description && <p className="text-muted-foreground">{d.description}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Sect title="Thời gian & tài nguyên">
            <Row k="Thời lượng" v={d.durationMinutes ? `${d.durationMinutes} phút` : "—"} />
            <Row k="Thời gian máy" v={d.machineMinutes ? `${d.machineMinutes} phút` : "cả buổi"} />
            <Row k="Tài nguyên" v={resLine || "—"} />
          </Sect>
          <Sect title="Chuyên môn">
            <Row k="Công nghệ" v={(d.technologies ?? []).map((t: any) => t.name).join(", ") || "—"} />
            <Row k="Protocol" v={(d.protocols ?? []).map((p: any) => p.name).join(", ") || "—"} />
            <Row k="Nhân sự" v={(d.staffRequirements ?? []).map((s: any) => `${s.role}${s.quantity ? " ×" + s.quantity : ""}${s.required ? "" : " (tùy chọn)"}`).join(", ") || "—"} />
          </Sect>
        </div>
        <Sect title="Vật tư định mức">
          {(d.materialStandards ?? []).length === 0 ? <p className="text-muted-foreground">—</p> : (
            <ul className="space-y-0.5">{d.materialStandards.map((m: any) => <li key={m.id}>• {m.name} — {Number(m.quantity)} {m.unit}{m.required ? " (bắt buộc)" : ""}{m.note ? ` · ${m.note}` : ""}</li>)}</ul>
          )}
        </Sect>
        <Sect title="Giá & chi phí">
          <Row k="Giá chuẩn" v={formatCurrency(Number(d.standardPrice))} />
          {canFinance && <Row k="Giá vốn dự kiến" v={d.expectedCost != null ? formatCurrency(Number(d.expectedCost)) : "—"} />}
          {canFinance && d.floorSummary?.hasFloor && <Row k="Tổng chi phí (giá sàn)" v={`${formatCurrency(d.floorSummary.totalCost)} → sàn ${formatCurrency(d.floorSummary.floorPrice)} (biên ${d.floorSummary.minMarginPercent}%)`} />}
          <div className="pt-1"><Link href="/price-floor" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Xem / Thiết lập giá sàn</Link></div>
        </Sect>
      </div>
    </Modal>
  );
}
function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="space-y-0.5">{children}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
