"use client";
// =============================================================================
// DATA-IO — Nhập/Xuất dữ liệu danh mục qua CSV (đổ dữ liệu nhanh).
// Chọn loại dữ liệu → Tải mẫu / Xuất CSV / Nhập CSV (dán hoặc tải file → xem
// trước Thêm mới/Cập nhật/Lỗi → Nhập). Nhập = UPSERT theo mã, KHÔNG xóa dữ liệu.
// =============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";

type DS = { key: string; label: string; group: string; canWrite: boolean; columns: { header: string; required: boolean; type: string; enum?: string[]; ref?: string }[] };

export default function DataIoPage() {
  const [datasets, setDatasets] = useState<DS[]>([]);
  const [key, setKey] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { apiFetch<DS[]>("/api/data-io").then((d) => { setDatasets(d); if (d[0]) setKey(d[0].key); }).catch(() => {}); }, []);
  const ds = useMemo(() => datasets.find((d) => d.key === key), [datasets, key]);
  const reset = useCallback(() => { setCsv(""); setPreview(null); setReport(null); setMsg(""); }, []);
  useEffect(() => { reset(); }, [key, reset]);

  const groups = useMemo(() => { const g = new Map<string, DS[]>(); for (const d of datasets) { if (!g.has(d.group)) g.set(d.group, []); g.get(d.group)!.push(d); } return Array.from(g.entries()); }, [datasets]);

  function download(kind: "export" | "template") { window.open(`/api/data-io/${key}/${kind}`, "_blank"); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setCsv(await f.text()); setPreview(null); setReport(null); }
  async function doPreview() {
    setBusy(true); setMsg(""); setReport(null);
    try { setPreview(await apiFetch<any>(`/api/data-io/${key}/preview`, { method: "POST", body: JSON.stringify({ csv }) })); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi xem trước"); } finally { setBusy(false); }
  }
  async function doImport() {
    setBusy(true); setMsg("");
    try { const r = await apiFetch<any>(`/api/data-io/${key}/import`, { method: "POST", body: JSON.stringify({ csv }) }); setReport(r); setPreview(null); }
    catch (e: any) { setMsg(e?.message ?? "Lỗi nhập"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Nhập/Xuất dữ liệu (CSV)" description="Đổ dữ liệu danh mục nhanh. Nhập theo MÃ (upsert): mã đã có → cập nhật, mã mới → thêm; KHÔNG xóa dữ liệu ngoài file. Chỉ áp dụng cho danh mục — không nhập dữ liệu giao dịch (hóa đơn/buổi…)." />

      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label>Loại dữ liệu</Label>
          <Select className="w-72" value={key} onChange={(e) => setKey(e.target.value)}>
            {groups.map(([g, items]) => <optgroup key={g} label={g}>{items.map((d) => <option key={d.key} value={d.key}>{d.label}{d.canWrite ? "" : " (chỉ xuất)"}</option>)}</optgroup>)}
          </Select>
        </div>
        <Button size="sm" variant="outline" disabled={!key} onClick={() => download("export")}>⬇ Xuất CSV (toàn bộ)</Button>
        <Button size="sm" variant="outline" disabled={!key} onClick={() => download("template")}>⬇ Tải file mẫu</Button>
      </CardContent></Card>

      {ds && (
        <Card><CardContent className="p-4">
          <div className="mb-2 text-sm font-medium">Cột dữ liệu của "{ds.label}"</div>
          <div className="flex flex-wrap gap-1">
            {ds.columns.map((c) => <span key={c.header} className={`rounded border px-2 py-0.5 text-xs ${c.required ? "border-teal-400 bg-teal-50 font-medium" : "border-muted"}`}>{c.header}{c.required ? " *" : ""}{c.type !== "string" ? ` · ${c.type === "enum" ? c.enum?.join("/") : c.ref ? `mã ${c.ref}` : c.type}` : ""}</span>)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">* = bắt buộc. Cột "mã …" điền MÃ của bản ghi liên quan (vd categoryCode = mã nhóm dịch vụ). Ngày định dạng yyyy-MM-dd. Danh sách (roles) ngăn cách bằng dấu | .</div>
        </CardContent></Card>
      )}

      {ds?.canWrite && (
        <Card><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Nhập CSV</div>
            <input type="file" accept=".csv,text/csv" className="ml-auto text-xs" onChange={onFile} />
          </div>
          <textarea className="h-40 w-full rounded border p-2 font-mono text-xs" placeholder="Dán nội dung CSV (dòng đầu là tiêu đề)…" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); setReport(null); }} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!csv.trim() || busy} onClick={doPreview}>Xem trước</Button>
            <Button size="sm" disabled={!preview || busy || preview.counts.willCreate + preview.counts.willUpdate === 0} onClick={doImport}>Nhập ({preview ? preview.counts.willCreate + preview.counts.willUpdate : 0} dòng)</Button>
          </div>
        </CardContent></Card>
      )}
      {ds && !ds.canWrite && <div className="rounded bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Bạn chỉ có quyền <b>xuất</b> loại dữ liệu này (không đủ quyền nhập).</div>}
      {msg && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>}

      {preview && (
        <Card><CardContent className="p-4">
          <div className="mb-2 flex gap-2 text-sm">
            <Badge tone="success">Thêm mới: {preview.counts.willCreate}</Badge>
            <Badge tone="default">Cập nhật: {preview.counts.willUpdate}</Badge>
            <Badge tone="danger">Lỗi: {preview.counts.willError}</Badge>
          </div>
          <div className="max-h-72 overflow-auto"><table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/40 text-left uppercase text-muted-foreground"><th className="px-2 py-1">Dòng</th><th className="px-2 py-1">Mã</th><th className="px-2 py-1">Kết quả</th><th className="px-2 py-1">Ghi chú</th></tr></thead>
            <tbody>{preview.results.map((r: any) => (
              <tr key={r.index} className="border-b last:border-0">
                <td className="px-2 py-1">{r.index + 2}</td><td className="px-2 py-1">{r.key ?? "—"}</td>
                <td className="px-2 py-1">{r.status === "NEW" ? <Badge tone="success">Thêm mới</Badge> : r.status === "UPDATE" ? <Badge tone="default">Cập nhật</Badge> : <Badge tone="danger">Lỗi</Badge>}</td>
                <td className="px-2 py-1 text-red-600">{r.errors.join("; ")}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </CardContent></Card>
      )}

      {report && (
        <Card><CardContent className="p-4">
          <div className="mb-1 text-sm font-medium">Kết quả nhập</div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">Đã thêm: {report.created}</Badge>
            <Badge tone="default">Đã cập nhật: {report.updated}</Badge>
            <Badge tone="danger">Bỏ qua (lỗi): {report.skippedError}</Badge>
            <span className="text-muted-foreground">Tổng {report.total} dòng</span>
          </div>
          {report.errors?.length > 0 && <div className="mt-2 max-h-48 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700">{report.errors.map((e: any) => <div key={e.index}>Dòng {e.index + 2}: {e.reason}</div>)}</div>}
        </CardContent></Card>
      )}
    </div>
  );
}
