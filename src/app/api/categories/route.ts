export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { categoryCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.CATEGORY_READ);
  const rows = await prisma.category.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.CATEGORY_WRITE);
  const data = categoryCreateSchema.parse(await req.json());
  const row = await prisma.category.create({ data });
  return created(row);
});
