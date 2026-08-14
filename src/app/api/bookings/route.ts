export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";
import { resolvePrice } from "@/lib/pricing";
import { detectBookingConflicts, suggestAlternativeSlots, logBookingActivity } from "@/lib/booking";
import { checkServicePriceFloor } from "@/lib/price-floor";
import { createDeposit } from "@/lib/deposit";
import { employeeAvailability } from "@/lib/hr";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const url = new URL(req.url);
  const p = url.searchParams;
  const customerId = p.get("customerId") ?? undefined;
  const status = p.get("status") ?? undefined;
  const technician = p.get("technician")?.trim();
  const serviceId = p.get("serviceId") ?? undefined;
  const room = p.get("room")?.trim();
  const machine = p.get("machine")?.trim();
  const from = p.get("from");
  const to = p.get("to");

  const bookings = await prisma.booking.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(technician ? { technician: { contains: technician, mode: "insensitive" } } : {}),
      ...(room ? { room: { contains: room, mode: "insensitive" } } : {}),
      ...(machine ? { machine: { contains: machine, mode: "insensitive" } } : {}),
      ...(from || to
        ? { scheduledAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: {
      customer: { select: { code: true, fullName: true, phone: true } },
      service: { select: { name: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 500,
  });
  return ok(bookings);
});

// Tóm tắt conflict để lưu vào overrideLog (audit).
function summarizeConflicts(conflicts: { label: string; value: string; bookingCode: string }[]) {
  return conflicts.map((c) => `${c.label} "${c.value}" (đụng ${c.bookingCode})`);
}

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const { allowConflict, allowBelowFloor, overrideReason, sessionId, ...parsed } = bookingCreateSchema.parse(
    await req.json(),
  );
  const code = parsed.code ?? sequentialCode("BK", await prisma.booking.count());

  // Tự lấy thời lượng chuẩn từ dịch vụ nếu chưa nhập (mục 5).
  let durationMinutes = parsed.durationMinutes ?? undefined;
  if ((durationMinutes == null || durationMinutes <= 0) && parsed.serviceId) {
    const svc = await prisma.service.findUnique({ where: { id: parsed.serviceId }, select: { durationMinutes: true } });
    if (svc?.durationMinutes) durationMinutes = svc.durationMinutes;
  }

  // Kiểm tra khả dụng NHÂN SỰ đã chọn (mục 8.10–11): nghỉ việc → chặn cứng; nghỉ
  // phép/ngoài ca → cảnh báo, cần allowConflict để lưu đè. So theo tên với danh mục NS.
  {
    const start = new Date(parsed.scheduledAt);
    const end = new Date(start.getTime() + (durationMinutes ?? 60) * 60_000);
    const names = [parsed.technician, parsed.master, ...(parsed.assistants ?? [])].filter(Boolean) as string[];
    const staffIssues: Array<{ name: string; reasons: string[]; resigned: boolean }> = [];
    for (const nm of Array.from(new Set(names))) {
      const emp = await prisma.employee.findFirst({ where: { fullName: nm }, select: { id: true, status: true } });
      if (!emp) continue; // tên tự do không khớp danh mục → bỏ qua
      const av = await employeeAvailability(emp.id, start, end);
      if (!av.available) staffIssues.push({ name: nm, reasons: av.reasons, resigned: emp.status === "RESIGNED" });
    }
    if (staffIssues.length > 0) {
      const hardBlock = staffIssues.some((s) => s.resigned);
      if (hardBlock) return fail(409, "Nhân sự đã nghỉ việc — không thể phân công", { staffUnavailable: staffIssues });
      if (!allowConflict) return fail(409, "Nhân sự không khả dụng (nghỉ phép/ngoài ca/trùng lịch)", { staffUnavailable: staffIssues });
    }
  }

  // Phát hiện trùng lịch tài nguyên theo khoảng [bắt đầu, kết thúc) (mục 9–10).
  let overrideLog: unknown = undefined;
  const conflicts = await detectBookingConflicts({
    scheduledAt: parsed.scheduledAt,
    durationMinutes,
    technician: parsed.technician,
    master: parsed.master,
    room: parsed.room,
    bed: parsed.bed,
    machine: parsed.machine,
  });
  if (conflicts.length > 0) {
    const canOverride = session.permissions.includes(PERMISSIONS.BOOKING_OVERRIDE);
    if (!allowConflict) {
      // Gợi ý khung giờ thay thế còn đủ tài nguyên (mục 12).
      const suggestions = await suggestAlternativeSlots({
        scheduledAt: parsed.scheduledAt, durationMinutes,
        technician: parsed.technician, master: parsed.master, room: parsed.room, bed: parsed.bed, machine: parsed.machine,
        limit: 5,
      });
      return fail(409, "Trùng lịch tài nguyên", { conflicts, suggestions, canOverride });
    }
    // Xin đặt đè: chỉ user có quyền + BẮT BUỘC lý do (mục 11).
    if (!canOverride) return fail(403, "Bạn không có quyền đặt đè lịch trùng — vui lòng đổi giờ/tài nguyên.", { conflicts });
    if (!overrideReason || !overrideReason.trim()) return fail(400, "Cần nhập lý do khi đặt đè lịch trùng.", { conflicts });
    overrideLog = [{ by: session.name, at: new Date().toISOString(), reason: overrideReason.trim(), conflicts: summarizeConflicts(conflicts) }];
  }

  // Chốt giá tại thời điểm booking (snapshot). Ưu tiên bảng giá có hiệu lực.
  let price = parsed.price ?? undefined;
  if (price === undefined && parsed.serviceId) {
    const resolved = await resolvePrice("SERVICE", parsed.serviceId, { at: parsed.scheduledAt, branch: parsed.branch ?? undefined });
    if (resolved) price = resolved.price;
    else {
      const svc = await prisma.service.findUnique({ where: { id: parsed.serviceId }, select: { standardPrice: true } });
      if (svc) price = Number(svc.standardPrice);
    }
  }

  // Giá sàn (mục 26): bán dưới sàn cần quyền override + xác nhận riêng.
  if (parsed.serviceId && price != null) {
    const check = await checkServicePriceFloor(parsed.serviceId, Number(price));
    if (check.below) {
      const canOverride = session.permissions.includes(PERMISSIONS.PRICEFLOOR_OVERRIDE);
      if (!allowBelowFloor || !canOverride) {
        return fail(409, "Giá dưới giá sàn", {
          priceFloor: { ...check, canOverride, reason: canOverride ? "Giá bán thấp hơn giá sàn — cần xác nhận duyệt." : "Giá bán thấp hơn giá sàn — cần người có quyền duyệt bán dưới sàn." },
        });
      }
    }
  }

  const booking = await prisma.booking.create({
    data: {
      ...parsed,
      code,
      durationMinutes: durationMinutes ?? null,
      price: price ?? null,
      createdBy: session.name,
      overrideLog: overrideLog as any,
    },
    include: { customer: { select: { fullName: true } }, service: { select: { name: true } } },
  });

  // Gắn ngược buổi dự kiến của phác đồ (mục 11–12): buổi ↔ lịch hẹn, giữ 1 buổi ↔ 1 booking.
  if (sessionId) {
    try {
      await prisma.treatmentSession.update({
        where: { id: sessionId },
        data: {
          bookingId: booking.id,
          ...(booking.scheduledAt ? { scheduledAt: booking.scheduledAt } : {}),
          ...(parsed.planId ? { planId: parsed.planId } : {}),
          ...(parsed.stageId ? { stageId: parsed.stageId } : {}),
        },
      });
    } catch {
      // buổi không tồn tại hoặc đã gắn booking khác — bỏ qua, không chặn tạo lịch
    }
  }

  // Tiền cọc lịch hẹn (mục 17) → tạo bản ghi tiền thật (Deposit, ACTIVE) để có thể
  // phân bổ vào hóa đơn sau này. Chỉ tạo khi người dùng có quyền thu cọc; Booking.deposit
  // chỉ là con số tham chiếu, KHÔNG được cộng vào công nợ (tránh đếm trùng).
  if (Number(parsed.deposit) > 0 && session.permissions.includes(PERMISSIONS.DEPOSIT_WRITE)) {
    try {
      const dep = await createDeposit({
        customerId: booking.customerId,
        bookingId: booking.id,
        amount: Number(parsed.deposit),
        receivedBy: session.name,
        note: `Cọc lịch hẹn ${booking.code}`,
      });
      await auditLog({ userId: session.userId, action: "DEPOSIT_CREATED", entityType: "Deposit", entityId: dep.id, changes: { bookingId: booking.id, amount: Number(parsed.deposit) } });
    } catch {
      // không chặn tạo lịch nếu tạo cọc lỗi
    }
  }

  // Timeline khách + audit (mục 27).
  await logBookingActivity(booking.customerId, `Tạo lịch hẹn ${booking.code}${booking.service ? " · " + booking.service.name : ""}`, session.name);
  if (overrideLog) {
    await auditLog({ userId: session.userId, action: "BOOKING_OVERRIDE", entityType: "Booking", entityId: booking.id, changes: { reason: overrideReason, conflicts: summarizeConflicts(conflicts) } });
    await logBookingActivity(booking.customerId, `Đặt đè lịch trùng ${booking.code} (lý do: ${overrideReason!.trim()}; đụng: ${summarizeConflicts(conflicts).join(", ")})`, session.name);
  }
  await auditLog({ userId: session.userId, action: "CREATE", entityType: "Booking", entityId: booking.id, changes: { code, scheduledAt: booking.scheduledAt } });

  return created(booking);
});
