// =============================================================================
// Booking — phát hiện TRÙNG LỊCH tài nguyên (mục 19–21).
// Tài nguyên xét trùng: kỹ thuật viên, master, phòng, giường, máy.
// Hai booking trùng khi: cùng một giá trị tài nguyên (khác rỗng) VÀ khoảng thời
// gian [bắt đầu, kết thúc) giao nhau. Thời lượng mặc định 60' nếu không nhập.
// Bỏ qua các booking đã HỦY / KHÔNG ĐẾN / HOÀN THÀNH (không còn giữ chỗ).
// =============================================================================
import { prisma } from "./prisma";

export const DEFAULT_DURATION_MIN = 60;

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
