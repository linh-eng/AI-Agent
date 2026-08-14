// =============================================================================
// NHÂN SỰ (mục 8) — master data: đa vai trò + phí theo vai trò (hiệu lực ngày),
// năng lực, lịch làm việc, nghỉ phép → availability + gợi ý cho Booking/Session.
//   * NHÂN SỰ ≠ tài khoản đăng nhập (User/RBAC). Không merge.
//   * isActive/status = còn hoạt động; availability = có ca + không nghỉ + không kẹt booking.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { vnClock } from "./timezone";

function num(v: unknown): number { return v == null ? 0 : Number(v); }

// Các trạng thái booking còn "giữ chỗ" (khớp booking.ts).
const ACTIVE_BOOKING = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "RESCHEDULED"];

/** Phí hiện hành của (nhân sự, vai trò) tại thời điểm `at`. null nếu chưa khai báo. */
export async function resolveRoleFee(
  employeeId: string, role: string, at: Date = new Date(), tx: Prisma.TransactionClient = prisma
): Promise<number | null> {
  const fees = await tx.employeeRoleFee.findMany({
    where: { employeeId, role, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  const hit = fees.find((f) => {
    const from = f.effectiveFrom ? new Date(f.effectiveFrom) : null;
    const to = f.effectiveTo ? new Date(f.effectiveTo) : null;
    // `effectiveTo` là mốc bản KẾ TIẾP bắt đầu → EXCLUSIVE (ngày mốc thuộc bản mới,
    // không chồng lấn). Bản còn hiệu lực khi from ≤ at < to.
    if (from && from.getTime() > at.getTime()) return false;
    if (to && to.getTime() <= at.getTime()) return false;
    return true;
  });
  return hit ? num(hit.fee) : null;
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Nhân sự có ca làm phủ khoảng [from,to) trong ngày đó không (lịch recurring theo thứ). */
export function isWithinSchedule(
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; effectiveFrom?: Date | null; effectiveTo?: Date | null }>,
  from: Date, to: Date
): boolean {
  // Trích wall-clock VN (KHÔNG dùng getHours/getDay — phụ thuộc TZ tiến trình).
  const f = vnClock(from);
  const t = vnClock(to);
  const dow = f.dow;
  const startMin = f.hour * 60 + f.minute;
  const endMin = t.hour * 60 + t.minute;
  return schedules.some((s) => {
    if (s.dayOfWeek !== dow) return false;
    if (s.effectiveFrom && new Date(s.effectiveFrom).getTime() > from.getTime()) return false;
    if (s.effectiveTo && new Date(s.effectiveTo).getTime() < from.getTime()) return false;
    return hhmmToMinutes(s.startTime) <= startMin && hhmmToMinutes(s.endTime) >= endMin;
  });
}

export interface AvailabilityResult {
  active: boolean; // status ACTIVE (còn làm việc)
  working: boolean; // có ca làm phủ khoảng
  onLeave: boolean; // đang nghỉ trong khoảng
  bookingConflict: boolean; // bận với booking khác
  available: boolean; // tổng hợp: đủ điều kiện để phân công
  reasons: string[];
}

/**
 * Tính availability của một nhân sự cho khoảng [from,to). Xét: trạng thái, ca làm,
 * nghỉ phép, và booking đang chiếm thời gian (theo tên nhân sự ở booking).
 */
export async function employeeAvailability(
  employeeId: string, from: Date, to: Date, opts: { excludeBookingId?: string } = {}
): Promise<AvailabilityResult> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { schedules: true },
  });
  if (!emp) return { active: false, working: false, onLeave: false, bookingConflict: false, available: false, reasons: ["Không tìm thấy nhân sự"] };

  const reasons: string[] = [];
  const active = emp.status === "ACTIVE";
  if (!active) reasons.push(emp.status === "RESIGNED" ? "Đã nghỉ việc" : "Tạm nghỉ");

  const working = emp.schedules.length === 0 ? true : isWithinSchedule(emp.schedules as any, from, to);
  if (!working) reasons.push("Ngoài lịch làm việc");

  // Nghỉ phép giao khoảng
  const leave = await prisma.employeeLeave.findFirst({
    where: { employeeId, fromAt: { lt: to }, toAt: { gt: from } },
  });
  const onLeave = !!leave;
  if (onLeave) reasons.push("Đang nghỉ phép/không khả dụng");

  // Booking khác chiếm thời gian (so theo tên ở các trường technician/master/performer)
  const name = emp.fullName;
  const overlapping = await prisma.booking.findMany({
    where: {
      status: { in: ACTIVE_BOOKING as any },
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      OR: [{ technician: name }, { master: name }, { performer: name }, { assistants: { has: name } }],
    },
    select: { scheduledAt: true, durationMinutes: true },
  });
  const bookingConflict = overlapping.some((b) => {
    const s = new Date(b.scheduledAt).getTime();
    const e = s + (b.durationMinutes ?? 60) * 60_000;
    return s < to.getTime() && e > from.getTime();
  });
  if (bookingConflict) reasons.push("Đã có lịch hẹn khác trùng giờ");

  const available = active && working && !onLeave && !bookingConflict;
  return { active, working, onLeave, bookingConflict, available, reasons };
}

/** Nhân sự có năng lực thực hiện dịch vụ/công nghệ không (nếu có yêu cầu). */
export async function hasCompetence(employeeId: string, opts: { serviceId?: string; technologyId?: string }): Promise<boolean> {
  if (!opts.serviceId && !opts.technologyId) return true;
  const comps = await prisma.employeeCompetence.findMany({ where: { employeeId } });
  if (comps.length === 0) return true; // chưa khai báo năng lực → không chặn
  const ok =
    (opts.serviceId && comps.some((c) => c.kind === "SERVICE" && c.refId === opts.serviceId)) ||
    (opts.technologyId && comps.some((c) => c.kind === "TECHNOLOGY" && c.refId === opts.technologyId));
  return !!ok;
}

/**
 * Gợi ý nhân sự cho Booking: đang làm việc + có vai trò phù hợp + (năng lực nếu
 * dịch vụ/công nghệ yêu cầu) + trong ca + không nghỉ + không kẹt booking.
 */
export async function suggestEmployeesForBooking(opts: {
  role?: string; serviceId?: string; technologyId?: string; at: Date; durationMinutes?: number; excludeBookingId?: string;
}): Promise<Array<{ id: string; code: string; fullName: string; roles: string[]; available: boolean; reasons: string[] }>> {
  const to = new Date(opts.at.getTime() + (opts.durationMinutes ?? 60) * 60_000);
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: { roleFees: { where: { isActive: true } }, competences: true },
    orderBy: { fullName: "asc" },
  });
  const result = [];
  for (const e of employees) {
    const roleSet = new Set<string>([...(e.roles ?? []), ...e.roleFees.map((r) => r.role)]);
    if (opts.role && !roleSet.has(opts.role)) continue;
    const comp = await hasCompetence(e.id, { serviceId: opts.serviceId, technologyId: opts.technologyId });
    if (!comp) continue; // thiếu năng lực → không gợi ý
    const av = await employeeAvailability(e.id, opts.at, to, { excludeBookingId: opts.excludeBookingId });
    if (!av.available) continue; // chỉ gợi ý người thực sự rảnh
    result.push({ id: e.id, code: e.code, fullName: e.fullName, roles: [...roleSet], available: av.available, reasons: av.reasons });
  }
  return result;
}

/** KPI read-only từ Session/Đánh giá (mục 15). Không nhập tay. */
export async function employeeKpi(employeeId: string): Promise<{
  totalSessions: number; avgTechScore: number | null; reviewCount: number; avgSatisfaction: number | null; incidents: number;
}> {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true } });
  const name = emp?.fullName ?? "";
  const assignments = await prisma.sessionStaff.findMany({ where: { employeeId }, select: { sessionId: true } });
  const sessionIds = Array.from(new Set(assignments.map((a) => a.sessionId)));

  const [doneCount, reviews, incidents] = await Promise.all([
    prisma.treatmentSession.count({ where: { OR: [{ id: { in: sessionIds } }, { performer: name }], status: "COMPLETED" } }),
    prisma.sessionReview.findMany({ where: { technicianName: name }, select: { technicianScore: true, satisfactionScore: true } }),
    prisma.treatmentSession.count({ where: { OR: [{ id: { in: sessionIds } }, { performer: name }], incident: { not: null } } }),
  ]);
  const techScores = reviews.map((r) => num(r.technicianScore)).filter((x) => x > 0);
  const satScores = reviews.map((r) => num(r.satisfactionScore)).filter((x) => x > 0);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : null);
  return {
    totalSessions: doneCount, reviewCount: reviews.length,
    avgTechScore: avg(techScores), avgSatisfaction: avg(satScores), incidents,
  };
}

/** Vai trò + phí hiện hành của nhân sự (để hiển thị chip + gợi ý fee). */
export async function currentRoleFees(employeeId: string, at: Date = new Date()) {
  const fees = await prisma.employeeRoleFee.findMany({ where: { employeeId, isActive: true }, orderBy: { effectiveFrom: "desc" } });
  const byRole = new Map<string, { role: string; fee: number; effectiveFrom: Date }>();
  for (const f of fees) {
    const from = f.effectiveFrom ? new Date(f.effectiveFrom) : null;
    const to = f.effectiveTo ? new Date(f.effectiveTo) : null;
    if (from && from.getTime() > at.getTime()) continue;
    if (to && to.getTime() <= at.getTime()) continue; // effectiveTo EXCLUSIVE (xem resolveRoleFee)
    if (!byRole.has(f.role)) byRole.set(f.role, { role: f.role, fee: num(f.fee), effectiveFrom: from ?? new Date(f.createdAt) });
  }
  return Array.from(byRole.values());
}
