export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const wo = await prisma.workOrder.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      bomPlanned: { include: { product: { select: { sku: true, name: true, trackingMode: true } } } },
      bomAsBuilt: {
        include: {
          childSerial: { select: { id: true, serialNumber: true, product: { select: { name: true } } } },
        },
      },
      qcReports: { orderBy: { createdAt: "desc" } },
    },
  });

  // Linh kiện đã cấp phát vào WIP cho lệnh này (theo movement)
  const allocated = await prisma.serial.findMany({
    where: {
      movements: { some: { documentNumber: wo.number, type: "ASSEMBLY_CONSUME" } },
    },
    select: {
      id: true,
      serialNumber: true,
      status: true,
      parentSerialId: true,
      product: { select: { sku: true, name: true } },
    },
  });

  // Serial thành phẩm (nếu đã hoàn thành)
  const finished = await prisma.serial.findFirst({
    where: { bomAsBuiltAsParent: { some: { workOrderId: wo.id } } },
    select: { id: true, serialNumber: true },
  });

  return ok({ ...wo, allocated, finished });
});
