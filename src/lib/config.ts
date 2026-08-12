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
  /** local (FS riêng tư) | s3 (S3-compatible, private bucket + signed URL). */
  driver: process.env.STORAGE_DRIVER ?? "local",
  dir: process.env.STORAGE_DIR ?? `${process.cwd()}/var/uploads`,
  /** Kích thước tối đa mỗi tệp (mặc định 25MB). */
  maxBytes: Number(process.env.STORAGE_MAX_BYTES ?? 25 * 1024 * 1024),
  /** TTL cho signed URL (giây). */
  signedUrlTtl: Number(process.env.STORAGE_SIGNED_URL_TTL ?? 300),
  /** Bí mật ký signed URL cho local driver (tách khỏi phiên; phái sinh nếu chưa đặt). */
  signSecret: process.env.STORAGE_SIGN_SECRET ?? `${process.env.AUTH_SECRET ?? "dev-secret-change-me"}::media`,
  /** Loại nội dung cho phép (ảnh/video/pdf phổ biến). KHÔNG có thực thi. */
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
  /** Đuôi tệp nguy hiểm bị chặn (không cho upload thực thi/script). */
  blockedExtensions: [
    ".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".sh", ".bash", ".ps1",
    ".js", ".mjs", ".cjs", ".jar", ".php", ".phtml", ".py", ".rb", ".pl",
    ".html", ".htm", ".svg", ".vbs", ".scr", ".app",
  ],
  s3: {
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  },
};

/** Lỗi tồn không đủ — API map sang HTTP 409. */
export class InsufficientStockError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}
