export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assetPaymentSchema } from "@/lib/validation";

// Sửa 1 đợt thanh toán — ADMIN/MANAGER.
export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = assetPaymentSchema.parse(await req.json());
  const row = await prisma.assetPayment.update({
    where: { id: ctx.params.pid },
    data: {
      amount: input.amount,
      paidDate: new Date(input.paidDate),
      method: input.method,
      bankInfo: input.bankInfo,
      payerType: input.payerType,
      note: input.note,
    },
  });
  return ok(row);
});

// Xóa 1 đợt thanh toán (kèm file đính kèm của đợt đó) — ADMIN/MANAGER.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  await prisma.assetPayment.delete({ where: { id: ctx.params.pid } });
  return ok({ deleted: true });
});
