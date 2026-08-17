"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitBranch, Plus, Save, X, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  LIBRARY_STATUS_LABEL,
  LIBRARY_STATUS_TONE,
  PROTOCOL_KIND_LABEL,
} from "@/lib/clinic-labels";

interface Step { name: string; durationMinutes?: number | string; note?: string }
interface Protocol {
  id: string; code: string; name: string; kind: string; version: number; status: string;
  purpose?: string | null; suitableFor?: string | null; contraindications?: string | null;
  preCare?: string | null; postCare?: string | null; recommendedFreq?: string | null;
  recommendedCount?: number | null; sourceRef?: string | null;
  steps?: { items?: Step[] } | null;
  brand?: { id: string; name: string } | null;
  technologies: { technology: { id: string; name: string } }[];
  products: { product: { id: string; name: string; sku: string } }[];
  compositionMode?: string;
  composeDuration?: number;
  services?: PS[];
}
interface Opt { id: string; name: string; sku?: string }
interface SvcOpt { id: string; code: string; name: string; version?: number; durationMinutes?: number | null; status?: string }
interface SopStep { id: string; sortOrder: number; name: string; durationMinutes?: number | null; warnings?: string | null; _count?: { products: number; technologies: number; options: number }; technologies?: { technology: { name: string } }[]; options?: { name: string; isDefault: boolean }[] }
interface PS {
  serviceId: string;
  service?: { id: string; code: string; name: string; version?: number; durationMinutes?: number | null; status?: string; steps?: SopStep[] };
  phase?: string | null; isRequired?: boolean; conditionText?: string | null; notes?: string | null;
  durationOverride?: number | string | null; serviceVersionSnapshot?: number | null; recommendedVariants?: any;
}

const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"];

export default function ProtocolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PROTOCOL_WRITE);
  const canFinance = useCan(PERMISSIONS.FINANCE_READ);
  const [p, setP] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [techs, setTechs] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);

  const [f, setF] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [techIds, setTechIds] = useState<string[]>([]);
  const [prodIds, setProdIds] = useState<string[]>([]);
  // Redesign P2 — compose nhiều Service
  const [mode, setMode] = useState<string>("LEGACY_STEPS");
  const [psList, setPsList] = useState<PS[]>([]);
  const [svcOpts, setSvcOpts] = useState<SvcOpt[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Protocol>(`/api/brand-protocols/${id}`);
      setP(data);
      setF({
        purpose: data.purpose ?? "", suitableFor: data.suitableFor ?? "",
        contraindications: data.contraindications ?? "", preCare: data.preCare ?? "",
        postCare: data.postCare ?? "", recommendedFreq: data.recommendedFreq ?? "",
        recommendedCount: data.recommendedCount ?? "", sourceRef: data.sourceRef ?? "",
      });
      setSteps(data.steps?.items ?? []);
      setTechIds(data.technologies.map((t) => t.technology.id));
      setProdIds(data.products.map((p) => p.product.id));
      setMode(data.compositionMode ?? "LEGACY_STEPS");
      setPsList(data.services ?? []);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<Opt[]>("/api/technologies").then(setTechs).catch(() => {});
    apiFetch<Opt[]>("/api/spa-products").then(setProducts).catch(() => {});
    apiFetch<SvcOpt[]>("/api/services?status=ACTIVE").then(setSvcOpts).catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setError(null);
    try {
      const body: any = {
        ...f,
        recommendedCount: f.recommendedCount ? Number(f.recommendedCount) : null,
        steps: { items: steps.filter((s) => s.name).map((s) => ({ ...s, durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : undefined })) },
        technologyIds: techIds,
        productIds: prodIds,
        compositionMode: mode,
        // Redesign P2 — thay toàn bộ danh sách Service (chỉ gửi khi mode SERVICES để tránh xóa nhầm).
        services: mode === "SERVICES"
          ? psList.filter((ps) => ps.serviceId).map((ps) => ({
              serviceId: ps.serviceId, phase: ps.phase || null, isRequired: ps.isRequired ?? true,
              conditionText: ps.conditionText || null, notes: ps.notes || null,
              durationOverride: ps.durationOverride !== "" && ps.durationOverride != null ? Number(ps.durationOverride) : null,
              recommendedVariants: ps.recommendedVariants ?? undefined,
            }))
          : undefined,
      };
      await apiFetch(`/api/brand-protocols/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  async function setStatus(status: string) {
    setError(null);
    try {
      await apiFetch(`/api/brand-protocols/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function bump() {
    const reason = window.prompt("Lý do tạo version mới?");
    if (reason === null) return;
    await apiFetch(`/api/brand-protocols/${id}`, { method: "PATCH", body: JSON.stringify({ bumpVersion: true, changeReason: reason }) }).catch(() => {});
    load();
  }

  if (loading || !f) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!p) return <p className="text-destructive">Không tìm thấy protocol.</p>;

  return (
    <div>
      <Link href="/protocols" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Protocol Library
      </Link>
      <PageHeader
        title={`${p.name} (v${p.version})`}
        description={`${p.code} · ${PROTOCOL_KIND_LABEL[p.kind]}${p.brand ? " · " + p.brand.name : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LIBRARY_STATUS_TONE[p.status]}>{LIBRARY_STATUS_LABEL[p.status]}</Badge>
            {p.compositionMode === "SERVICES" && canFinance && (
              <Link href={`/protocols/${p.id}/pricing`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Giá &amp; chi phí gói →</Link>
            )}
            {canWrite && (
              <>
                <Select className="h-9 w-36" value={p.status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{LIBRARY_STATUS_LABEL[s]}</option>)}
                </Select>
                <Button variant="outline" onClick={bump}><GitBranch className="h-4 w-4" /> Version</Button>
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu"}</Button>
              </>
            )}
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {/* Redesign P2 — Chế độ nội dung: bước cũ (legacy) hoặc compose nhiều Service */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="space-y-1">
            <Label>Cách tổ chức nội dung</Label>
            <Select className="w-64" value={mode} disabled={!canWrite} onChange={(e) => setMode(e.target.value)}>
              <option value="LEGACY_STEPS">Theo bước (cũ) — steps thủ công</option>
              <option value="SERVICES">Compose nhiều Dịch vụ (mỗi DV giữ SOP riêng)</option>
            </Select>
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">
            {mode === "SERVICES"
              ? "Protocol tham chiếu các Dịch vụ; mỗi Dịch vụ giữ SOP (các bước) riêng — không sao chép. Sửa SOP ở màn Dịch vụ."
              : "Protocol dùng danh sách bước thủ công như trước. Đổi sang “Compose nhiều Dịch vụ” để chuẩn hóa theo Dịch vụ."}
          </p>
        </CardContent>
      </Card>

      {mode === "SERVICES" && (
        <ComposeServicesCard psList={psList} setPsList={setPsList} svcOpts={svcOpts} canWrite={canWrite} composeDuration={p.composeDuration} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-muted-foreground">Thông tin chuyên môn</h3>
            {[
              ["purpose", "Mục tiêu"], ["suitableFor", "Tình trạng phù hợp"],
              ["contraindications", "Chống chỉ định"], ["preCare", "Hướng dẫn trước"],
              ["postCare", "Hướng dẫn sau"], ["sourceRef", "Nguồn tham khảo (nội bộ)"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={f[k]} disabled={!canWrite} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Tần suất</Label><Input value={f.recommendedFreq} disabled={!canWrite} onChange={(e) => setF({ ...f, recommendedFreq: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Số lần khuyến nghị</Label><Input type="number" value={f.recommendedCount} disabled={!canWrite} onChange={(e) => setF({ ...f, recommendedCount: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mode !== "SERVICES" && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Các bước thực hiện</h3>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setSteps([...steps, { name: "" }])}><Plus className="h-4 w-4" /> Bước</Button>}
              </div>
              <div className="space-y-2">
                {steps.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bước.</p>}
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-sm text-muted-foreground">{i + 1}.</span>
                    <Input className="flex-1" placeholder="Tên bước" value={s.name} disabled={!canWrite} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input className="w-24" type="number" placeholder="phút" value={s.durationMinutes ?? ""} disabled={!canWrite} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, durationMinutes: e.target.value } : x))} />
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Công nghệ sử dụng</h3>
              <div className="flex flex-wrap gap-2">
                {techs.map((t) => {
                  const on = techIds.includes(t.id);
                  return (
                    <label key={t.id} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${on ? "border-primary bg-primary/5" : ""}`}>
                      <Checkbox checked={on} disabled={!canWrite} onChange={() => setTechIds(on ? techIds.filter((x) => x !== t.id) : [...techIds, t.id])} />
                      {t.name}
                    </label>
                  );
                })}
                {techs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có công nghệ.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Sản phẩm sử dụng</h3>
              <div className="flex flex-wrap gap-2">
                {products.map((t) => {
                  const on = prodIds.includes(t.id);
                  return (
                    <label key={t.id} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${on ? "border-primary bg-primary/5" : ""}`}>
                      <Checkbox checked={on} disabled={!canWrite} onChange={() => setProdIds(on ? prodIds.filter((x) => x !== t.id) : [...prodIds, t.id])} />
                      {t.name}
                    </label>
                  );
                })}
                {products.length === 0 && <p className="text-sm text-muted-foreground">Chưa có sản phẩm.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ===================== Redesign P2 · Compose từ Dịch vụ ===================== */
function ComposeServicesCard({ psList, setPsList, svcOpts, canWrite, composeDuration }: {
  psList: PS[]; setPsList: (v: PS[]) => void; svcOpts: SvcOpt[]; canWrite: boolean; composeDuration?: number;
}) {
  const [addId, setAddId] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const usedIds = new Set(psList.map((p) => p.serviceId));
  const available = svcOpts.filter((s) => !usedIds.has(s.id));

  const upd = (i: number, patch: Partial<PS>) => setPsList(psList.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const del = (i: number) => setPsList(psList.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= psList.length) return; const n = [...psList]; [n[i], n[j]] = [n[j], n[i]]; setPsList(n); };
  const add = () => {
    if (!addId) return;
    const svc = svcOpts.find((s) => s.id === addId);
    setPsList([...psList, { serviceId: addId, service: svc ? { id: svc.id, code: svc.code, name: svc.name, version: svc.version, durationMinutes: svc.durationMinutes } : undefined, isRequired: true }]);
    setAddId("");
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Compose từ Dịch vụ ({psList.length}){composeDuration ? ` · ~${composeDuration}′` : ""}</h3>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Select className="w-64" value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">— Chọn dịch vụ để thêm —</option>
                {available.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </Select>
              <Button size="sm" variant="outline" onClick={add} disabled={!addId}><Plus className="h-3.5 w-3.5" /> Thêm</Button>
            </div>
          )}
        </div>

        {psList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dịch vụ nào. Thêm dịch vụ để tạo protocol compose (mỗi dịch vụ giữ SOP riêng).</p>
        ) : (
          <div className="space-y-2">
            {psList.map((ps, i) => {
              const svc = ps.service;
              const nSteps = svc?.steps?.length ?? 0;
              const liveVer = svc?.version;
              const pinned = ps.serviceVersionSnapshot;
              const open = !!expanded[i];
              return (
                <div key={i} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    <button type="button" className="flex items-center gap-1 text-sm font-medium hover:text-primary" onClick={() => setExpanded({ ...expanded, [i]: !open })}>
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {svc?.name ?? ps.serviceId} <span className="font-mono text-xs text-muted-foreground">{svc?.code}</span>
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {liveVer != null ? `v${liveVer}` : ""}{pinned != null && pinned !== liveVer ? ` (gắn v${pinned})` : ""} · {nSteps} bước
                      {ps.durationOverride ? ` · ${ps.durationOverride}′ (ghi đè)` : svc?.durationMinutes ? ` · ${svc.durationMinutes}′` : ""}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {svc && <Link href={`/services`} className="text-muted-foreground hover:text-primary" title="Mở màn Dịch vụ để sửa SOP"><ExternalLink className="h-3.5 w-3.5" /></Link>}
                      {canWrite && <>
                        <Button type="button" size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} title="Lên">↑</Button>
                        <Button type="button" size="icon" variant="ghost" disabled={i === psList.length - 1} onClick={() => move(i, 1)} title="Xuống">↓</Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => del(i)}><X className="h-4 w-4 text-destructive" /></Button>
                      </>}
                    </div>
                  </div>

                  {canWrite && (
                    <div className="mt-2 grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                      <label className="flex items-center gap-1 text-xs"><Checkbox checked={ps.isRequired ?? true} onChange={(e) => upd(i, { isRequired: e.target.checked })} /> Bắt buộc</label>
                      <Input className="h-8" placeholder="Ghi đè thời lượng (phút)" type="number" value={(ps.durationOverride as any) ?? ""} onChange={(e) => upd(i, { durationOverride: e.target.value })} />
                      <Input className="h-8" placeholder="Điều kiện áp dụng" value={ps.conditionText ?? ""} onChange={(e) => upd(i, { conditionText: e.target.value })} />
                    </div>
                  )}
                  {canWrite && <Input className="mt-2 h-8" placeholder="Ghi chú cấp compose" value={ps.notes ?? ""} onChange={(e) => upd(i, { notes: e.target.value })} />}

                  {open && (
                    <div className="mt-2 rounded border bg-card p-2 text-xs">
                      <div className="mb-1 font-medium text-muted-foreground">SOP của dịch vụ (chỉ xem — sửa ở màn Dịch vụ)</div>
                      {nSteps === 0 ? <p className="text-muted-foreground">Dịch vụ chưa có SOP.</p> : (
                        <ol className="space-y-0.5">
                          {svc!.steps!.map((st) => (
                            <li key={st.id}>
                              {st.sortOrder + 1}. {st.name}{st.durationMinutes ? ` — ${st.durationMinutes}′` : ""}
                              {st._count?.options ? ` · ${st._count.options} phương án` : ""}
                              {st.warnings ? <span className="text-amber-600"> · ⚠</span> : ""}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
