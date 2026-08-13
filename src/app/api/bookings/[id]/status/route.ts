export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingStatusUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { logBookingActivity } from "@/lib/booking";
import { BOOKING_STATUS_LABEL } from "@/lib/clinic-labels";

// Chuyển trạng thái lịch hẹn (xác nhận / khách đến / bắt đầu / hoàn thành / hủy /
// không đến). Ghi mốc thời gian, lý do (hủy/không đến), audit và Timeline khách.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const { status, note, reason } = bookingStatusUpdateSchema.parse(await req.json());
  const current = await prisma.booking.findUnique({ where: { id: params.id }, select: { id: true, code: true, customerId: true } });
  if (!current) return fail(404, "Không tìm thấy lịch hẹn");

  const now = new Date();
  const data: Record<string, unknown> = { status, ...(note ? { note } : {}) };
  switch (status) {
    case "CONFIRMED": data.confirmedAt = now; break;
    case "ARRIVED": data.checkedInAt = now; break;
    case "IN_PROGRESS": data.startedAt = now; break;
    case "COMPLETED": data.completedAt = now; break;
    case "CANCELLED":
      data.cancelledAt = now; data.cancelledBy = session.name; data.cancelReason = reason ?? null; break;
    case "NO_SHOW":
      data.noShowAt = now; data.noShowBy = session.name; data.noShowReason = reason ?? null; break;
  }

  const booking = await prisma.booking.update({ where: { id: params.id }, data });
  await auditLog({ userId: session.userId, action: "STATUS_CHANGE", entityType: "Booking", entityId: booking.id, changes: { status, reason: reason ?? undefined } });

  const label = BOOKING_STATUS_LABEL[status] ?? status;
  const suffix = (status === "CANCELLED" || status === "NO_SHOW") && reason ? ` (lý do: ${reason})` : "";
  await logBookingActivity(current.customerId, `Lịch hẹn ${current.code}: ${label}${suffix}`, session.name);

  return ok(booking);
});
