export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, canSeeFinance, maskFinance } from "@/lib/clinic";
import { splitServiceInput, materialCreateRows } from "@/lib/service";
import { buildStepsCreate } from "@/lib/service-sop";
import { computeFloor } from "@/lib/price-floor";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim();
  const categoryId = p.get("categoryId") ?? undefined;
  const status = p.get("status") ?? undefined;
  const technology = p.get("technology")?.trim();

  const services = await prisma.service.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(technology ? { technologyIds: { has: technology } } : {}),
    },
    include: {
      category: { select: { name: true } },
      priceFloor: true,
      _count: { select: { materialStandards: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = services.map((s) => {
    const floorPrice = s.priceFloor
      ? computeFloor({
          laborCost: Number(s.priceFloor.laborCost), operationCost: Number(s.priceFloor.operationCost),
          depreciationCost: Number(s.priceFloor.depreciationCost), materialCost: Number(s.priceFloor.materialCost),
          roomCost: Number(s.priceFloor.roomCost), otherCost: Number(s.priceFloor.otherCost),
          minMarginPercent: Number(s.priceFloor.minMarginPercent),
        }).floorPrice
      : null;
    const { priceFloor, ...rest } = s;
    // Giá sàn là dữ liệu chi phí → chỉ finance.read thấy.
    return maskFinance({ ...rest, floorPrice, technologyCount: s.technologyIds.length, materialCount: s._count.materialStandards }, canSee, ["expectedCost", "floorPrice"]);
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceCreateSchema.parse(await req.json());
  const { data, materials } = splitServiceInput(parsed);
  const { steps } = parsed as any;
  const code = data.code ?? sequentialCode("DV", await prisma.service.count());
  const service = await prisma.service.create({
    data: {
      ...data,
      code,
      materialStandards: materials ? { create: materialCreateRows(materials) } : undefined,
      steps: steps ? { create: buildStepsCreate(steps) } : undefined, // SOP chuẩn hóa (Redesign P1)
    } as any,
  });
  return created(service);
});
