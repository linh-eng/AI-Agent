// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.9.1";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Quản trị người dùng: thêm XÓA tài khoản; sửa lỗi quyền không cập nhật sau khi update (quyền lấy từ mã nguồn — đăng nhập lại là có)";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
