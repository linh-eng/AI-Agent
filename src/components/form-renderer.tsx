"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { mediaSrc, formatDateTime } from "@/lib/utils";
import {
  evaluateLogic,
  computeCalc,
  schemaTabs,
  type FormSchema,
  type FormField,
} from "@/lib/form-builder";

type Values = Record<string, any>;

const ENTITY_ENDPOINT: Record<string, string> = {
  SERVICE: "/api/services",
  TECHNOLOGY: "/api/technologies",
  PRODUCT: "/api/spa-products",
  MATERIAL: "/api/products",
};

/**
 * Renderer biểu mẫu động — dùng cho xem trước (builder) và điền instance.
 * Đánh giá conditional logic (ẩn/bắt buộc), tính CALCULATED, nạp option cho
 * các field liên kết (dịch vụ/công nghệ/sản phẩm/vật tư).
 */
export function FormRenderer({
  schema,
  values,
  onChange,
  disabled,
}: {
  schema: FormSchema;
  values: Values;
  onChange?: (v: Values) => void;
  disabled?: boolean;
}) {
  const [entityOpts, setEntityOpts] = useState<Record<string, { id: string; label: string }[]>>({});
  const tabs = useMemo(() => schemaTabs(schema), [schema]);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? "Chung");

  // nạp option cho các field liên kết có mặt trong schema
  useEffect(() => {
    const types = new Set<string>();
    for (const s of schema.sections) for (const g of s.groups) for (const f of g.fields)
      if (ENTITY_ENDPOINT[f.type]) types.add(f.type);
    types.forEach((t) => {
      if (entityOpts[t]) return;
      apiFetch<any[]>(ENTITY_ENDPOINT[t])
        .then((rows) => setEntityOpts((prev) => ({ ...prev, [t]: rows.map((r) => ({ id: r.id, label: r.name ?? r.sku ?? r.id })) })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const { hidden, required } = evaluateLogic(schema, values);
  const set = (id: string, v: any) => onChange?.({ ...values, [id]: v });

  function renderField(f: FormField) {
    if (hidden.has(f.id)) return null;
    const req = f.required || required.has(f.id);
    const val = values[f.id] ?? f.defaultValue ?? "";
    const common = { disabled, id: f.id };

    let control: React.ReactNode;
    switch (f.type) {
      case "LONG_TEXT":
        control = <textarea className="min-h-[70px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />;
        break;
      case "NUMBER": case "CURRENCY": case "PERCENTAGE":
        control = <Input type="number" value={val} {...common} onChange={(e) => set(f.id, e.target.value)} />;
        break;
      case "DATE": control = <Input type="date" value={val} {...common} onChange={(e) => set(f.id, e.target.value)} />; break;
      case "DATETIME": control = <Input type="datetime-local" value={val} {...common} onChange={(e) => set(f.id, e.target.value)} />; break;
      case "TIME": control = <Input type="time" value={val} {...common} onChange={(e) => set(f.id, e.target.value)} />; break;
      case "DROPDOWN":
        control = <Select value={val} {...common} onChange={(e) => set(f.id, e.target.value)}><option value="">—</option>{(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
        break;
      case "RADIO": case "YES_NO": {
        const opts = f.type === "YES_NO" ? [{ label: "Có", value: "yes" }, { label: "Không", value: "no" }] : (f.options ?? []);
        control = <div className="flex flex-wrap gap-3">{opts.map((o) => <label key={o.value} className="flex items-center gap-1.5 text-sm"><input type="radio" name={f.id} checked={val === o.value} disabled={disabled} onChange={() => set(f.id, o.value)} />{o.label}</label>)}</div>;
        break;
      }
      case "CHECKBOX": case "MULTI_SELECT": {
        const arr: string[] = Array.isArray(values[f.id]) ? values[f.id] : [];
        control = <div className="flex flex-wrap gap-3">{(f.options ?? []).map((o) => <label key={o.value} className="flex items-center gap-1.5 text-sm"><Checkbox checked={arr.includes(o.value)} disabled={disabled} onChange={() => set(f.id, arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value])} />{o.label}</label>)}</div>;
        break;
      }
      case "RATING": {
        control = <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={disabled} onClick={() => set(f.id, n)} className={`text-xl ${Number(val) >= n ? "text-amber-500" : "text-muted-foreground/30"}`}>★</button>)}</div>;
        break;
      }
      case "SLIDER":
        control = <div className="flex items-center gap-2"><input type="range" min={f.min ?? 0} max={f.max ?? 100} value={val || f.min || 0} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} className="flex-1" /><span className="w-10 text-sm">{val || 0}</span></div>;
        break;
      case "MEASUREMENT":
        control = <div className="flex items-center gap-2"><Input type="number" value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} /><span className="text-sm text-muted-foreground">{f.unit}</span></div>;
        break;
      case "IMAGE": case "BEFORE_IMAGE": case "AFTER_IMAGE": case "VIDEO": case "FILE":
        control = <Input placeholder="URL (ảnh/video/tệp)" value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />;
        break;
      case "SIGNATURE":
        control = <SignatureField value={values[f.id]} disabled={disabled} onChange={(v) => set(f.id, v)} />;
        break;
      case "SERVICE": case "TECHNOLOGY": case "PRODUCT": case "MATERIAL":
        control = <Select value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)}><option value="">—</option>{(entityOpts[f.type] ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>;
        break;
      case "EMPLOYEE":
        control = <Input placeholder="Tên nhân viên" value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />;
        break;
      case "BODY_AREA":
        control = <Select value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)}><option value="">—</option>{(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
        break;
      case "TABLE": case "REPEATING_GROUP":
        control = <TableField columns={f.columns && f.columns.length ? f.columns : ["Cột 1"]} rows={Array.isArray(values[f.id]) ? values[f.id] : []} disabled={disabled} onChange={(rows) => set(f.id, rows)} />;
        break;
      case "CALCULATED": {
        const computed = computeCalc(f, values);
        control = <Input value={computed} disabled readOnly />;
        break;
      }
      default:
        control = <Input value={val} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />;
    }

    return (
      <div key={f.id} className="space-y-1.5">
        <Label>{f.label}{req && <span className="text-destructive"> *</span>}</Label>
        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
        {control}
      </div>
    );
  }

  const visibleSections = schema.sections.filter((s) => (s.tab?.trim() || "Chung") === activeTab && !hidden.has(s.id));

  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      )}
      {visibleSections.length === 0 && <p className="text-sm text-muted-foreground">Không có trường nào để hiển thị.</p>}
      {visibleSections.map((sec) => (
        <div key={sec.id} className="space-y-3">
          <h3 className="text-sm font-semibold">{sec.title}</h3>
          {sec.groups.map((g) => (
            <div key={g.id} className="space-y-3 rounded-md border p-4">
              {g.title && <div className="text-xs font-medium text-muted-foreground">{g.title}</div>}
              <div className="grid gap-3 sm:grid-cols-2">{g.fields.map(renderField)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bảng/nhóm lặp: thêm–xóa dòng, mỗi cột lưu giá trị có cấu trúc. */
function TableField({
  columns,
  rows,
  onChange,
  disabled,
}: {
  columns: string[];
  rows: Record<string, any>[];
  onChange: (rows: Record<string, any>[]) => void;
  disabled?: boolean;
}) {
  const addRow = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c, ""]))]);
  const setCell = (ri: number, col: string, v: string) =>
    onChange(rows.map((r, i) => (i === ri ? { ...r, [col]: v } : r)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => <th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground">{c}</th>)}
              {!disabled && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-2 py-2 text-center text-xs text-muted-foreground">Chưa có dòng</td></tr>}
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t">
                {columns.map((c) => (
                  <td key={c} className="px-1 py-1">
                    <input className="h-8 w-full rounded border border-input bg-card px-2 text-sm" value={r[c] ?? ""} disabled={disabled} onChange={(e) => setCell(ri, c, e.target.value)} />
                  </td>
                ))}
                {!disabled && <td className="px-1 text-center"><button type="button" onClick={() => onChange(rows.filter((_, i) => i !== ri))} className="text-muted-foreground hover:text-destructive">×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && <button type="button" onClick={addRow} className="rounded border px-2 py-1 text-xs hover:bg-accent">+ Thêm dòng</button>}
    </div>
  );
}

/** Ký điện tử: canvas vẽ chữ ký -> lưu {dataUrl, signedBy, signedAt}. */
function SignatureField({
  value,
  onChange,
  disabled,
}: {
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const sig = value && typeof value === "object" ? value : {};

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent) {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onChange({ ...sig, dataUrl, signedAt: sig.signedAt || new Date().toISOString() });
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange({ ...sig, dataUrl: "" });
  }

  // vẽ lại chữ ký đã lưu khi mở lại.
  // Ưu tiên dataUrl (vừa ký, chưa lưu); nếu đã lưu storage thì lấy qua mediaId
  // (ảnh riêng tư, tải qua route có kiểm quyền — không có URL công khai).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = sig.dataUrl || (sig.mediaId ? mediaSrc(sig.mediaId) : "");
    if (!src) return;
    const img = new Image();
    img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0);
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full max-w-sm touch-none rounded-md border bg-white"
      />
      <div className="flex items-center gap-2">
        <Input className="h-8 max-w-[200px]" placeholder="Họ tên người ký" value={sig.signedBy ?? ""} disabled={disabled} onChange={(e) => onChange({ ...sig, signedBy: e.target.value })} />
        {!disabled && <button type="button" onClick={clear} className="rounded border px-2 py-1 text-xs hover:bg-accent">Xóa ký</button>}
        {sig.signedAt && <span className="text-xs text-muted-foreground">Ký lúc {formatDateTime(sig.signedAt)}</span>}
      </div>
    </div>
  );
}
