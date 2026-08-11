export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCategoryCreateSchema } from "@/lib/clinic-validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const cats = await prisma.serviceCategory.findMany({ orderBy: { name: "asc" } });
  return ok(cats);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceCategoryCreateSchema.parse(await req.json());
  const cat = await prisma.serviceCategory.create({ data: parsed });
  return created(cat);
});
