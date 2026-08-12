export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Tạo 1 lọ/lô (container) cho một vật tư dùng chung.
const schema = z.object({
  usageMaterialId: z.string().min(1),
  containerNo: z.string().min(1),
  initialQty: z.coerce.number().positive(),
  costSnapshot: z.coerce.number().nonnegative().optional().nullable(),
  openedAt: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = schema.parse(await req.json());
  const material = await prisma.usageMaterial.findUnique({ where: { id: d.usageMaterialId } });
  if (!material) return fail(404, "Không tìm thấy vật tư");
  const c = await prisma.materialContainer.create({
    data: {
      usageMaterialId: material.id,
      containerNo: d.containerNo,
      initialQty: d.initialQty,
      remainingQty: d.initialQty,
      unit: material.unit,
      costSnapshot: d.costSnapshot ?? null,
      openedAt: d.openedAt ? new Date(d.openedAt) : null,
      expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
      status: "IN_USE",
      createdBy: session.name,
    },
  });
  return created(c);
});
