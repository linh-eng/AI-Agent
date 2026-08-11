export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { technologyCreateSchema } from "@/lib/library-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const items = await prisma.technology.findMany({
    where: { isActive: true },
    include: { brand: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.TECHNOLOGY_WRITE);
  const parsed = technologyCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("CN", await prisma.technology.count());
  const tech = await prisma.technology.create({ data: { ...parsed, code } });
  return created(tech);
});
