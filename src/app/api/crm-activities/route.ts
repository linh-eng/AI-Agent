export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { crmActivityCreateSchema } from "@/lib/clinic-validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const activities = await prisma.crmActivity.findMany({
    where: customerId ? { customerId } : undefined,
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
  return ok(activities);
});

// Append-only — mỗi tương tác là một record, không ghi đè (mục 5, 30)
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CRM_WRITE);
  const parsed = crmActivityCreateSchema.parse(await req.json());
  const activity = await prisma.crmActivity.create({
    data: {
      ...parsed,
      occurredAt: parsed.occurredAt ?? new Date(),
      performedBy: parsed.performedBy ?? session.name,
    },
  });

  // Nếu có ngày follow-up -> tự tạo task nhắc lịch (mục 5, 22)
  if (parsed.followUpDate) {
    await prisma.task.create({
      data: {
        title: `Follow-up: ${parsed.nextAction ?? activity.type}`,
        customerId: parsed.customerId,
        assignee: parsed.followUpOwner ?? session.name,
        dueDate: parsed.followUpDate,
        priority: "NORMAL",
        status: "OPEN",
        createdBy: session.name,
      },
    });
  }
  return created(activity);
});
