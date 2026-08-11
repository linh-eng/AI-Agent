export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionCreateSchema } from "@/lib/clinic-validation";

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
    select: { customerId: true },
  });
  if (!plan) return fail(404, "Không tìm thấy phác đồ");

  const session = await prisma.treatmentSession.create({
    data: {
      planId: parsed.planId,
      customerId: plan.customerId,
      stageId: parsed.stageId ?? null,
      bookingId: parsed.bookingId ?? null,
      serviceId: parsed.serviceId ?? null,
      sessionNumber: parsed.sessionNumber,
      name: parsed.name ?? null,
      status: parsed.status,
      scheduledAt: parsed.scheduledAt,
      objective: parsed.objective ?? null,
      plannedParams: (parsed.plannedParams as any) ?? undefined,
      plannedMaterials: (parsed.plannedMaterials as any) ?? undefined,
      plannedCost: parsed.plannedCost ?? null,
      price: parsed.price ?? null,
      preCare: parsed.preCare ?? null,
      note: parsed.note ?? null,
    },
  });
  return created(session);
});
