"use client";
import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Checkbox } from "@/components/ui/input";

function Stars({ value, onChange, disabled }: { value: number; onChange?: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => onChange?.(n)} className={disabled ? "" : "cursor-pointer"}>
          <Star className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

/**
 * Đánh giá sau buổi (mục 36–37): khách chấm hài lòng + đánh giá KTV + nhận xét +
 * sẽ quay lại; kèm BÁO CÁO của KTV. 1 đánh giá / buổi (upsert). Self-contained.
 */
export function SessionReview({ sessionId, canWrite, defaultTechnician }: { sessionId: string; canWrite: boolean; defaultTechnician?: string }) {
  const [f, setF] = useState({ satisfactionScore: 0, technicianScore: 0, technicianName: defaultTechnician ?? "", comment: "", wouldReturn: false, technicianReport: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch<any>(`/api/session-reviews?sessionId=${sessionId}`).catch(() => null);
    if (r) setF({
      satisfactionScore: r.satisfactionScore ?? 0, technicianScore: r.technicianScore ?? 0,
      technicianName: r.technicianName ?? defaultTechnician ?? "", comment: r.comment ?? "",
      wouldReturn: !!r.wouldReturn, technicianReport: r.technicianReport ?? "",
    });
  }, [sessionId, defaultTechnician]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      await apiFetch("/api/session-reviews", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          satisfactionScore: f.satisfactionScore || undefined,
          technicianScore: f.technicianScore || undefined,
          technicianName: f.technicianName || undefined,
          comment: f.comment || undefined,
          wouldReturn: f.wouldReturn,
          technicianReport: f.technicianReport || undefined,
        }),
      });
      setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Mức hài lòng</Label><Stars value={f.satisfactionScore} disabled={!canWrite} onChange={(n) => { setF({ ...f, satisfactionScore: n }); setSaved(false); }} /></div>
        <div className="space-y-1"><Label className="text-xs">Đánh giá kỹ thuật viên</Label><Stars value={f.technicianScore} disabled={!canWrite} onChange={(n) => { setF({ ...f, technicianScore: n }); setSaved(false); }} /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Kỹ thuật viên được đánh giá</Label><Input className="h-8" value={f.technicianName} disabled={!canWrite} onChange={(e) => { setF({ ...f, technicianName: e.target.value }); setSaved(false); }} /></div>
      <div className="space-y-1"><Label className="text-xs">Nhận xét của khách</Label><Input className="h-8" value={f.comment} disabled={!canWrite} onChange={(e) => { setF({ ...f, comment: e.target.value }); setSaved(false); }} /></div>
      {canWrite && <label className="flex items-center gap-2 text-xs"><Checkbox checked={f.wouldReturn} onChange={(e) => { setF({ ...f, wouldReturn: e.target.checked }); setSaved(false); }} /> Khách cho biết sẽ quay lại</label>}
      <div className="space-y-1"><Label className="text-xs">Báo cáo của kỹ thuật viên (nội bộ)</Label>
        <textarea className="min-h-[52px] w-full rounded-md border bg-background p-2 text-sm" value={f.technicianReport} disabled={!canWrite} onChange={(e) => { setF({ ...f, technicianReport: e.target.value }); setSaved(false); }} placeholder="Ghi nhận chuyên môn sau buổi: đáp ứng, lưu ý, đề xuất buổi kế..." />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {canWrite && <div className="flex items-center gap-2"><Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu đánh giá"}</Button>{saved && <span className="text-xs text-emerald-600">✓ Đã lưu</span>}</div>}
    </div>
  );
}
