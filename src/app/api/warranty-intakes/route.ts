export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { warrantyIntakeCreateSchema } from "@/lib/validation";
import { createWarrantyIntake } from "@/lib/warranty-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const intakes = await prisma.warrantyIntake.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const serialIds = intakes.map((i) => i.serialId).filter(Boolean) as string[];
  const serials = await prisma.serial.findMany({
    where: { id: { in: serialIds } },
    select: { id: true, serialNumber: true, product: { select: { name: true } } },
  });
  const map = new Map(serials.map((s) => [s.id, s]));
  return ok(intakes.map((i) => ({ ...i, serial: i.serialId ? map.get(i.serialId) : null })));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = warrantyIntakeCreateSchema.parse(await req.json());
  const intake = await createWarrantyIntake(input, session.userId);
  return created(intake);
});
