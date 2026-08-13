// =============================================================================
// Cài đặt hệ thống (mục 1) — Thương hiệu lưu DB (AppSetting), KHÔNG hard-code rải
// rác trong mã nguồn. Có giá trị mặc định lấy từ ENV để trang đăng nhập (chưa có
// phiên) vẫn hiển thị đúng tên trước khi cấu hình.
// =============================================================================
import { prisma } from "./prisma";

export interface BrandSetting {
  name: string; // Tên phần mềm/thương hiệu
  tagline?: string; // Khẩu hiệu ngắn
  primaryColor?: string; // Màu nhấn (hex)
  logoDataUrl?: string; // Logo nhúng (data URL) — tùy chọn
}

export const BRAND_KEY = "brand";

export function defaultBrand(): BrandSetting {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || "Sophia Wellness",
    tagline: "Quản lý khách hàng & vận hành dịch vụ",
    primaryColor: "#4f7d6e",
  };
}

/** Đọc cấu hình thương hiệu; trộn với mặc định để luôn đủ trường. */
export async function getBrand(): Promise<BrandSetting> {
  const row = await prisma.appSetting.findUnique({ where: { key: BRAND_KEY } });
  const base = defaultBrand();
  if (!row) return base;
  const value = (row.value ?? {}) as Partial<BrandSetting>;
  return { ...base, ...value };
}

/** Ghi/ghi đè cấu hình thương hiệu. */
export async function setBrand(value: BrandSetting, updatedBy?: string): Promise<BrandSetting> {
  await prisma.appSetting.upsert({
    where: { key: BRAND_KEY },
    create: { key: BRAND_KEY, value: value as any, updatedBy: updatedBy ?? null },
    update: { value: value as any, updatedBy: updatedBy ?? null },
  });
  return getBrand();
}
