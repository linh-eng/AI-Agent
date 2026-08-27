export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assetPaymentSchema } from "@/lib/validation";

// Thêm 1 đợt thanh toán cho tài sản — chỉ ADMIN/MANAGER (asset.manage).
export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = assetPaymentSchema.parse(await req.json());
  const row = await prisma.assetPayment.create({
    data: {
      assetId: ctx.params.id,
      amount: input.amount,
      paidDate: new Date(input.paidDate),
      method: input.method,
      bankInfo: input.bankInfo,
      payerType: input.payerType,
      note: input.note,
      createdById: session.userId,
    },
  });
  return created(row);
});
