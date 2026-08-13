export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionCreateSchema } from "@/lib/clinic-validation";
import { resolveItemPricing } from "@/lib/pricing";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const url = new URL(req.url);
  const planId = url.searchParams.get("planId") ?? undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const sessions = await prisma.treatmentSession.findMany({
    where: { ...(planId ? { planId } : {}), ...(customerId ? { customerId } : {}) },
    include: { service: { select: { name: true } } },
    orderBy: [{ planId: "asc" }, { sessionNumber: "asc" }],
  });
  return ok(sessions);
});

// Mỗi buổi là một record độc lập (mục 16) — không ghi đè buổi trước
export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = sessionCreateSchema.parse(await req.json());

  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: parsed.planId },
    select: { customerId: true, customer: { select: { group: true } } },
  });
  if (!plan) return fail(404, "Không tìm thấy phác đồ");

  // orderIndex mặc định = sessionNumber nếu không truyền
  const orderIndex = parsed.orderIndex ?? parsed.sessionNumber;

  // Giá buổi: nếu chưa nhập & có dịch vụ, lấy từ Price Management (theo nhóm khách),
  // fallback giá niêm yết -> LƯU SNAPSHOT (đổi bảng giá sau không ảnh hưởng buổi đã lập).
  let price = parsed.price ?? undefined;
  if (price === undefined && parsed.serviceId) {
    const { unitPrice } = await resolveItemPricing(
      "SERVICE",
      parsed.serviceId,
      plan.customer?.group,
      parsed.scheduledAt ?? undefined
    );
    if (unitPrice !== null) price = unitPrice;
  }

  const session = await prisma.treatmentSession.create({
    data: {
      planId: parsed.planId,
      customerId: plan.customerId,
      stageId: parsed.stageId ?? null,
      bookingId: parsed.bookingId ?? null,
      serviceId: parsed.serviceId ?? null,
      technologyId: parsed.technologyId ?? null,
      brandProtocolId: parsed.brandProtocolId ?? null,
      orderIndex,
      sessionNumber: parsed.sessionNumber,
      name: parsed.name ?? null,
      status: parsed.status,
      scheduledAt: parsed.scheduledAt,
      objective: parsed.objective ?? null,
      steps: (parsed.steps as any) ?? undefined,
      professionalProducts: (parsed.professionalProducts as any) ?? undefined,
      plannedParams: (parsed.plannedParams as any) ?? undefined,
      plannedMaterials: (parsed.plannedMaterials as any) ?? undefined,
      plannedCost: parsed.plannedCost ?? null,
      price: price ?? null,
      preCare: parsed.preCare ?? null,
      postCare: parsed.postCare ?? null,
      note: parsed.note ?? null,
      // --- KẾ HOẠCH buổi: chốt snapshot dự kiến (mặc định lấy từ dịch vụ/CN/protocol đang chọn) ---
      plannedServiceId: parsed.plannedServiceId ?? parsed.serviceId ?? null,
      plannedTechnologyId: parsed.plannedTechnologyId ?? parsed.technologyId ?? null,
      plannedProtocolId: parsed.plannedProtocolId ?? parsed.brandProtocolId ?? null,
      plannedStaff: (parsed.plannedStaff as any) ?? undefined,
      plannedDate: parsed.plannedDate ?? parsed.scheduledAt ?? null,
      intervalDays: parsed.intervalDays ?? null,
    },
  });
  return created(session);
});
