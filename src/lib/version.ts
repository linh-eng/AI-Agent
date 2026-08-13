// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.5.0";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Giá sàn: bảng chi phí cấu thành → giá sàn + cảnh báo/duyệt khi bán dưới sàn";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
