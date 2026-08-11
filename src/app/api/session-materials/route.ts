export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionMaterialCreateSchema } from "@/lib/ext-validation";
import { canSeeFinance, maskFinance } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const session = await getSession();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const mats = await prisma.sessionMaterial.findMany({
    where: sessionId ? { sessionId } : undefined,
    include: { movements: { orderBy: { createdAt: "desc" } }, product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: "asc" },
  });
  const canSee = canSeeFinance(session);
  return ok(mats.map((m) => maskFinance(m, canSee, ["unitCost"])));
});

// Thêm dòng vật tư kế hoạch cho buổi. Nếu là SP chuyên nghiệp & chưa nhập giá vốn,
// lấy giá vốn từ SpaProduct (snapshot).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const parsed = sessionMaterialCreateSchema.parse(await req.json());

  let unitCost = parsed.unitCost ?? undefined;
  if (unitCost === undefined && parsed.spaProductId) {
    const sp = await prisma.spaProduct.findUnique({ where: { id: parsed.spaProductId }, select: { cost: true } });
    if (sp?.cost != null) unitCost = Number(sp.cost);
  }

  const mat = await prisma.sessionMaterial.create({
    data: {
      sessionId: parsed.sessionId,
      name: parsed.name,
      spaProductId: parsed.spaProductId ?? null,
      inventoryProductId: parsed.inventoryProductId ?? null,
      warehouseId: parsed.warehouseId ?? null,
      uom: parsed.uom ?? null,
      isProfessional: parsed.isProfessional,
      plannedQty: parsed.plannedQty,
      unitCost: unitCost ?? null,
      createdBy: session.name,
    },
  });
  return created(mat);
});
