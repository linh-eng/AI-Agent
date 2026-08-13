// =============================================================================
// Booking — phát hiện TRÙNG LỊCH tài nguyên (mục 19–21).
// Tài nguyên xét trùng: kỹ thuật viên, master, phòng, giường, máy.
// Hai booking trùng khi: cùng một giá trị tài nguyên (khác rỗng) VÀ khoảng thời
// gian [bắt đầu, kết thúc) giao nhau. Thời lượng mặc định 60' nếu không nhập.
// Bỏ qua các booking đã HỦY / KHÔNG ĐẾN / HOÀN THÀNH (không còn giữ chỗ).
// =============================================================================
import { prisma } from "./prisma";

export const DEFAULT_DURATION_MIN = 60;

/**
 * Ghi một sự kiện vòng đời lịch hẹn vào nhật ký khách (CrmActivity) để xuất hiện
 * trên Timeline khách (mục 27). Chỉ ghi sự kiện quan trọng, không spam field edit.
 */
export async function logBookingActivity(customerId: string, content: string, by?: string | null): Promise<void> {
  await prisma.crmActivity.create({
    data: { customerId, type: "INTERNAL_NOTE", content, performedBy: by ?? undefined, occurredAt: new Date() },
  });
}

// Trạng thái còn "giữ chỗ" tài nguyên (đang chiếm lịch).
const ACTIVE_STATUSES = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "RESCHEDULED"] as const;

export const BOOKING_RESOURCE_FIELDS = ["technician", "master", "room", "bed", "machine"] as const;
export type BookingResourceField = (typeof BOOKING_RESOURCE_FIELDS)[number];

export const RESOURCE_LABEL: Record<BookingResourceField, string> = {
  technician: "Kỹ thuật viên",
  master: "Master",
  room: "Phòng",
  bed: "Giường",
  machine: "Máy",
};

export interface ConflictInput {
  scheduledAt: Date;
  durationMinutes?: number | null;
  technician?: string | null;
  master?: string | null;
  room?: string | null;
  bed?: string | null;
  machine?: string | null;
  excludeId?: string; // bỏ qua chính booking đang sửa
}

export interface BookingConflict {
  field: BookingResourceField;
  label: string; // nhãn tài nguyên (vd "Kỹ thuật viên")
  value: string; // giá trị trùng (vd "Ngọc")
  bookingId: string;
  bookingCode: string;
  customerName: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
}

function endOf(start: Date, dur?: number | null): Date {
  return new Date(start.getTime() + (dur ?? DEFAULT_DURATION_MIN) * 60_000);
}

/**
 * Trả về danh sách trùng lịch (rỗng nếu không có). Truy vấn các booking đang giữ
 * chỗ có bất kỳ tài nguyên nào trùng, trong cùng ngày, rồi lọc theo giao thời gian.
 */
export async function detectBookingConflicts(input: ConflictInput): Promise<BookingConflict[]> {
  const start = input.scheduledAt;
  const end = endOf(start, input.durationMinutes);

  // Gom các tài nguyên có giá trị để lọc sơ bộ.
  const resourceFilters = BOOKING_RESOURCE_FIELDS.map((f) => {
    const v = (input[f] ?? "").toString().trim();
    return v ? { [f]: v } : null;
  }).filter(Boolean) as Record<string, string>[];
  if (resourceFilters.length === 0) return [];

  // Cửa sổ ngày (đủ rộng để bắt mọi booking có thể giao) — lọc chính xác ở JS.
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(end); dayEnd.setHours(23, 59, 59, 999);

  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ACTIVE_STATUSES as unknown as any[] },
      scheduledAt: { gte: dayStart, lte: dayEnd },
      OR: resourceFilters,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    include: { customer: { select: { fullName: true } } },
    take: 500,
  });

  const conflicts: BookingConflict[] = [];
  for (const b of candidates) {
    const bStart = b.scheduledAt;
    const bEnd = endOf(bStart, b.durationMinutes);
    const overlap = start < bEnd && bStart < end; // giao nhau (nửa mở)
    if (!overlap) continue;
    for (const f of BOOKING_RESOURCE_FIELDS) {
      const want = (input[f] ?? "").toString().trim();
      const have = ((b as any)[f] ?? "").toString().trim();
      if (want && have && want.toLowerCase() === have.toLowerCase()) {
        conflicts.push({
          field: f,
          label: RESOURCE_LABEL[f],
          value: have,
          bookingId: b.id,
          bookingCode: b.code,
          customerName: b.customer.fullName,
          scheduledAt: bStart.toISOString(),
          durationMinutes: b.durationMinutes ?? DEFAULT_DURATION_MIN,
        });
      }
    }
  }
  return conflicts;
}

// Cửa sổ làm việc để gợi ý khung giờ (giờ địa phương của máy chủ).
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;
const SLOT_STEP_MIN = 30;
const SLOT_DAYS_AHEAD = 3;

export interface SlotSuggestion {
  scheduledAt: string; // ISO
}

/**
 * Gợi ý các khung giờ gần nhất còn ĐỦ TÀI NGUYÊN đã chọn (KTV/master/phòng/giường/
 * máy), dựa trên thời lượng dịch vụ. Quét từ thời điểm yêu cầu trở đi trong cửa sổ
 * làm việc (8h–20h) tối đa vài ngày. Không dùng AI — chỉ tìm slot trống.
 * KHÔNG gợi ý nếu KTV/master được đánh dấu NGƯNG HOẠT ĐỘNG (mục 24).
 */
export async function suggestAlternativeSlots(
  input: ConflictInput & { limit?: number }
): Promise<SlotSuggestion[]> {
  const dur = input.durationMinutes ?? DEFAULT_DURATION_MIN;
  const limit = input.limit ?? 5;

  // Chỉ gợi ý khi có ràng buộc tài nguyên (nếu không, mọi giờ đều trống → vô nghĩa).
  const resourceFilters = BOOKING_RESOURCE_FIELDS.map((f) => {
    const v = (input[f] ?? "").toString().trim();
    return v ? { [f]: v } : null;
  }).filter(Boolean) as Record<string, string>[];
  if (resourceFilters.length === 0) return [];

  // Nhân sự ngưng hoạt động → không gợi ý (tránh xếp lịch cho người đã nghỉ).
  const names = [input.technician, input.master].map((v) => (v ?? "").toString().trim()).filter(Boolean);
  if (names.length) {
    const inactive = await prisma.employee.findFirst({ where: { isActive: false, fullName: { in: names } } });
    if (inactive) return [];
  }

  const base = new Date(input.scheduledAt);
  const winStart = new Date(base); winStart.setHours(0, 0, 0, 0);
  const winEnd = new Date(winStart); winEnd.setDate(winEnd.getDate() + SLOT_DAYS_AHEAD); winEnd.setHours(23, 59, 59, 999);

  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ACTIVE_STATUSES as unknown as any[] },
      scheduledAt: { gte: winStart, lte: winEnd },
      OR: resourceFilters,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { scheduledAt: true, durationMinutes: true, technician: true, master: true, room: true, bed: true, machine: true },
    take: 1000,
  });

  const conflictsAt = (cur: Date): boolean => {
    const end = new Date(cur.getTime() + dur * 60_000);
    return candidates.some((b) => {
      const bStart = b.scheduledAt;
      const bEnd = endOf(bStart, b.durationMinutes);
      if (!(cur < bEnd && bStart < end)) return false;
      return BOOKING_RESOURCE_FIELDS.some((f) => {
        const want = (input[f] ?? "").toString().trim();
        const have = ((b as any)[f] ?? "").toString().trim();
        return want && have && want.toLowerCase() === have.toLowerCase();
      });
    });
  };

  const out: SlotSuggestion[] = [];
  for (let day = 0; day < SLOT_DAYS_AHEAD + 1 && out.length < limit; day++) {
    const dayRef = new Date(base); dayRef.setDate(base.getDate() + day); dayRef.setHours(0, 0, 0, 0);
    let cur = new Date(dayRef);
    if (day === 0) {
      // Ngày đầu: bắt đầu từ giờ yêu cầu, làm tròn LÊN theo bước.
      cur = new Date(base);
      const rounded = Math.ceil(cur.getMinutes() / SLOT_STEP_MIN) * SLOT_STEP_MIN;
      cur.setMinutes(0, 0, 0); cur = new Date(cur.getTime() + rounded * 60_000);
      if (cur.getHours() < SLOT_START_HOUR) cur.setHours(SLOT_START_HOUR, 0, 0, 0);
    } else {
      cur.setHours(SLOT_START_HOUR, 0, 0, 0);
    }
    const dayEnd = new Date(dayRef); dayEnd.setHours(SLOT_END_HOUR, 0, 0, 0);
    while (cur < dayEnd && out.length < limit) {
      const end = new Date(cur.getTime() + dur * 60_000);
      if (end <= dayEnd && !conflictsAt(cur)) out.push({ scheduledAt: new Date(cur).toISOString() });
      cur = new Date(cur.getTime() + SLOT_STEP_MIN * 60_000);
    }
  }
  return out;
}
