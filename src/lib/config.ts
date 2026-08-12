// =============================================================================
// Cấu hình vận hành (đọc từ env, có mặc định an toàn cho production).
// =============================================================================

export const INVENTORY_CONFIG = {
  /**
   * Cho phép tồn kho âm khi xuất/giữ vượt tồn khả dụng.
   * Mặc định FALSE (an toàn) — chặn oversell. Bật qua env ALLOW_NEGATIVE_STOCK=true
   * (ví dụ khi cần xuất gấp và điều chỉnh sau).
   */
  allowNegativeStock: process.env.ALLOW_NEGATIVE_STOCK === "true",
};

export const STORAGE_CONFIG = {
  /** Thư mục lưu blob RIÊNG TƯ (ngoài public/). Đổi sang S3 bằng STORAGE_DRIVER=s3 sau. */
  driver: process.env.STORAGE_DRIVER ?? "local",
  dir: process.env.STORAGE_DIR ?? `${process.cwd()}/var/uploads`,
  /** Kích thước tối đa mỗi tệp (mặc định 25MB). */
  maxBytes: Number(process.env.STORAGE_MAX_BYTES ?? 25 * 1024 * 1024),
  /** Loại nội dung cho phép (ảnh/video/pdf phổ biến). */
  allowedContentTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "video/mp4",
    "video/quicktime",
    "application/pdf",
  ],
};

/** Lỗi tồn không đủ — API map sang HTTP 409. */
export class InsufficientStockError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}
