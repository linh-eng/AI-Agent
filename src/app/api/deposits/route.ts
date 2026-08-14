export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { depositCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { createDeposit } from "@/lib/deposit";

// Danh sách phiếu cọc — lọc theo khách / trạng thái (mặc định các cọc còn giữ/đã phân bổ).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PAYMENT_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const deposits = await prisma.deposit.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      customer: { select: { code: true, fullName: true } },
      invoice: { select: { code: true } },
      booking: { select: { code: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 300,
  });
  return ok(deposits);
});

// Thu cọc (mục 17) — bản ghi tiền thật, trạng thái ACTIVE (chưa trừ công nợ hóa đơn nào).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.DEPOSIT_WRITE);
  const parsed = depositCreateSchema.parse(await req.json());
  const deposit = await createDeposit({ ...parsed, receivedBy: parsed.receivedBy ?? session.name });
  await auditLog({
    userId: session.userId,
    action: "DEPOSIT_CREATED",
    entityType: "Deposit",
    entityId: deposit.id,
    changes: { customerId: parsed.customerId, amount: parsed.amount, method: parsed.method, bookingId: parsed.bookingId },
  });
  return created(deposit);
});
