// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.11.0";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Lịch hẹn nâng cao: khung giờ bắt đầu–kết thúc, tự lấy thời lượng dịch vụ, cảnh báo trùng tài nguyên cụ thể + gợi ý giờ khác, quyền đặt đè có lý do + audit, đổi/hủy/không đến có lịch sử, liên kết phác đồ, chi tiết lịch + công suất ngày";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
