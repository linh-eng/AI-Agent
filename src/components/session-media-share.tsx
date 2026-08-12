"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { mediaSrc } from "@/lib/utils";
import { Checkbox } from "@/components/ui/input";

interface MediaItem {
  id: string;
  filename: string;
  kind: string;
  sharedWithCustomer: boolean;
}

/**
 * Quản lý CHIA SẺ media của buổi cho khách xem trên Cổng khách.
 * Mặc định RIÊNG TƯ; chỉ khi nhân viên bật rõ ràng thì khách mới thấy được.
 */
export function SessionMediaShare({ sessionId, canShare }: { sessionId: string; canShare: boolean }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await apiFetch<MediaItem[]>(`/api/media?sessionId=${sessionId}`)); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { load(); }, [load]);

  async function toggle(id: string, shared: boolean) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, sharedWithCustomer: shared } : m)));
    await apiFetch(`/api/media/${id}`, { method: "PATCH", body: JSON.stringify({ sharedWithCustomer: shared }) }).catch(() => load());
  }

  if (loading) return <p className="text-xs text-muted-foreground">Đang tải media...</p>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground">Chưa có ảnh nào cho buổi này.</p>;

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((m) => (
        <div key={m.id} className="w-24 space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(m.id)} alt={m.filename} className="h-24 w-24 rounded border object-cover" />
          <label className="flex items-center gap-1 text-[11px]">
            <Checkbox checked={m.sharedWithCustomer} disabled={!canShare} onChange={(e) => toggle(m.id, e.target.checked)} />
            {m.sharedWithCustomer ? <span className="text-emerald-600">Khách thấy</span> : <span className="text-muted-foreground">Riêng tư</span>}
          </label>
        </div>
      ))}
    </div>
  );
}
