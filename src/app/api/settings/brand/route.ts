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

// So sánh trước/sau để ghi audit (rút gọn logo — chỉ đánh dấu có/không, không log base64).
function brandDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const fields = ["name", "tagline", "primaryColor"] as const;
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const f of fields) {
    if ((before[f] ?? null) !== (after[f] ?? null)) diff[f] = { before: before[f] ?? null, after: after[f] ?? null };
  }
  const hadLogo = !!before.logoDataUrl, hasLogo = !!after.logoDataUrl;
  if (hadLogo !== hasLogo) diff.logo = { before: hadLogo ? "(có)" : null, after: hasLogo ? "(có)" : null };
  return diff;
}

// Chỉ vai trò có quyền cấu hình mới được sửa.
export const PUT = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.SETTING_WRITE);
  const parsed = brandSchema.parse(await req.json());
  const before = await getBrand(); // trạng thái trước để ghi diff (mục 13 J)
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
    changes: { diff: brandDiff(before as any, brand as any) },
  });
  return ok(brand);
});
