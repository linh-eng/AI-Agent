export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingRescheduleSchema } from "@/lib/clinic-validation";
import { detectBookingConflicts, suggestAlternativeSlots, logBookingActivity } from "@/lib/booking";
import { auditLog } from "@/lib/clinic";
import { VN_TZ } from "@/lib/timezone";

const hhmm = (d: Date) => d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: VN_TZ });
const resStr = (b: { technician?: string | null; master?: string | null; room?: string | null; bed?: string | null; machine?: string | null }) =>
  [b.technician && `KTV ${b.technician}`, b.master && `Master ${b.master}`, b.room && `Phòng ${b.room}`, b.bed && `Giường ${b.bed}`, b.machine && `Máy ${b.machine}`].filter(Boolean).join(", ") || "—";

// ĐỔI LỊCH — KHÔNG xóa lịch cũ; ghi lịch sử (thời gian/tài nguyên cũ→mới, người
// đổi, thời điểm, lý do) và ghi Timeline khách (mục 13).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const body = bookingRescheduleSchema.parse(await req.json());
  const current = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy lịch hẹn");
  if (current.status === "COMPLETED" || current.status === "CANCELLED")
    return fail(400, "Không thể đổi lịch đã hoàn thành/đã hủy.");

  const next = {
    scheduledAt: body.scheduledAt,
    durationMinutes: body.durationMinutes ?? current.durationMinutes,
    technician: body.technician ?? current.technician,
    master: body.master ?? current.master,
    room: body.room ?? current.room,
    bed: body.bed ?? current.bed,
    machine: body.machine ?? current.machine,
  };

  const conflicts = await detectBookingConflicts({ ...next, excludeId: params.id });
  let overrideEntry: unknown = undefined;
  if (conflicts.length > 0) {
    const canOverride = session.permissions.includes(PERMISSIONS.BOOKING_OVERRIDE);
    if (!body.allowConflict) {
      const suggestions = await suggestAlternativeSlots({ ...next, excludeId: params.id, limit: 5 });
      return fail(409, "Trùng lịch tài nguyên", { conflicts, suggestions, canOverride });
    }
    if (!canOverride) return fail(403, "Bạn không có quyền đặt đè lịch trùng — vui lòng đổi giờ/tài nguyên.", { conflicts });
    if (!body.overrideReason || !body.overrideReason.trim()) return fail(400, "Cần nhập lý do khi đặt đè lịch trùng.", { conflicts });
    overrideEntry = { by: session.name, at: new Date().toISOString(), reason: body.overrideReason.trim(), conflicts: conflicts.map((c) => `${c.label} "${c.value}" (${c.bookingCode})`) };
  }

  const history = Array.isArray(current.rescheduleHistory) ? current.rescheduleHistory : [];
  const entry = {
    from: current.scheduledAt.toISOString(),
    to: body.scheduledAt.toISOString(),
    oldResources: resStr(current),
    newResources: resStr(next),
    by: session.name,
    at: new Date().toISOString(),
    reason: body.reason ?? null,
  };
  const overrideLog = Array.isArray(current.overrideLog) ? current.overrideLog : [];

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: {
      ...next,
      rescheduleHistory: [...history, entry] as any,
      ...(overrideEntry ? { overrideLog: [...overrideLog, overrideEntry] as any } : {}),
    },
  });

  await auditLog({ userId: session.userId, action: "BOOKING_RESCHEDULE", entityType: "Booking", entityId: booking.id, changes: entry });
  await logBookingActivity(current.customerId, `Đổi lịch ${current.code}: ${hhmm(current.scheduledAt)} → ${hhmm(body.scheduledAt)}${body.reason ? ` (lý do: ${body.reason})` : ""}`, session.name);

  return ok(booking);
});
