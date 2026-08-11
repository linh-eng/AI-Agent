export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { paymentCreateSchema } from "@/lib/clinic-validation";
import { customerFinancials, auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PAYMENT_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const payments = await prisma.payment.findMany({
    where: customerId ? { customerId } : undefined,
    include: { customer: { select: { code: true, fullName: true } } },
    orderBy: { paidAt: "desc" },
    take: 300,
  });
  return ok(payments);
});

// Một phác đồ/booking có thể thanh toán nhiều lần — append-only (mục 21)
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PAYMENT_WRITE);
  const parsed = paymentCreateSchema.parse(await req.json());
  const payment = await prisma.payment.create({
    data: {
      ...parsed,
      paidAt: parsed.paidAt ?? new Date(),
      receivedBy: parsed.receivedBy ?? session.name,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "PAYMENT",
    entityType: "Payment",
    entityId: payment.id,
    changes: { customerId: parsed.customerId, amount: parsed.amount, method: parsed.method },
  });
  const financials = await customerFinancials(parsed.customerId);
  return created({ ...payment, financials });
});
