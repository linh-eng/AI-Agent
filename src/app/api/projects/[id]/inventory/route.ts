export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Báo cáo theo dự án (M5): serial đã nhập / đã giao / đang bảo hành / đổi trả.
export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PROJECT_READ);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.id },
    include: { customer: { select: { code: true, name: true } } },
  });

  const serials = await prisma.serial.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true, name: true, countsAsAvailable: true } },
    },
  });

  const WARRANTY_STATUSES = ["IN_WARRANTY_INTAKE", "AT_VENDOR", "IN_REPAIR"];
  const summary = {
    total: serials.length,
    delivered: serials.filter((s) => s.status === "SOLD").length,
    inWarranty: serials.filter((s) => WARRANTY_STATUSES.includes(s.status)).length,
    replaced: serials.filter((s) => s.status === "REPLACED").length,
    inProjectStock: serials.filter((s) => s.status === "IN_STOCK" && s.warehouse.code === "K-DA").length,
    inStock: serials.filter((s) => s.status === "IN_STOCK").length,
  };

  return ok({ project, summary, serials });
});
