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

/** Lỗi tồn không đủ — API map sang HTTP 409. */
export class InsufficientStockError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}
