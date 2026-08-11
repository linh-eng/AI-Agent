"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitBranch, Plus, Save, X } from "lucide-react";
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
}
interface Opt { id: string; name: string; sku?: string }

const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"];

export default function ProtocolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.PROTOCOL_WRITE);
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
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<Opt[]>("/api/technologies").then(setTechs).catch(() => {});
    apiFetch<Opt[]>("/api/spa-products").then(setProducts).catch(() => {});
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
