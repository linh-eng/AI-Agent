// =============================================================================
// Kiểm tra trùng giá trị (mã/SKU/barcode…) TRƯỚC khi ghi để:
//  - Trả lỗi tiếng Việt rõ ràng, nêu đúng ô bị trùng + giá trị.
//  - Tránh để Prisma ném P2002 và in "prisma:error" đỏ ra console cho lỗi
//    nghiệp vụ thông thường (nhập trùng) — vốn là tình huống chờ đợi được.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";

type UniqModel = "product" | "category" | "supplier" | "warehouse" | "brand" | "user";

/**
 * Ném HttpError 409 nếu đã tồn tại bản ghi khác có `field = value`.
 * Bỏ qua khi value rỗng/null (cột không bắt buộc, cho phép nhiều null).
 * `excludeId` để bỏ qua chính bản ghi đang sửa.
 */
export async function ensureUnique(
  model: UniqModel,
  field: string,
  value: string | null | undefined,
  label: string,
  excludeId?: string
): Promise<void> {
  if (value == null || value === "") return;
  const where: Record<string, unknown> = { [field]: value };
  if (excludeId) where.id = { not: excludeId };
  // Truy cập model động theo tên — mọi model dùng đây đều có cột `id`.
  const delegate = (prisma as unknown as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>)[model];
  const existing = await delegate.findFirst({ where, select: { id: true } });
  if (existing)
    throw new HttpError(409, `${label} "${value}" đã tồn tại — vui lòng dùng giá trị khác.`);
}
