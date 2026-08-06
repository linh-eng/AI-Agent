export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

const childInclude = {
  product: { select: { sku: true, name: true, trackingMode: true } },
  supplier: { select: { code: true, name: true } },
  origins: true,
  warranties: true,
} as const;

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);

  const serial = await prisma.serial.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      product: true,
      warehouse: { select: { code: true, name: true, countsAsAvailable: true } },
      supplier: { select: { code: true, name: true } },
      project: { include: { customer: { select: { code: true, name: true } } } },
      bin: { include: { zone: { select: { code: true, name: true } } } },
      origins: { include: { supplier: { select: { code: true, name: true } } } },
      warranties: true,
      events: { orderBy: { createdAt: "asc" } },
      replacedBy: { select: { id: true, serialNumber: true } },
      replaces: { select: { id: true, serialNumber: true } },
      // Truy vết xuôi: cây linh kiện (2 tầng)
      childSerials: {
        include: { ...childInclude, childSerials: { include: childInclude } },
      },
    },
  });

  // Truy vết ngược: leo lên máy cha gốc để lấy dự án + khách hàng
  let parentChain: Array<{ id: string; serialNumber: string; productName: string }> = [];
  let rootProject: { code: string; name: string; customer: { code: string; name: string } | null } | null = null;
  let currentParentId = serial.parentSerialId;
  let guard = 0;
  while (currentParentId && guard < 10) {
    const p = await prisma.serial.findUnique({
      where: { id: currentParentId },
      include: {
        product: { select: { name: true } },
        project: { include: { customer: { select: { code: true, name: true } } } },
      },
    });
    if (!p) break;
    parentChain.push({ id: p.id, serialNumber: p.serialNumber, productName: p.product.name });
    if (p.project) {
      rootProject = {
        code: p.project.code,
        name: p.project.name,
        customer: p.project.customer,
      };
    }
    currentParentId = p.parentSerialId;
    guard++;
  }

  return ok({ ...serial, parentChain, rootProject });
});
