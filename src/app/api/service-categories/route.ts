export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCategoryCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  const cats = await prisma.serviceCategory.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
  });
  return ok(cats);
});

// Tạo nhóm dịch vụ (hỗ trợ "tạo nhanh" ngay trong form dịch vụ — mã tự sinh nếu bỏ trống).
export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceCategoryCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("NDV", await prisma.serviceCategory.count());
  const cat = await prisma.serviceCategory.create({ data: { ...parsed, code } });
  return created(cat);
});
