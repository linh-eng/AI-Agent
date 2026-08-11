export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { taskCreateSchema } from "@/lib/clinic-validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const tasks = await prisma.task.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { customer: { select: { code: true, fullName: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 300,
  });
  return ok(tasks);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TASK_WRITE);
  const parsed = taskCreateSchema.parse(await req.json());
  const task = await prisma.task.create({
    data: { ...parsed, createdBy: parsed.createdBy ?? session.name },
  });
  return created(task);
});
