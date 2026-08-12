export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { issueUpdateSchema, cancelReasonSchema } from "@/lib/validation";
import { updateIssue, cancelIssue } from "@/lib/outbound-service";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const row = await prisma.goodsIssue.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      warehouse: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true, batch: true } },
    },
  });
  return ok(row);
});

// Sửa phiếu xuất đã ghi sổ — chỉ ADMIN/MANAGER (outbound.manage). Hủy phiếu cũ +
// tạo phiếu mới (phân bổ FEFO lại); trả về id/code phiếu mới. Bắt buộc lý do.
export const PUT = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_MANAGE);
  const { reason, ...input } = issueUpdateSchema.parse(await req.json());
  const result = await updateIssue(ctx.params.id, input, reason, session.userId);
  return ok(result);
});

// Hủy phiếu xuất đã ghi sổ — chỉ ADMIN/MANAGER. Hoàn tồn về lô đã xuất + CANCELLED.
export const DELETE = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_MANAGE);
  const { reason } = cancelReasonSchema.parse(await req.json());
  const result = await cancelIssue(ctx.params.id, reason, session.userId);
  return ok(result);
});
