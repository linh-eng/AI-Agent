export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingStatusUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const { status, note } = bookingStatusUpdateSchema.parse(await req.json());
  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: { status, ...(note ? { note } : {}) },
  });
  await auditLog({
    userId: session.userId,
    action: "STATUS_CHANGE",
    entityType: "Booking",
    entityId: booking.id,
    changes: { status },
  });
  return ok(booking);
});
