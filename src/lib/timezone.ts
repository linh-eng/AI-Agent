// =============================================================================
// MÚI GIỜ — hệ thống vận hành MỘT múi giờ: Asia/Ho_Chi_Minh (UTC+7, KHÔNG DST).
// -----------------------------------------------------------------------------
// Quy ước lưu trữ (đồng nhất toàn app: Lịch hẹn / Buổi / Nghỉ phép / CRM):
//   Thời gian NGƯỜI DÙNG NHẬP (giờ làm việc VN) được lưu dưới dạng "wall-clock VN"
//   — tức đúng các chữ số giờ VN, đóng dấu UTC (Z). Ví dụ: khách nhập 08:00 (giờ VN)
//   → lưu 08:00Z. Nhờ vậy nghiệp vụ (so lịch, phát hiện trùng, nghỉ phép) chỉ cần
//   so sánh cùng một hệ quy chiếu, KHÔNG lệch ±7h giữa các thực thể.
//
//   ĐỂ ỔN ĐỊNH BẤT KỂ MÚI GIỜ TIẾN TRÌNH (container/CI có thể là UTC hay khác):
//   - Hiển thị & định dạng: trích theo `timeZone: "UTC"` (đọc lại đúng wall-clock VN).
//   - Logic lịch (thứ/giờ/phút): dùng `vnClock()` (getUTC*), KHÔNG dùng getHours()
//     (vốn phụ thuộc TZ tiến trình → sai availability nếu container ≠ UTC).
//   - Nhận input datetime-local (không kèm chỉ định múi): coi là giờ VN → đóng Z.
//
//   Vì VN cố định UTC+7 (không có giờ mùa hè), quy ước này chính xác và đơn giản;
//   không cần thư viện tz. (Chuyển sang lưu true-UTC + convert Asia/Ho_Chi_Minh cho
//   TOÀN BỘ module là refactor lớn — ghi ở technical debt, ngoài phạm vi hiện tại.)
// =============================================================================

export const VN_TZ = "Asia/Ho_Chi_Minh";
export const VN_OFFSET_MINUTES = 7 * 60; // UTC+7, không DST

/**
 * Chuẩn hóa input thời gian về Date "wall-clock VN" (đóng Z), ổn định bất kể TZ
 * tiến trình:
 *  - Date  → giữ nguyên.
 *  - Chuỗi chỉ có NGÀY ("yyyy-MM-dd") → JS parse là UTC 00:00 (đã là wall-clock).
 *  - Chuỗi ĐÃ có múi giờ (…Z / ±hh:mm) → tôn trọng nguyên trạng.
 *  - Chuỗi datetime-local ("yyyy-MM-ddTHH:mm[:ss]", giờ VN) → coi là VN, đóng Z.
 */
export function parseVnLocal(input: string | Date): Date {
  if (input instanceof Date) return input;
  const s = String(input).trim();
  if (!s.includes("T") && !s.includes(" ")) return new Date(s); // chỉ ngày
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return new Date(s); // đã có múi giờ
  return new Date(s.replace(" ", "T") + "Z"); // wall-clock VN → đóng Z
}

/** Trích wall-clock VN (thứ 0–6, giờ, phút, ngày/tháng/năm) từ một Date đã lưu. */
export function vnClock(d: Date): {
  dow: number; hour: number; minute: number; year: number; month: number; day: number;
} {
  return {
    dow: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}
