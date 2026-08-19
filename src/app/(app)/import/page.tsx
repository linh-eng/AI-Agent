"use client";
import { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Result { created: number; total: number; errors: { row: string; message: string }[] }

const SECTIONS = [
  { entity: "product", label: "Sản phẩm", perm: PERMISSIONS.PRODUCT_WRITE,
    desc: "Nhập danh mục sản phẩm: SKU, tên, nhóm hàng, thương hiệu, chế độ tồn, HSD, định mức…" },
  { entity: "asset", label: "Tài sản / Thiết bị", perm: PERMISSIONS.ASSET_WRITE,
    desc: "Nhập thiết bị theo serial kèm bảo hành, khấu hao, hợp đồng (mã tài sản tự sinh)." },
  { entity: "inbound", label: "Nhập kho", perm: PERMISSIONS.INBOUND_WRITE,
    desc: "Nhập phiếu nhập nhiều dòng — gộp theo 'Mã phiếu'. Tự sinh lô + ghi sổ tồn." },
  { entity: "outbound", label: "Xuất kho", perm: PERMISSIONS.OUTBOUND_WRITE,
    desc: "Nhập phiếu xuất nhiều dòng — gộp theo 'Mã phiếu'. Tự phân bổ lô theo FEFO." },
] as const;

function ImportCard({ entity, label, desc }: { entity: string; label: string; desc: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/import/${entity}`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Nhập thất bại");
      setResult(json.data as Result);
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id={entity} className="scroll-mt-20">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{label}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a href={`/api/import/template?entity=${entity}`}>
                <Button variant="outline" size="sm" type="button">
                  <Download className="h-4 w-4" /> Tải form mẫu
                </Button>
              </a>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
              />
              <Button variant="outline" size="sm" type="button" onClick={() => inputRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4" /> {file ? "Đổi file" : "Chọn file"}
              </Button>
              {file && <span className="text-sm text-muted-foreground truncate max-w-[220px]">{file.name}</span>}
              <Button size="sm" type="button" onClick={upload} disabled={!file || busy}>
                <Upload className="h-4 w-4" /> {busy ? "Đang nhập…" : "Nhập lên hệ thống"}
              </Button>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-none" /> <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="mt-3">
                <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${result.errors.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {result.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>
                    Thành công <b>{result.created}/{result.total}</b>
                    {result.errors.length > 0 && <> · Lỗi <b>{result.errors.length}</b></>}
                  </span>
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-2 overflow-x-auto rounded-md border">
                    <Table>
                      <THead><TR><TH>Dòng / Phiếu</TH><TH>Lý do</TH></TR></THead>
                      <TBody>
                        {result.errors.map((e, i) => (
                          <TR key={i}>
                            <TD className="whitespace-nowrap font-medium">{e.row}</TD>
                            <TD className="text-destructive">{e.message}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ImportPage() {
  const perms = {
    "product.write": useCan(PERMISSIONS.PRODUCT_WRITE),
    "asset.write": useCan(PERMISSIONS.ASSET_WRITE),
    "inbound.write": useCan(PERMISSIONS.INBOUND_WRITE),
    "outbound.write": useCan(PERMISSIONS.OUTBOUND_WRITE),
  } as Record<string, boolean>;
  const visible = SECTIONS.filter((s) => perms[s.perm]);

  return (
    <div>
      <PageHeader
        title="Nhập liệu bằng Excel"
        description="Tải form mẫu, điền dữ liệu rồi tải lên để tạo hàng loạt. Hệ thống kiểm tra và báo lỗi từng dòng."
      />
      <div className="mb-4 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <b className="text-foreground">Cách dùng:</b> ① Bấm <b>Tải form mẫu</b> → ② mở bằng Excel, đọc sheet <b>“Hướng dẫn”</b> rồi điền
        vào sheet dữ liệu (không xóa dòng tiêu đề) → ③ <b>Chọn file</b> → ④ <b>Nhập lên hệ thống</b>. Các mã tham chiếu
        (nhóm hàng, kho, NCC, SKU) phải đã tồn tại trong hệ thống.
      </div>
      {visible.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Tài khoản của bạn chưa có quyền nhập liệu cho mục nào.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {visible.map((s) => <ImportCard key={s.entity} entity={s.entity} label={s.label} desc={s.desc} />)}
        </div>
      )}
    </div>
  );
}
