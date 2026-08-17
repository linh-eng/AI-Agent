export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionCreateSchema } from "@/lib/clinic-validation";
import { resolveItemPricing } from "@/lib/pricing";
import { sequentialCode } from "@/lib/clinic";

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

  // Redesign P4 (Decision 1) — hai đường: (a) plan-based như cũ; (b) WALK-IN (planId null).
  let customerId: string | null = null;
  let customerGroup: string | null | undefined = undefined;
  if (parsed.planId) {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id: parsed.planId },
      select: { customerId: true, customer: { select: { group: true } } },
    });
    if (!plan) return fail(404, "Không tìm thấy phác đồ");
    customerId = plan.customerId;
    customerGroup = plan.customer?.group;
  } else {
    // Walk-in: khách lấy từ customerId truyền vào, hoặc suy từ booking. KHÔNG auto-tạo plan.
    customerId = parsed.customerId ?? null;
    if (!customerId && parsed.bookingId) {
      const bk = await prisma.booking.findUnique({ where: { id: parsed.bookingId }, select: { customerId: true } });
      customerId = bk?.customerId ?? null;
    }
    if (!customerId) return fail(422, "Buổi walk-in cần customerId hoặc bookingId để xác định khách.");
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { group: true } });
    customerGroup = c?.group;
  }

  // orderIndex mặc định = sessionNumber nếu không truyền
  const orderIndex = parsed.orderIndex ?? parsed.sessionNumber;

  // Giá buổi: nếu chưa nhập & có dịch vụ, lấy từ Price Management (theo nhóm khách),
  // fallback giá niêm yết -> LƯU SNAPSHOT (đổi bảng giá sau không ảnh hưởng buổi đã lập).
  let price = parsed.price ?? undefined;
  if (price === undefined && parsed.serviceId) {
    const { unitPrice } = await resolveItemPricing(
      "SERVICE",
      parsed.serviceId,
      customerGroup,
      parsed.scheduledAt ?? undefined
    );
    if (unitPrice !== null) price = unitPrice;
  }

  const code = sequentialCode("SS", await prisma.treatmentSession.count());
  const session = await prisma.treatmentSession.create({
    data: {
      code,
      planId: parsed.planId ?? null,
      customerId: customerId!,
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
