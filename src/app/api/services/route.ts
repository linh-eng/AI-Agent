export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const rows = await prisma.service.findMany({
    include: { items: { include: { product: true } } },
    orderBy: { code: "asc" },
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const { code, name, price, note, items } = serviceCreateSchema.parse(await req.json());
  const row = await prisma.service.create({
    data: {
      code,
      name,
      price: price ?? null,
      note,
      items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
    },
    include: { items: true },
  });
  return created(row);
});
