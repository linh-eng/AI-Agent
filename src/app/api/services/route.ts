export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, canSeeFinance, maskFinance } from "@/lib/clinic";

export const GET = handle(async (_req) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const session = await getSession();
  const services = await prisma.service.findMany({
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const canSee = canSeeFinance(session);
  return ok(services.map((s) => maskFinance(s, canSee, ["expectedCost"])));
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("DV", await prisma.service.count());
  const service = await prisma.service.create({ data: { ...parsed, code } });
  return created(service);
});
