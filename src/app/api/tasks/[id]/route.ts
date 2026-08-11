export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { taskUpdateSchema } from "@/lib/clinic-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.TASK_WRITE);
  const parsed = taskUpdateSchema.parse(await req.json());
  const task = await prisma.task.update({ where: { id: params.id }, data: parsed });
  return ok(task);
});
