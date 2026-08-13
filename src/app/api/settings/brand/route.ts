export const dynamic = "force-dynamic";

import { z } from "zod";
import { ok, handle } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getBrand, setBrand } from "@/lib/settings";
import { auditLog } from "@/lib/clinic";

const brandSchema = z.object({
  name: z.string().min(1, "Nhập tên thương hiệu").max(120),
  tagline: z.string().max(200).optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Màu dạng #RRGGBB")
    .optional()
    .nullable(),
  logoDataUrl: z
    .string()
    .max(600_000) // ~600KB base64 tối đa cho logo nhúng
    .refine((v) => !v || v.startsWith("data:image/"), "Logo phải là ảnh (data URL)")
    .optional()
    .nullable(),
});

// Mọi người dùng đã đăng nhập đều đọc được thương hiệu (để hiển thị UI).
export const GET = handle(async () => {
  await requireAuth();
  return ok(await getBrand());
});

// Chỉ vai trò có quyền cấu hình mới được sửa.
export const PUT = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.SETTING_WRITE);
  const parsed = brandSchema.parse(await req.json());
  const brand = await setBrand(
    {
      name: parsed.name,
      tagline: parsed.tagline ?? undefined,
      primaryColor: parsed.primaryColor ?? undefined,
      logoDataUrl: parsed.logoDataUrl ?? undefined,
    },
    session.name
  );
  await auditLog({
    userId: session.userId,
    action: "SETTING_UPDATED",
    entityType: "AppSetting",
    entityId: "brand",
    changes: { name: brand.name },
  });
  return ok(brand);
});
