"use client";
import { useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { mediaSrc } from "@/lib/utils";

/**
 * Upload media riêng tư (ảnh/tệp) -> lưu qua /api/media, giá trị là danh sách
 * media asset id (KHÔNG phải URL công khai). Hiển thị qua /api/media/[id] có kiểm quyền.
 */
export function MediaUpload({
  value,
  onChange,
  kind = "IMAGE",
  customerId,
  sessionId,
  disabled,
  accept = "image/*",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  kind?: string;
  customerId?: string;
  sessionId?: string;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        if (customerId) fd.append("customerId", customerId);
        if (sessionId) fd.append("sessionId", sessionId);
        const res = await fetch("/api/media", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Upload lỗi");
        added.push(json.data.id);
      }
      onChange([...value, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload lỗi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isImage = accept.startsWith("image");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <div key={id} className="relative h-16 w-16 overflow-hidden rounded border bg-muted">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc(id)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            )}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex h-16 w-16 flex-col items-center justify-center rounded border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
            <Upload className="h-4 w-4" />
            {busy ? "..." : "Tải lên"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
