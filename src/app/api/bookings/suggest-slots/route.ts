export const dynamic = "force-dynamic";

import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { suggestAlternativeSlots } from "@/lib/booking";

// Gợi ý khung giờ thay thế còn đủ tài nguyên (mục 12). Dùng khi tạo/đổi lịch bị trùng.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const p = new URL(req.url).searchParams;
  const at = p.get("at");
  if (!at) return fail(400, "Thiếu thời điểm tham chiếu (at)");
  const suggestions = await suggestAlternativeSlots({
    scheduledAt: new Date(at),
    durationMinutes: p.get("durationMinutes") ? Number(p.get("durationMinutes")) : undefined,
    technician: p.get("technician") ?? undefined,
    master: p.get("master") ?? undefined,
    room: p.get("room") ?? undefined,
    bed: p.get("bed") ?? undefined,
    machine: p.get("machine") ?? undefined,
    excludeId: p.get("excludeId") ?? undefined,
    limit: 5,
  });
  return ok(suggestions);
});
