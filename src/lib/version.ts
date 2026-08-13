// =============================================================================
// Phiên bản ứng dụng — hiển thị trong Webapp để tiện theo dõi khi cập nhật.
// Khi phát hành bản mới: tăng APP_VERSION + đổi ngày + mô tả ngắn, rồi build lại.
// (Giữ đồng bộ với "version" trong package.json.)
// =============================================================================
export const APP_VERSION = "0.12.0";
export const APP_RELEASE_DATE = "2026-08-13";
export const APP_RELEASE_NAME = "Dịch vụ là dữ liệu nền: nhóm dịch vụ (tạo nhanh), thời lượng + thời gian máy, công nghệ/protocol (nhiều + mặc định), vai trò nhân sự yêu cầu, tài nguyên yêu cầu, vật tư định mức, giá chuẩn + giá vốn + tóm tắt giá sàn; form chia 5 khối; danh sách lọc/tìm + chi tiết";

/** Chuỗi hiển thị gọn: v0.2.0 · 13/08/2026 */
export function versionLabel(): string {
  const [y, m, d] = APP_RELEASE_DATE.split("-");
  return `v${APP_VERSION} · ${d}/${m}/${y}`;
}
