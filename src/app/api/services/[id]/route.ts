export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const row = await prisma.service.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: { items: { include: { product: true } } },
  });
  return ok(row);
});

export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const { name, note, isActive, items } = serviceUpdateSchema.parse(await req.json());

  const row = await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: ctx.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    // Nếu gửi kèm items -> thay toàn bộ định mức.
    if (items) {
      await tx.serviceItem.deleteMany({ where: { serviceId: ctx.params.id } });
      if (items.length > 0) {
        await tx.serviceItem.createMany({
          data: items.map((i) => ({
            serviceId: ctx.params.id,
            productId: i.productId,
            quantity: i.quantity,
          })),
          skipDuplicates: true,
        });
      }
    }
    return tx.service.findUniqueOrThrow({
      where: { id: ctx.params.id },
      include: { items: { include: { product: true } } },
    });
  });
  return ok(row);
});
