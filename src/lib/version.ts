// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.10.0";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Hồ sơ khách hàng 360°: header + chỉ số tổng quan, quick actions, 11 tab (Tổng quan/Timeline/Booking & Lần thực hiện/Phác đồ/Đánh giá & Before-After/Sản phẩm/Vật tư/Chăm sóc/Báo giá/Hóa đơn-Thanh toán/Biểu mẫu), tìm kiếm & bộ lọc nâng cao";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
