// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp (trang Cài đặt + chân menu trái).
// NGUỒN DUY NHẤT: `version` trong package.json → KHÔNG hard-code hai giá trị độc
// lập (trang Cài đặt và sidebar cùng đọc APP_VERSION này). Khi phát hành bản mới
// chỉ cần `npm version` / sửa package.json — version hiển thị tự khớp.
// =============================================================================
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
export const APP_RELEASE_DATE = "2026-08-15";
export const APP_RELEASE_NAME =
  "Cài đặt & Thương hiệu: tên/khẩu hiệu/màu nhấn/logo lưu DB (AppSetting) áp toàn hệ thống; phiên bản đồng bộ package.json (Cài đặt + chân menu); nhập khách hàng, thư viện Spa, Before/After & Đánh giá, CSKH/Follow-up đã nghiệm thu.";

/** Chuỗi hiển thị gọn: v0.20.0 · 15/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
