export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandUpdateSchema } from "@/lib/library-validation";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const brand = await prisma.brand.findUnique({
    where: { id: params.id },
    include: {
      technologies: { where: { isActive: true }, orderBy: { name: "asc" } },
      protocols: { orderBy: { name: "asc" } },
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });
  if (!brand) return fail(404, "Không tìm thấy brand");
  return ok(brand);
});

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.BRAND_WRITE);
  const parsed = brandUpdateSchema.parse(await req.json());
  const brand = await prisma.brand.update({ where: { id: params.id }, data: parsed });
  return ok(brand);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.BRAND_WRITE);
  const brand = await prisma.brand.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: brand.id, isActive: brand.isActive });
});
