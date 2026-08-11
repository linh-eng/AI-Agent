export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { technologyUpdateSchema } from "@/lib/library-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.TECHNOLOGY_WRITE);
  const parsed = technologyUpdateSchema.parse(await req.json());
  const tech = await prisma.technology.update({ where: { id: params.id }, data: parsed });
  return ok(tech);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.TECHNOLOGY_WRITE);
  const tech = await prisma.technology.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: tech.id, isActive: tech.isActive });
});
