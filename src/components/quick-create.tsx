"use client";
// =============================================================================
// QuickCreateButton — nút "+" TẠO NHANH ngay kế bên ô chọn, KHÔNG phải rời trang.
// Tạo xong: gọi onCreated(row) để parent tự THÊM vào danh sách + CHỌN luôn
// → "có kết quả liền" đúng yêu cầu (khỏi quay ra/vào danh mục).
// Dùng cho thực thể đơn giản (chỉ cần Tên; mã/loại tự sinh ở server).
//
// Với thực thể phức tạp (protocol/biểu mẫu…) dùng QuickCreateLink (nút "+" điều
// hướng vào thẳng form tạo ở trang liên quan qua ?new=1).
// =============================================================================
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";

export interface QuickField { key: string; label: string; required?: boolean; placeholder?: string }

export function QuickCreateButton({
  label, endpoint, fields = [{ key: "name", label: "Tên", required: true }], onCreated, className,
}: {
  label: string;               // nhãn ngắn: "Công nghệ", "Sản phẩm"…
  endpoint: string;            // POST endpoint tạo mới
  fields?: QuickField[];
  onCreated: (row: any) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const missing = fields.find((f) => f.required && !(vals[f.key] ?? "").trim());
    if (missing) { setErr(`Vui lòng nhập ${missing.label}`); return; }
    setBusy(true); setErr(null);
    try {
      const body: Record<string, string> = {};
      for (const f of fields) if ((vals[f.key] ?? "").trim()) body[f.key] = vals[f.key].trim();
      const row = await apiFetch<any>(endpoint, { method: "POST", body: JSON.stringify(body) });
      onCreated(row);
      setOpen(false); setVals({});
    } catch (e: any) { setErr(e?.message ?? "Không tạo được"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => { setErr(null); setOpen(true); }}
        className={"inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline " + (className ?? "")}>
        <Plus className="h-3.5 w-3.5" /> Tạo mới
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Tạo nhanh: ${label}`} className="max-w-md">
        <form onSubmit={submit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}{f.required ? " *" : ""}</Label>
              <Input value={vals[f.key] ?? ""} placeholder={f.placeholder}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} autoFocus={f.key === fields[0].key} />
            </div>
          ))}
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Đang tạo…" : "Tạo & chọn"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Nút "+" điều hướng vào thẳng form tạo ở trang liên quan (thực thể phức tạp). */
export function QuickCreateLink({ href, title }: { href: string; title?: string }) {
  return (
    <Link href={href} title={title ?? "Tạo mới ở trang liên quan"}
      className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
      <Plus className="h-3.5 w-3.5" /> Tạo mới
    </Link>
  );
}
