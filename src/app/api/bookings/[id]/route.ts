export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingUpdateSchema } from "@/lib/clinic-validation";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { code: true, fullName: true, phone: true } },
      service: true,
      payments: true,
      session: true,
    },
  });
  if (!booking) return fail(404, "Không tìm thấy booking");
  return ok(booking);
});

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.BOOKING_WRITE);
  // Booking đã hoàn thành: khóa dữ liệu lịch sử (mục 30) — chỉ cho ghi chú.
  const current = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { status: true },
  });
  if (!current) return fail(404, "Không tìm thấy booking");
  const parsed = bookingUpdateSchema.parse(await req.json());
  if (current.status === "COMPLETED") {
    const allowed = { note: parsed.note };
    const booking = await prisma.booking.update({ where: { id: params.id }, data: allowed });
    return ok(booking);
  }
  const booking = await prisma.booking.update({ where: { id: params.id }, data: parsed });
  return ok(booking);
});
