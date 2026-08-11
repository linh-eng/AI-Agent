export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { treatmentPlanCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const plans = await prisma.treatmentPlan.findMany({
    where: customerId ? { customerId } : undefined,
    include: {
      customer: { select: { code: true, fullName: true } },
      _count: { select: { sessions: true, stages: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(plans);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = treatmentPlanCreateSchema.parse(await req.json());
  const { stages, ...planData } = parsed;
  const code = parsed.code ?? sequentialCode("TP", await prisma.treatmentPlan.count());

  const plan = await prisma.treatmentPlan.create({
    data: {
      ...planData,
      code,
      createdBy: parsed.createdBy ?? session.name,
      stages: stages.length
        ? {
            create: stages.map((s, i) => ({
              name: s.name,
              orderIndex: s.orderIndex ?? i,
              description: s.description ?? null,
            })),
          }
        : undefined,
    },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  await auditLog({
    userId: session.userId,
    action: "CREATE",
    entityType: "TreatmentPlan",
    entityId: plan.id,
    changes: { code, name: plan.name },
  });
  return created(plan);
});
