export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { customerUpdateSchema } from "@/lib/clinic-validation";
import {
  buildCustomerTimeline,
  customerFinancials,
  canSeeFinance,
  auditLog,
} from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      bookings: {
        include: { service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
        take: 50,
      },
      assessments: { orderBy: { assessedAt: "desc" } },
      plans: {
        include: { _count: { select: { sessions: true } } },
        orderBy: { createdAt: "desc" },
      },
      payments: { orderBy: { paidAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 50 },
      tasks: { orderBy: { createdAt: "desc" }, where: { status: { not: "DONE" } } },
    },
  });
  if (!customer) return fail(404, "Không tìm thấy khách hàng");

  const [financials, timeline] = await Promise.all([
    customerFinancials(customer.id),
    buildCustomerTimeline(customer.id),
  ]);

  return ok({
    ...customer,
    financials,
    timeline,
    canSeeFinance: canSeeFinance(session),
  });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const parsed = customerUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = { ...parsed };
  if ("email" in data) data.email = parsed.email ? parsed.email : null;
  const customer = await prisma.customer.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: "UPDATE",
    entityType: "Customer",
    entityId: customer.id,
    changes: parsed,
  });
  return ok(customer);
});

// Soft delete (mục 30 — không hard-delete dữ liệu nghiệp vụ)
export const DELETE = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: { isActive: false },
  });
  await auditLog({
    userId: session.userId,
    action: "ARCHIVE",
    entityType: "Customer",
    entityId: customer.id,
  });
  return ok({ id: customer.id, isActive: customer.isActive });
});
