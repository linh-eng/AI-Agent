export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { projectCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PROJECT_READ);
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, code: true, name: true } } },
  });
  return ok(projects);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.PROJECT_WRITE);
  const data = projectCreateSchema.parse(await req.json());
  const project = await prisma.project.create({ data });
  return created(project);
});