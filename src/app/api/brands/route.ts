export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandCreateSchema } from "@/lib/library-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true, protocols: true, technologies: true } } },
    orderBy: { name: "asc" },
  });
  return ok(brands);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.BRAND_WRITE);
  const parsed = brandCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("BR", await prisma.brand.count());
  const brand = await prisma.brand.create({ data: { ...parsed, code } });
  return created(brand);
});
