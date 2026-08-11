"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitBranch, Save, Plus, Trash2, GripVertical, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { LIBRARY_STATUS_LABEL, LIBRARY_STATUS_TONE } from "@/lib/clinic-labels";
import { FormRenderer } from "@/components/form-renderer";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  newField,
  newSection,
  newGroup,
  allFields,
  emptySchema,
  genId,
  type FormSchema,
  type FormField,
  type FieldType,
  type LogicRule,
} from "@/lib/form-builder";

const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"];

interface Template {
  id: string; code: string; name: string; version: number; status: string; schema: FormSchema;
}
type Sel = { sectionId: string; groupId: string; fieldId: string } | null;

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.FORM_WRITE);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [schema, setSchema] = useState<FormSchema>(emptySchema());
  const [sel, setSel] = useState<Sel>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"design" | "logic" | "preview">("design");
  const [preview, setPreview] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await apiFetch<Template>(`/api/form-templates/${id}`);
      setTpl(t);
      const s = t.schema && (t.schema as any).sections ? t.schema : emptySchema();
      setSchema(s);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function update(mut: (s: FormSchema) => void) {
    setSchema((prev) => {
      const copy: FormSchema = JSON.parse(JSON.stringify(prev));
      mut(copy);
      return copy;
    });
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/form-templates/${id}`, { method: "PATCH", body: JSON.stringify({ schema }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }
  async function setStatus(status: string) {
    try { await apiFetch(`/api/form-templates/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }
  async function bump() {
    const reason = window.prompt("Lý do tạo version mới?");
    if (reason === null) return;
    await apiFetch(`/api/form-templates/${id}`, { method: "PATCH", body: JSON.stringify({ schema, bumpVersion: true, changeReason: reason }) }).catch(() => {});
    load();
  }

  // --- mutators ---
  function addSection() { update((s) => { s.sections.push(newSection()); }); }
  function addGroup(secId: string) { update((s) => { s.sections.find((x) => x.id === secId)?.groups.push(newGroup()); }); }
  function addFieldTo(secId: string, grpId: string, type: FieldType) {
    const fld = newField(type);
    update((s) => { s.sections.find((x) => x.id === secId)?.groups.find((g) => g.id === grpId)?.fields.push(fld); });
    setSel({ sectionId: secId, groupId: grpId, fieldId: fld.id });
  }
  function delField(secId: string, grpId: string, fldId: string) {
    update((s) => { const g = s.sections.find((x) => x.id === secId)?.groups.find((g) => g.id === grpId); if (g) g.fields = g.fields.filter((f) => f.id !== fldId); });
    setSel(null);
  }
  function patchField(patch: Partial<FormField>) {
    if (!sel) return;
    update((s) => {
      const g = s.sections.find((x) => x.id === sel.sectionId)?.groups.find((g) => g.id === sel.groupId);
      const f = g?.fields.find((f) => f.id === sel.fieldId);
      if (f) Object.assign(f, patch);
    });
  }
  function moveSection(idx: number, dir: -1 | 1) {
    update((s) => { const j = idx + dir; if (j < 0 || j >= s.sections.length) return; [s.sections[idx], s.sections[j]] = [s.sections[j], s.sections[idx]]; });
  }

  // --- drag reorder field within/across groups ---
  function onFieldDrop(targetSec: string, targetGrp: string, targetFieldId: string | null, e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    const raw = e.dataTransfer.getData("field");
    if (!raw) return;
    const src = JSON.parse(raw) as { sectionId: string; groupId: string; fieldId: string };
    update((s) => {
      const sg = s.sections.find((x) => x.id === src.sectionId)?.groups.find((g) => g.id === src.groupId);
      if (!sg) return;
      const fi = sg.fields.findIndex((f) => f.id === src.fieldId);
      if (fi < 0) return;
      const [moved] = sg.fields.splice(fi, 1);
      const tg = s.sections.find((x) => x.id === targetSec)?.groups.find((g) => g.id === targetGrp);
      if (!tg) return;
      if (targetFieldId === null) tg.fields.push(moved);
      else { const ti = tg.fields.findIndex((f) => f.id === targetFieldId); tg.fields.splice(ti < 0 ? tg.fields.length : ti, 0, moved); }
    });
  }

  const selField: FormField | undefined = sel
    ? schema.sections.find((x) => x.id === sel.sectionId)?.groups.find((g) => g.id === sel.groupId)?.fields.find((f) => f.id === sel.fieldId)
    : undefined;

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!tpl) return <p className="text-destructive">Không tìm thấy biểu mẫu.</p>;

  return (
    <div>
      <Link href="/form-templates" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách biểu mẫu
      </Link>
      <PageHeader
        title={`${tpl.name} (v${tpl.version})`}
        description={tpl.code}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LIBRARY_STATUS_TONE[tpl.status]}>{LIBRARY_STATUS_LABEL[tpl.status]}</Badge>
            {canWrite && (
              <>
                <Select className="h-9 w-32" value={tpl.status} onChange={(e) => setStatus(e.target.value)}>
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

      <div className="mb-4 flex gap-1 border-b">
        {([["design", "Thiết kế"], ["logic", "Logic điều kiện"], ["preview", "Xem trước"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "design" && (
        <div className="grid gap-4 lg:grid-cols-[200px_1fr_280px]">
          {/* Palette */}
          <Card className="h-fit">
            <CardContent className="p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Thư viện trường</h3>
              <p className="mb-2 text-xs text-muted-foreground">Chọn 1 group rồi bấm để thêm.</p>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    disabled={!canWrite || !sel}
                    onClick={() => sel && addFieldTo(sel.sectionId, sel.groupId, ft.value)}
                    title={sel ? "Thêm vào group đang chọn" : "Chọn 1 trường/group trước"}
                    className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Canvas */}
          <div className="space-y-4">
            {schema.sections.length === 0 && (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Chưa có mục nào. Thêm mục để bắt đầu.</CardContent></Card>
            )}
            {schema.sections.map((sec, si) => (
              <Card key={sec.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Input className="flex-1 font-medium" value={sec.title} disabled={!canWrite} onChange={(e) => update((s) => { const x = s.sections.find((x) => x.id === sec.id); if (x) x.title = e.target.value; })} />
                    <Input className="w-32" placeholder="Tab (tùy chọn)" value={sec.tab ?? ""} disabled={!canWrite} onChange={(e) => update((s) => { const x = s.sections.find((x) => x.id === sec.id); if (x) x.tab = e.target.value; })} />
                    {canWrite && <>
                      <Button size="icon" variant="ghost" onClick={() => moveSection(si, -1)}>↑</Button>
                      <Button size="icon" variant="ghost" onClick={() => moveSection(si, 1)}>↓</Button>
                      <Button size="icon" variant="ghost" onClick={() => update((s) => { s.sections = s.sections.filter((x) => x.id !== sec.id); })}><Trash2 className="h-4 w-4" /></Button>
                    </>}
                  </div>

                  {sec.groups.map((grp) => (
                    <div key={grp.id} className="rounded-md border border-dashed p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onFieldDrop(sec.id, grp.id, null, e)}>
                      <div className="mb-2 flex items-center gap-2">
                        <Input className="h-8 flex-1 text-sm" placeholder="Tên group (tùy chọn)" value={grp.title ?? ""} disabled={!canWrite} onChange={(e) => update((s) => { const g = s.sections.find((x) => x.id === sec.id)?.groups.find((g) => g.id === grp.id); if (g) g.title = e.target.value; })} />
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => update((s) => { const x = s.sections.find((x) => x.id === sec.id); if (x) x.groups = x.groups.filter((g) => g.id !== grp.id); })}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      <div className="space-y-1.5">
                        {grp.fields.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Kéo/thêm trường vào đây</p>}
                        {grp.fields.map((f) => {
                          const active = sel?.fieldId === f.id;
                          return (
                            <div
                              key={f.id}
                              draggable={canWrite}
                              onDragStart={(e) => e.dataTransfer.setData("field", JSON.stringify({ sectionId: sec.id, groupId: grp.id, fieldId: f.id }))}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onFieldDrop(sec.id, grp.id, f.id, e)}
                              onClick={() => setSel({ sectionId: sec.id, groupId: grp.id, fieldId: f.id })}
                              className={`flex cursor-pointer items-center gap-2 rounded border bg-card px-2 py-1.5 text-sm ${active ? "border-primary ring-1 ring-primary" : ""}`}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="flex-1 truncate">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                              <Badge tone="muted">{FIELD_TYPE_LABEL[f.type]}</Badge>
                              {canWrite && <button onClick={(e) => { e.stopPropagation(); delField(sec.id, grp.id, f.id); }}><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {canWrite && <Button size="sm" variant="ghost" onClick={() => addGroup(sec.id)}><Plus className="h-4 w-4" /> Group</Button>}
                </CardContent>
              </Card>
            ))}
            {canWrite && <Button variant="outline" onClick={addSection}><Plus className="h-4 w-4" /> Thêm mục (Section)</Button>}
          </div>

          {/* Properties */}
          <Card className="h-fit">
            <CardContent className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Thuộc tính trường</h3>
              {!selField ? (
                <p className="text-sm text-muted-foreground">Chọn một trường để chỉnh thuộc tính.</p>
              ) : (
                <FieldProperties field={selField} disabled={!canWrite} allFields={allFields(schema)} onChange={patchField} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "logic" && (
        <LogicEditor schema={schema} disabled={!canWrite} onChange={(logic) => update((s) => { s.logic = logic; })} />
      )}

      {tab === "preview" && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" /> Xem trước (logic điều kiện hoạt động)</div>
            <FormRenderer schema={schema} values={preview} onChange={setPreview} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FieldProperties({ field, onChange, disabled, allFields }: { field: FormField; onChange: (p: Partial<FormField>) => void; disabled: boolean; allFields: FormField[] }) {
  const meta = FIELD_TYPES.find((f) => f.value === field.type);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5"><Label>Nhãn</Label><Input value={field.label} disabled={disabled} onChange={(e) => onChange({ label: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Hướng dẫn</Label><Input value={field.description ?? ""} disabled={disabled} onChange={(e) => onChange({ description: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!field.required} disabled={disabled} onChange={(e) => onChange({ required: e.target.checked })} /> Bắt buộc</label>
      <div className="space-y-1.5"><Label>Placeholder</Label><Input value={field.placeholder ?? ""} disabled={disabled} onChange={(e) => onChange({ placeholder: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Giá trị mặc định</Label><Input value={field.defaultValue ?? ""} disabled={disabled} onChange={(e) => onChange({ defaultValue: e.target.value })} /></div>
      {field.type === "MEASUREMENT" && <div className="space-y-1.5"><Label>Đơn vị</Label><Input value={field.unit ?? ""} disabled={disabled} onChange={(e) => onChange({ unit: e.target.value })} /></div>}
      {(field.type === "SLIDER" || field.type === "NUMBER") && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>Min</Label><Input type="number" value={field.min ?? ""} disabled={disabled} onChange={(e) => onChange({ min: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Max</Label><Input type="number" value={field.max ?? ""} disabled={disabled} onChange={(e) => onChange({ max: Number(e.target.value) })} /></div>
        </div>
      )}
      {meta?.hasOptions && (
        <div className="space-y-1.5">
          <Label>Lựa chọn</Label>
          {(field.options ?? []).map((o, i) => (
            <div key={i} className="flex gap-1">
              <Input className="h-8" value={o.label} disabled={disabled} onChange={(e) => { const opts = [...(field.options ?? [])]; opts[i] = { label: e.target.value, value: e.target.value }; onChange({ options: opts }); }} />
              {!disabled && <Button size="icon" variant="ghost" onClick={() => onChange({ options: (field.options ?? []).filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          {!disabled && <Button size="sm" variant="ghost" onClick={() => onChange({ options: [...(field.options ?? []), { label: "Lựa chọn", value: "opt" + ((field.options?.length ?? 0) + 1) }] })}><Plus className="h-4 w-4" /> Lựa chọn</Button>}
        </div>
      )}
      {field.type === "CALCULATED" && (
        <div className="space-y-1.5">
          <Label>Công thức</Label>
          <Select value={field.calc?.op ?? "sum"} disabled={disabled} onChange={(e) => onChange({ calc: { op: e.target.value as any, fields: field.calc?.fields ?? [] } })}>
            <option value="sum">Tổng</option><option value="product">Tích</option><option value="avg">Trung bình</option>
          </Select>
          <p className="text-xs text-muted-foreground">Chọn các trường số:</p>
          <div className="flex flex-wrap gap-1">
            {allFields.filter((f) => ["NUMBER", "CURRENCY", "PERCENTAGE", "SLIDER", "RATING"].includes(f.type) && f.id !== field.id).map((f) => {
              const on = field.calc?.fields.includes(f.id);
              return <label key={f.id} className={`cursor-pointer rounded border px-1.5 py-0.5 text-xs ${on ? "border-primary bg-primary/5" : ""}`}><Checkbox className="mr-1" checked={on} disabled={disabled} onChange={() => { const fs = field.calc?.fields ?? []; onChange({ calc: { op: field.calc?.op ?? "sum", fields: on ? fs.filter((x) => x !== f.id) : [...fs, f.id] } }); }} />{f.label}</label>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LogicEditor({ schema, onChange, disabled }: { schema: FormSchema; onChange: (l: LogicRule[]) => void; disabled: boolean }) {
  const fields = allFields(schema);
  const rules = schema.logic ?? [];
  function patch(idx: number, r: Partial<LogicRule>) { onChange(rules.map((x, i) => i === idx ? { ...x, ...r } : x)); }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Quy tắc: NẾU (điều kiện) THÌ hiện/ẩn/bắt buộc các trường mục tiêu. Hỗ trợ AND (ALL) / OR (ANY).</p>
      {rules.map((rule, ri) => (
        <Card key={rule.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">NẾU khớp</span>
              <Select className="h-8 w-24" value={rule.match} disabled={disabled} onChange={(e) => patch(ri, { match: e.target.value as any })}>
                <option value="ALL">TẤT CẢ</option><option value="ANY">BẤT KỲ</option>
              </Select>
              {!disabled && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(rules.filter((_, i) => i !== ri))}><Trash2 className="h-4 w-4" /> Xóa</Button>}
            </div>
            {rule.conditions.map((c, ci) => (
              <div key={ci} className="flex flex-wrap items-center gap-2">
                <Select className="h-8 w-48" value={c.fieldId} disabled={disabled} onChange={(e) => patch(ri, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, fieldId: e.target.value } : x) })}>
                  <option value="">— trường —</option>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </Select>
                <Select className="h-8 w-32" value={c.op} disabled={disabled} onChange={(e) => patch(ri, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, op: e.target.value as any } : x) })}>
                  <option value="eq">bằng</option><option value="neq">khác</option><option value="gt">&gt;</option><option value="lt">&lt;</option><option value="contains">chứa</option><option value="notEmpty">có giá trị</option><option value="empty">rỗng</option>
                </Select>
                {c.op !== "empty" && c.op !== "notEmpty" && <Input className="h-8 w-32" value={c.value ?? ""} disabled={disabled} onChange={(e) => patch(ri, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, value: e.target.value } : x) })} />}
                {!disabled && <Button size="icon" variant="ghost" onClick={() => patch(ri, { conditions: rule.conditions.filter((_, i) => i !== ci) })}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            {!disabled && <Button size="sm" variant="ghost" onClick={() => patch(ri, { conditions: [...rule.conditions, { fieldId: "", op: "eq", value: "" }] })}><Plus className="h-4 w-4" /> Điều kiện</Button>}
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-sm font-medium">THÌ</span>
              <Select className="h-8 w-32" value={rule.action} disabled={disabled} onChange={(e) => patch(ri, { action: e.target.value as any })}>
                <option value="show">Hiện</option><option value="hide">Ẩn</option><option value="require">Bắt buộc</option>
              </Select>
              <span className="text-sm text-muted-foreground">trường:</span>
              <div className="flex flex-wrap gap-1">
                {fields.map((f) => {
                  const on = rule.targets.includes(f.id);
                  return <label key={f.id} className={`cursor-pointer rounded border px-1.5 py-0.5 text-xs ${on ? "border-primary bg-primary/5" : ""}`}><Checkbox className="mr-1" checked={on} disabled={disabled} onChange={() => patch(ri, { targets: on ? rule.targets.filter((x) => x !== f.id) : [...rule.targets, f.id] })} />{f.label}</label>;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {!disabled && <Button variant="outline" onClick={() => onChange([...rules, { id: genId("rule"), match: "ALL", conditions: [{ fieldId: "", op: "eq", value: "" }], action: "show", targets: [] }])}><Plus className="h-4 w-4" /> Thêm quy tắc</Button>}
    </div>
  );
}
