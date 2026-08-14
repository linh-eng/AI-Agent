export const dynamic = "force-dynamic";

import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { suggestEmployeesForBooking } from "@/lib/hr";

// Gợi ý nhân sự cho Booking: đang làm việc + vai trò phù hợp + năng lực + trong ca +
// không nghỉ + không kẹt booking (mục 10). at (ISO), role, serviceId, technologyId, duration.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.STAFF_READ);
  const p = new URL(req.url).searchParams;
  const at = p.get("at");
  if (!at) return fail(400, "Thiếu thời điểm (at)");
  const list = await suggestEmployeesForBooking({
    role: p.get("role") ?? undefined,
    serviceId: p.get("serviceId") ?? undefined,
    technologyId: p.get("technologyId") ?? undefined,
    at: new Date(at),
    durationMinutes: p.get("duration") ? Number(p.get("duration")) : undefined,
    excludeBookingId: p.get("excludeBookingId") ?? undefined,
  });
  return ok(list);
});
