"use client";
import { useMemo, useRef, useState } from "react";
import { Upload, ArrowRight, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

// Trường chuẩn của khách hàng để map cột nguồn.
const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "fullName", label: "Họ tên", required: true },
  { key: "phone", label: "Điện thoại" },
  { key: "email", label: "Email" },
  { key: "dob", label: "Ngày sinh" },
  { key: "gender", label: "Giới tính" },
  { key: "address", label: "Địa chỉ" },
  { key: "source", label: "Nguồn" },
  { key: "group", label: "Nhóm" },
  { key: "note", label: "Ghi chú" },
  { key: "legacyId", label: "Mã cũ (đối chiếu)" },
];

// Gợi ý map tự động theo tên cột.
const GUESS: Record<string, string> = {
  "ho ten": "fullName", "hoten": "fullName", "ten": "fullName", "name": "fullName", "fullname": "fullName", "khach hang": "fullName",
  "dien thoai": "phone", "sdt": "phone", "phone": "phone", "so dien thoai": "phone", "mobile": "phone",
  "email": "email", "mail": "email",
  "ngay sinh": "dob", "sinh nhat": "dob", "dob": "dob", "birthday": "dob",
  "gioi tinh": "gender", "gender": "gender", "phai": "gender",
  "dia chi": "address", "address": "address",
  "nguon": "source", "source": "source",
  "nhom": "group", "group": "group", "hang": "group",
  "ghi chu": "note", "note": "note",
  "ma cu": "legacyId", "ma": "legacyId", "id": "legacyId", "legacyid": "legacyId", "myspa": "legacyId",
};

function norm(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
}

// CSV parser đơn giản (hỗ trợ dấu ngoặc kép, phẩy trong ô, xuống dòng).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const SAMPLE = `Họ tên,Điện thoại,Email,Ngày sinh,Giới tính,Nguồn,Mã cũ
Nguyễn Văn A,0901234567,a@example.com,15/03/1990,Nam,MySpa,MYSPA-1001
Trần Thị B,0907654321,,20/11/1988,Nữ,MySpa,MYSPA-1002`;

const STATUS_TONE: Record<string, any> = { NEW: "success", DUPLICATE: "warning", ERROR: "danger" };
const STATUS_LABEL: Record<string, string> = { NEW: "Thêm mới", DUPLICATE: "Trùng", ERROR: "Lỗi" };

export default function ImportCustomersPage() {
  const canWrite = useCan(PERMISSIONS.CUSTOMER_WRITE);
  const [raw, setRaw] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // fieldKey -> header
  const [legacySource, setLegacySource] = useState("MySpa");
  const [analysis, setAnalysis] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function ingest(text: string) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setError("File cần có dòng tiêu đề + ít nhất 1 dòng dữ liệu."); return; }
    setError(null);
    const hdr = parsed[0].map((h) => h.trim());
    setHeaders(hdr);
    setDataRows(parsed.slice(1));
    // auto map
    const auto: Record<string, string> = {};
    hdr.forEach((h) => { const g = GUESS[norm(h)]; if (g && !auto[g]) auto[g] = h; });
    setMapping(auto);
    setAnalysis(null); setSummary(null); setReport(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(String(reader.result)); ingest(String(reader.result)); };
    reader.readAsText(f, "utf-8");
  }

  const mappedRows = useMemo(() => {
    const idx: Record<string, number> = {};
    FIELDS.forEach((f) => { const h = mapping[f.key]; if (h) idx[f.key] = headers.indexOf(h); });
    return dataRows.map((r) => {
      const o: any = {};
      FIELDS.forEach((f) => { const i = idx[f.key]; if (i != null && i >= 0) o[f.key] = r[i]; });
      return o;
    });
  }, [dataRows, headers, mapping]);

  async function preview() {
    setBusy(true); setError(null); setReport(null);
    try {
      const r = await apiFetch<any>("/api/imports/customers/preview", { method: "POST", body: JSON.stringify({ legacySource, rows: mappedRows }) });
      setSummary(r.summary); setAnalysis(r.analysis);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }
  async function doImport() {
    setBusy(true); setError(null);
    try {
      const r = await apiFetch<any>("/api/imports/customers/commit", { method: "POST", body: JSON.stringify({ legacySource, rows: mappedRows }) });
      setReport(r);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  const fullNameMapped = !!mapping.fullName;

  return (
    <div className="space-y-4">
      <PageHeader title="Nhập khách hàng (Import)" description="Nhập từ file MySpa/CSV: xem trước → ghép cột → kiểm tra & phát hiện trùng → nhập + báo cáo. Không ghi đè khách đã có." />
      {!canWrite && <p className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-sm text-amber-700">Bạn cần quyền tạo khách hàng để dùng chức năng này.</p>}

      {/* B1: nạp dữ liệu */}
      <Card><CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> Dán CSV hoặc tải file .csv</div>
        <textarea className="min-h-[120px] w-full rounded-md border bg-background p-2 font-mono text-xs" placeholder="Dán nội dung CSV (dòng đầu là tiêu đề cột)..." value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => ingest(raw)} disabled={!raw.trim()}><ArrowRight className="h-4 w-4" /> Đọc dữ liệu</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Tải file .csv</Button>
          <Button type="button" variant="ghost" onClick={() => { setRaw(SAMPLE); ingest(SAMPLE); }}><Copy className="h-4 w-4" /> Dùng mẫu</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent></Card>

      {/* B2: map cột */}
      {headers.length > 0 && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span> Ghép cột nguồn → trường chuẩn ({dataRows.length} dòng)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-40 text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                <Select className="h-8 flex-1" value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                  <option value="">— bỏ qua —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label className="text-xs">Nguồn dữ liệu (legacySource)</Label><Input className="h-8 w-40" value={legacySource} onChange={(e) => setLegacySource(e.target.value)} /></div>
            <Button type="button" onClick={preview} disabled={busy || !fullNameMapped}>{busy ? "Đang kiểm tra..." : "Kiểm tra & xem trước"}</Button>
            {!fullNameMapped && <span className="text-xs text-destructive">Bắt buộc ghép cột Họ tên.</span>}
          </div>
        </CardContent></Card>
      )}

      {/* B3: preview */}
      {summary && analysis && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span> Kết quả kiểm tra</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge tone="muted">Tổng {summary.total}</Badge>
            <Badge tone="success">Thêm mới {summary.new}</Badge>
            <Badge tone="warning">Trùng {summary.duplicate}</Badge>
            <Badge tone="danger">Lỗi {summary.error}</Badge>
          </div>
          <div className="max-h-80 overflow-auto rounded border">
            <Table>
              <THead><TR><TH>#</TH><TH>Họ tên</TH><TH>Điện thoại</TH><TH>Ngày sinh</TH><TH>Trạng thái</TH><TH>Ghi chú</TH></TR></THead>
              <TBody>
                {analysis.map((a) => (
                  <TR key={a.index}>
                    <TD>{a.index + 1}</TD>
                    <TD>{a.normalized.fullName || <span className="text-destructive">(trống)</span>}</TD>
                    <TD>{a.normalized.phone ?? "—"}</TD>
                    <TD>{a.normalized.dob ? new Date(a.normalized.dob).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</TD>
                    <TD><Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge></TD>
                    <TD className="text-xs text-muted-foreground">{a.status === "ERROR" ? a.errors.join(", ") : a.status === "DUPLICATE" ? `Trùng theo ${a.matchedBy === "phone" ? "SĐT" : a.matchedBy === "legacyId" ? "mã cũ" : "trong lô"}` : ""}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {canWrite && summary.new > 0 && !report && (
            <Button type="button" onClick={doImport} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Đang nhập..." : `Nhập ${summary.new} khách mới (bỏ qua trùng/lỗi)`}</Button>
          )}
        </CardContent></Card>
      )}

      {/* B4: report */}
      {report && (
        <Card className="border-emerald-500/40"><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Hoàn tất nhập</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge tone="success">Đã tạo {report.created}</Badge>
            <Badge tone="warning">Bỏ qua trùng {report.skippedDuplicate}</Badge>
            <Badge tone="danger">Lỗi {report.errorRows}</Badge>
          </div>
          {report.createdCodes?.length > 0 && (
            <p className="text-xs text-muted-foreground">Mã KH đã tạo: {report.createdCodes.join(", ")}</p>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Khách trùng (theo SĐT/mã cũ) KHÔNG bị ghi đè — dữ liệu cũ giữ nguyên.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
