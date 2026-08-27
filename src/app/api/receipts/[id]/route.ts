export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { receiptUpdateSchema, cancelReasonSchema } from "@/lib/validation";
import { updateReceipt, cancelReceipt } from "@/lib/inbound-service";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const row = await prisma.goodsReceipt.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      supplier: true,
      warehouse: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  return ok(row);
});

// Sửa phiếu nhập đã ghi sổ — chỉ ADMIN/MANAGER (inbound.manage). Hủy phiếu cũ +
// tạo phiếu mới; trả về id/code phiếu mới. Bắt buộc lý do.
export const PUT = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.INBOUND_MANAGE);
  const { reason, ...input } = receiptUpdateSchema.parse(await req.json());
  const result = await updateReceipt(ctx.params.id, input, reason, session.userId);
  return ok(result);
});

// Hủy phiếu nhập đã ghi sổ — chỉ ADMIN/MANAGER. Hoàn tồn + đánh dấu CANCELLED.
export const DELETE = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.INBOUND_MANAGE);
  const { reason } = cancelReasonSchema.parse(await req.json());
  const result = await cancelReceipt(ctx.params.id, reason, session.userId);
  return ok(result);
});
