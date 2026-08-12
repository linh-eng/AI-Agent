export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
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

// Thêm dòng vật tư kế hoạch cho buổi. Nếu gắn Lô kho -> suy ra kho & sản phẩm để
// trừ tồn thật khi xuất. Giá vốn ưu tiên: nhập tay > SpaProduct.cost.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const parsed = sessionMaterialCreateSchema.parse(await req.json());

  let unitCost = parsed.unitCost ?? undefined;
  let warehouseId = parsed.warehouseId ?? undefined;
  let inventoryProductId = parsed.inventoryProductId ?? undefined;

  if (parsed.lotId) {
    const lot = await prisma.lot.findUnique({
      where: { id: parsed.lotId },
      select: { warehouseId: true, productId: true },
    });
    if (!lot) return fail(400, "Không tìm thấy lô kho");
    warehouseId = lot.warehouseId;
    inventoryProductId = lot.productId;
  }
  if (unitCost === undefined && parsed.spaProductId) {
    const sp = await prisma.spaProduct.findUnique({ where: { id: parsed.spaProductId }, select: { cost: true } });
    if (sp?.cost != null) unitCost = Number(sp.cost);
  }

  const mat = await prisma.sessionMaterial.create({
    data: {
      sessionId: parsed.sessionId,
      name: parsed.name,
      spaProductId: parsed.spaProductId ?? null,
      inventoryProductId: inventoryProductId ?? null,
      lotId: parsed.lotId ?? null,
      warehouseId: warehouseId ?? null,
      uom: parsed.uom ?? null,
      isProfessional: parsed.isProfessional,
      plannedQty: parsed.plannedQty,
      unitCost: unitCost ?? null,
      createdBy: session.name,
    },
  });
  return created(mat);
});
