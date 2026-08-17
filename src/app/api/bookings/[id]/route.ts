export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingUpdateSchema } from "@/lib/clinic-validation";
import { detectBookingConflicts, suggestAlternativeSlots } from "@/lib/booking";
import { auditLog } from "@/lib/clinic";
import { bookingItemInclude, snapshotBookingItems, totalItemsDuration, missingServiceIds, itemsForRead } from "@/lib/booking-items";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, code: true, fullName: true, phone: true } },
      service: true,
      payments: true,
      session: { select: { id: true, sessionNumber: true, status: true } },
      ...bookingItemInclude, // Redesign P3
    },
  });
  if (!booking) return fail(404, "Không tìm thấy lịch hẹn");

  // Giải tên phác đồ / giai đoạn (soft ref, không dùng quan hệ Prisma).
  let plan: { id: string; code: string; name: string } | null = null;
  let stage: { id: string; name: string } | null = null;
  if (booking.planId) {
    plan = await prisma.treatmentPlan.findUnique({ where: { id: booking.planId }, select: { id: true, code: true, name: true } });
  }
  if (booking.stageId) {
    stage = await prisma.treatmentStage.findUnique({ where: { id: booking.stageId }, select: { id: true, name: true } });
  }
  // Dual-read: booking cũ chưa có item → tổng hợp 1 item ảo từ serviceId (không ghi DB).
  const items = itemsForRead(booking);
  const totalDuration = (booking as any).items?.length ? totalItemsDuration((booking as any).items) : (booking.durationMinutes ?? totalItemsDuration(items));
  return ok({ ...booking, plan, stage, items, totalDuration });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const current = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy lịch hẹn");
  const { allowConflict, overrideReason, allowBelowFloor, items, ...rest } = bookingUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = { ...rest };

  // Lịch đã HOÀN THÀNH: khóa dữ liệu lịch sử (chỉ cho sửa ghi chú).
  if (current.status === "COMPLETED") {
    const booking = await prisma.booking.update({ where: { id: params.id }, data: { note: rest.note } });
    return ok(booking);
  }

  // Redesign P3 — thay TOÀN BỘ danh sách hạng mục nếu gửi `items` (add/remove/reorder).
  let itemsSnap: Awaited<ReturnType<typeof snapshotBookingItems>> | null = null;
  if (items !== undefined) {
    const missing = await missingServiceIds(items.map((i) => i.serviceId));
    if (missing.length) return fail(422, `Dịch vụ không tồn tại: ${missing.join(", ")}`);
    itemsSnap = await snapshotBookingItems(items);
    // Dịch vụ chính = item đầu; tổng thời lượng = Σ item (trừ khi có durationMinutes thủ công).
    if (items.length > 0) {
      data.serviceId = rest.serviceId ?? items[0].serviceId;
      if (rest.durationMinutes == null) data.durationMinutes = totalItemsDuration(itemsSnap);
    }
  }

  const next = {
    scheduledAt: rest.scheduledAt ?? current.scheduledAt,
    durationMinutes: rest.durationMinutes ?? current.durationMinutes,
    technician: rest.technician ?? current.technician,
    master: rest.master ?? current.master,
    room: rest.room ?? current.room,
    bed: rest.bed ?? current.bed,
    machine: rest.machine ?? current.machine,
  };
  const conflicts = await detectBookingConflicts({ ...next, excludeId: params.id });
  if (conflicts.length > 0) {
    const canOverride = session.permissions.includes(PERMISSIONS.BOOKING_OVERRIDE);
    if (!allowConflict) {
      const suggestions = await suggestAlternativeSlots({ ...next, excludeId: params.id, limit: 5 });
      return fail(409, "Trùng lịch tài nguyên", { conflicts, suggestions, canOverride });
    }
    if (!canOverride) return fail(403, "Bạn không có quyền đặt đè lịch trùng — vui lòng đổi giờ/tài nguyên.", { conflicts });
    if (!overrideReason || !overrideReason.trim()) return fail(400, "Cần nhập lý do khi đặt đè lịch trùng.", { conflicts });
    const log = Array.isArray(current.overrideLog) ? current.overrideLog : [];
    data.overrideLog = [...log, { by: session.name, at: new Date().toISOString(), reason: overrideReason.trim(), conflicts: conflicts.map((c) => `${c.label} "${c.value}" (${c.bookingCode})`) }];
    await auditLog({ userId: session.userId, action: "BOOKING_OVERRIDE", entityType: "Booking", entityId: params.id, changes: { reason: overrideReason } });
  }

  const booking = await prisma.$transaction(async (tx) => {
    if (itemsSnap !== null) {
      await tx.bookingItem.deleteMany({ where: { bookingId: params.id } });
    }
    return tx.booking.update({
      where: { id: params.id },
      data: { ...data, ...(itemsSnap !== null ? { items: { create: itemsSnap } } : {}) },
    });
  });

  if (itemsSnap !== null) {
    await auditLog({
      userId: session.userId,
      action: "BOOKING_ITEMS_CHANGED",
      entityType: "Booking",
      entityId: params.id,
      changes: { after: (items ?? []).map((it, i) => ({ sortOrder: i, serviceId: it.serviceId })), count: items?.length ?? 0 },
    });
  }
  return ok(booking);
});
