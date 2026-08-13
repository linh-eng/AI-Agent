// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.11.1";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Lịch hẹn: tài nguyên chọn từ DANH MỤC (KTV/Master searchable, hỗ trợ multi-select, Phòng/Giường/Máy dropdown; giường lọc theo phòng) + quản lý danh mục tài nguyên; đổi lịch bắt buộc lý do; demo đủ trạng thái cho View Ngày";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
