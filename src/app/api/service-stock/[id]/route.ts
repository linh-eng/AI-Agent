export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

const patchSchema = z.object({
  remainingQty: z.number().nonnegative().optional(),
  status: z.enum(["IN_USE", "EMPTY"]).optional(),
});

// Điều chỉnh thủ công 1 hộp trong Kho Dịch Vụ (còn lại / trạng thái) — SERVICE_WRITE.
export const PATCH = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const input = patchSchema.parse(await req.json());
  const data: Record<string, unknown> = { updatedById: session.userId };
  if (input.remainingQty !== undefined) {
    data.remainingQty = input.remainingQty;
    data.status = input.remainingQty <= 1e-9 ? "EMPTY" : "IN_USE";
  }
  if (input.status !== undefined) data.status = input.status;
  const row = await prisma.serviceStockItem.update({ where: { id: ctx.params.id }, data });
  return ok(row);
});

// Xóa 1 hộp khỏi Kho Dịch Vụ (thường dùng khi đã hết) — SERVICE_WRITE.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  await prisma.serviceStockItem.delete({ where: { id: ctx.params.id } });
  return ok({ deleted: true });
});
