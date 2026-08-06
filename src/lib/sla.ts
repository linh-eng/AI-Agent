// =============================================================================
// Bảng SLA cấu hình được (mục A6 quy trình). Quá hạn -> cảnh báo đỏ.
// Có thể chuyển sang bảng cấu hình DB sau; hiện để hằng số tập trung.
// =============================================================================
export const SLA_DAYS = {
  DAMAGED: 15, // K-HH: chốt hướng xử lý trong 15 ngày
  VENDOR_RETURN: 7, // đổi hàng lỗi NCC 7 ngày
  VENDOR_RMA: 30, // K-BH-NCC mặc định 30 ngày theo hãng
  REPAIR_QUOTE: 10, // K-SC chờ duyệt báo giá 10 ngày
  PROJECT_STOCK: 30, // K-DA tồn sau nghiệm thu 30 ngày
} as const;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86400000);
}

/** Số ngày quá hạn (âm nếu còn hạn). */
export function overdueDays(dueDate: Date | string | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function isOverdue(dueDate: Date | string | null | undefined, now = new Date()): boolean {
  return overdueDays(dueDate, now) > 0;
}

// ---------------------------------------------------------------------------
// v1.5 — Giờ làm việc & màu cảnh báo (mục 7). Mặc định T2–T7, 08:00–17:00.
// (Cấu hình được ở Quản trị sau — hiện để hằng số.)
// ---------------------------------------------------------------------------
export const WORK_HOURS = { startHour: 8, endHour: 17, workSunday: false } as const;

/** Giờ làm việc mỗi ngày. */
const MINUTES_PER_WORKDAY = (WORK_HOURS.endHour - WORK_HOURS.startHour) * 60;

function isWorkday(d: Date): boolean {
  const day = d.getDay(); // 0=CN
  if (day === 0) return WORK_HOURS.workSunday;
  return true; // T2..T7 làm việc
}

/** Cộng thêm `minutes` giờ-làm-việc vào mốc `base`, trả về Date. */
export function addWorkingMinutes(base: Date, minutes: number): Date {
  let cur = new Date(base);
  let remaining = minutes;
  // Đưa con trỏ vào trong giờ làm việc trước
  const clampIntoWork = () => {
    while (true) {
      if (!isWorkday(cur)) {
        cur.setDate(cur.getDate() + 1);
        cur.setHours(WORK_HOURS.startHour, 0, 0, 0);
        continue;
      }
      const h = cur.getHours() + cur.getMinutes() / 60;
      if (h < WORK_HOURS.startHour) {
        cur.setHours(WORK_HOURS.startHour, 0, 0, 0);
      } else if (h >= WORK_HOURS.endHour) {
        cur.setDate(cur.getDate() + 1);
        cur.setHours(WORK_HOURS.startHour, 0, 0, 0);
        continue;
      }
      break;
    }
  };
  clampIntoWork();
  let guard = 0;
  while (remaining > 0 && guard++ < 100000) {
    const endOfDay = new Date(cur);
    endOfDay.setHours(WORK_HOURS.endHour, 0, 0, 0);
    const availMin = (endOfDay.getTime() - cur.getTime()) / 60000;
    if (remaining <= availMin) {
      cur = new Date(cur.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availMin;
      cur = new Date(endOfDay.getTime());
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_HOURS.startHour, 0, 0, 0);
      clampIntoWork();
    }
  }
  return cur;
}

export function addWorkingHours(base: Date, hours: number): Date {
  return addWorkingMinutes(base, hours * 60);
}

export function addWorkingDays(base: Date, days: number): Date {
  return addWorkingMinutes(base, days * MINUTES_PER_WORKDAY);
}

/** Màu cảnh báo theo % thời hạn còn lại (mục 7.2). */
export type SlaColor = "green" | "yellow" | "orange" | "red";
export function slaColor(
  deadline: Date | string | null | undefined,
  createdAt: Date | string | null | undefined,
  now = new Date()
): SlaColor {
  if (!deadline) return "green";
  const dl = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (now.getTime() > dl.getTime()) return "red";
  const start = createdAt ? (typeof createdAt === "string" ? new Date(createdAt) : createdAt) : now;
  const total = dl.getTime() - start.getTime();
  if (total <= 0) return "green";
  const leftRatio = (dl.getTime() - now.getTime()) / total;
  if (leftRatio > 0.5) return "green";
  if (leftRatio > 0.2) return "yellow";
  return "orange";
}
