export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Danh sách các LẦN ÁP quy trình CSKH (mục 9). Lọc theo khách / trạng thái.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const instances = await prisma.careProcessInstance.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      customer: { select: { code: true, fullName: true } },
      _count: { select: { tasks: true } },
      tasks: { select: { status: true, dueDate: true } },
    },
    orderBy: { appliedAt: "desc" },
    take: 200,
  });
  // Tóm tắt tiến độ mỗi lần áp (đếm theo trạng thái task).
  const now = Date.now();
  const rows = instances.map((i) => {
    const done = i.tasks.filter((t) => t.status === "DONE").length;
    const cancelled = i.tasks.filter((t) => t.status === "CANCELLED").length;
    const overdue = i.tasks.filter((t) => (t.status === "OPEN" || t.status === "IN_PROGRESS") && t.dueDate && new Date(t.dueDate).getTime() < now).length;
    const { tasks, ...rest } = i;
    return { ...rest, progress: { total: i._count.tasks, done, cancelled, overdue } };
  });
  return ok(rows);
});
