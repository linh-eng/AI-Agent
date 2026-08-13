export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { customerUpdateSchema } from "@/lib/clinic-validation";
import {
  buildCustomerTimeline,
  customerFinancials,
  customerSummary,
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
        take: 100,
      },
      assessments: { orderBy: { assessedAt: "desc" } },
      plans: {
        include: {
          _count: { select: { sessions: true } },
          sessions: { select: { status: true }, },
        },
        orderBy: { createdAt: "desc" },
      },
      sessions: {
        include: {
          service: { select: { name: true } },
          plan: { select: { name: true, code: true } },
          staff: { orderBy: { createdAt: "asc" } },
          review: { select: { satisfactionScore: true, technicianScore: true, comment: true, wouldReturn: true } },
        },
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      },
      proposals: {
        include: { _count: { select: { options: true } } },
        orderBy: { createdAt: "desc" },
      },
      payments: { include: { invoice: { select: { code: true } } }, orderBy: { paidAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 100 },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
    },
  });
  if (!customer) return fail(404, "Không tìm thấy khách hàng");

  const [financials, timeline, summary] = await Promise.all([
    customerFinancials(customer.id),
    buildCustomerTimeline(customer.id),
    customerSummary(customer.id),
  ]);

  return ok({
    ...customer,
    financials,
    timeline,
    summary,
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
