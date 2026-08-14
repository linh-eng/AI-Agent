// =============================================================================
// MÚI GIỜ — CHUẨN HIỂN THỊ NGHIỆP VỤ: Asia/Ho_Chi_Minh (UTC+7, KHÔNG DST).
// -----------------------------------------------------------------------------
// MÔ HÌNH (thống nhất toàn app — layer dùng chung, KHÔNG vá từng màn):
//   * LƯU TRỮ = true-UTC (instant thật). Prisma/`now()` lưu UTC; thời gian người
//     dùng nhập (giờ VN) được CHUYỂN sang UTC trước khi lưu (trừ 7h).
//   * HIỂN THỊ = luôn convert sang Asia/Ho_Chi_Minh. MỌI chỗ format ngày giờ
//     (formatDate/formatDateTime/formatTime + mọi toLocale* trong UI) đều đặt
//     `timeZone: "Asia/Ho_Chi_Minh"` → cùng một record hiển thị GIỐNG NHAU ở mọi
//     màn, bất kể múi giờ trình duyệt/máy chủ.
//   * LOGIC LỊCH (thứ/giờ/phút cho availability) qua `vnClock()` = convert UTC→VN.
//   * NHẬP LIỆU datetime-local (giờ VN, không kèm offset) qua `parseVnLocal()` →
//     true-UTC (trừ 7h). Chuỗi đã có offset/Z → tôn trọng; chuỗi chỉ-ngày giữ nguyên.
// Vì VN cố định UTC+7 (không giờ mùa hè), dùng offset cố định — chính xác, không
// cần thư viện tz.
// =============================================================================

export const VN_TZ = "Asia/Ho_Chi_Minh";
export const VN_OFFSET_MINUTES = 7 * 60; // UTC+7, không DST

/**
 * Chuẩn hóa input thời gian → true-UTC Date:
 *  - Date → giữ nguyên.
 *  - "yyyy-MM-dd" (chỉ ngày) → UTC 00:00 (dob / ngày kế hoạch — không có giờ).
 *  - "…Z" / "…±hh:mm" (đã có múi giờ) → tôn trọng nguyên trạng.
 *  - "yyyy-MM-ddTHH:mm[:ss]" (datetime-local, GIỜ VN) → true-UTC (trừ 7h).
 */
export function parseVnLocal(input: string | Date): Date {
  if (input instanceof Date) return input;
  const s = String(input).trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!m) return new Date(s); // định dạng lạ → để JS tự parse
  const [, y, mo, d, hh, mi, ss, tz] = m;
  if (tz) return new Date(s); // đã có múi giờ → tôn trọng
  if (hh === undefined) return new Date(`${y}-${mo}-${d}T00:00:00.000Z`); // chỉ ngày
  const utcMs =
    Date.UTC(+y, +mo - 1, +d, +hh, +mi, ss ? +ss : 0) - VN_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

/** true-UTC instant → wall-clock VN (thứ 0–6, giờ, phút, ngày/tháng/năm). */
export function vnClock(d: Date): {
  dow: number; hour: number; minute: number; year: number; month: number; day: number;
} {
  const v = new Date(d.getTime() + VN_OFFSET_MINUTES * 60_000);
  return {
    dow: v.getUTCDay(),
    hour: v.getUTCHours(),
    minute: v.getUTCMinutes(),
    year: v.getUTCFullYear(),
    month: v.getUTCMonth() + 1,
    day: v.getUTCDate(),
  };
}

/** Giờ VN dạng HH:mm (dùng chung cho lịch/booking thay cho toLocaleTimeString thô). */
export function formatVnTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: VN_TZ }).format(d);
}
