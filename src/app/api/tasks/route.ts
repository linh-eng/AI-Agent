export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { taskCreateSchema } from "@/lib/clinic-validation";
import { vnClock } from "@/lib/timezone";
import type { Prisma } from "@prisma/client";

// Mốc ngày theo lịch VN → instant UTC. Dùng để lọc Hôm nay / Sắp tới theo giờ VN.
function vnDayStartUtc(ref: Date): Date {
  const c = vnClock(ref);
  return new Date(Date.UTC(c.year, c.month - 1, c.day) - 7 * 60 * 60_000);
}

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const assignee = url.searchParams.get("assignee") ?? undefined;
  const careInstanceId = url.searchParams.get("careInstanceId") ?? undefined;
  // filter: today | upcoming | overdue | done | open | all (mục 9 group 6)
  const filter = url.searchParams.get("filter") ?? undefined;

  const now = new Date();
  const startToday = vnDayStartUtc(now);
  const startTomorrow = new Date(startToday.getTime() + 86_400_000);
  const OPENISH = ["OPEN", "IN_PROGRESS"] as const;

  const where: Prisma.TaskWhereInput = {
    ...(customerId ? { customerId } : {}),
    ...(assignee ? { assignee } : {}),
    ...(careInstanceId ? { careProcessInstanceId: careInstanceId } : {}),
    ...(status ? { status: status as Prisma.EnumTaskStatusFilter } : {}),
  };

  switch (filter) {
    case "overdue": // chưa xong + đã quá hạn (dueDate < bây giờ)
      where.status = { in: OPENISH as unknown as Prisma.EnumTaskStatusFilter["in"] };
      where.dueDate = { lt: now };
      break;
    case "today": // chưa xong + đến hạn trong hôm nay (theo lịch VN)
      where.status = { in: OPENISH as unknown as Prisma.EnumTaskStatusFilter["in"] };
      where.dueDate = { gte: startToday, lt: startTomorrow };
      break;
    case "upcoming": // chưa xong + đến hạn từ ngày mai trở đi
      where.status = { in: OPENISH as unknown as Prisma.EnumTaskStatusFilter["in"] };
      where.dueDate = { gte: startTomorrow };
      break;
    case "open": // tất cả việc chưa kết thúc
      where.status = { in: OPENISH as unknown as Prisma.EnumTaskStatusFilter["in"] };
      break;
    case "done":
      where.status = "DONE";
      break;
    default:
      break; // all / không lọc
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      customer: { select: { code: true, fullName: true } },
      careInstance: { select: { code: true, templateName: true, templateVersion: true, status: true } },
    },
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
