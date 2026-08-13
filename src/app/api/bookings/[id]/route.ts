export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingUpdateSchema } from "@/lib/clinic-validation";
import { detectBookingConflicts } from "@/lib/booking";

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
  const current = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy booking");
  const { allowConflict, ...parsed } = bookingUpdateSchema.parse(await req.json());
  if (current.status === "COMPLETED") {
    const allowed = { note: parsed.note };
    const booking = await prisma.booking.update({ where: { id: params.id }, data: allowed });
    return ok(booking);
  }

  // Kiểm tra trùng lịch khi đổi giờ/tài nguyên (bỏ qua chính booking này).
  if (!allowConflict) {
    const conflicts = await detectBookingConflicts({
      scheduledAt: parsed.scheduledAt ?? current.scheduledAt,
      durationMinutes: parsed.durationMinutes ?? current.durationMinutes,
      technician: parsed.technician ?? current.technician,
      master: parsed.master ?? current.master,
      room: parsed.room ?? current.room,
      bed: parsed.bed ?? current.bed,
      machine: parsed.machine ?? current.machine,
      excludeId: params.id,
    });
    if (conflicts.length > 0) return fail(409, "Trùng lịch tài nguyên", { conflicts });
  }

  const booking = await prisma.booking.update({ where: { id: params.id }, data: parsed });
  return ok(booking);
});
