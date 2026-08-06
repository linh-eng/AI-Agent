export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const order = await prisma.disassemblyOrder.findUniqueOrThrow({ where: { id: params.id } });
  const parent = await prisma.serial.findUnique({
    where: { id: order.parentSerialId },
    select: { id: true, serialNumber: true, status: true, product: { select: { name: true } } },
  });

  // As-built version mới nhất -> danh sách serial con
  const bom = await prisma.bomAsBuilt.findMany({
    where: { parentSerialId: order.parentSerialId },
    include: { childSerial: { select: { id: true, serialNumber: true, product: { select: { name: true } } } } },
  });
  const maxVersion = bom.length ? Math.max(...bom.map((b) => b.version)) : 0;
  const children = bom
    .filter((b) => b.version === maxVersion && b.childSerial)
    .map((b) => ({ serialNumber: b.childSerial!.serialNumber, product: b.childSerial!.product.name }));

  return ok({ ...order, parent, children, bomVersion: maxVersion });
});
