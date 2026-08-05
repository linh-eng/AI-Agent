export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { projectUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PROJECT_READ);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.id },
    include: { customer: true },
  });
  return ok(project);
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PROJECT_WRITE);
  const data = projectUpdateSchema.parse(await req.json());
  const project = await prisma.project.update({ where: { id: params.id }, data });
  return ok(project);
});