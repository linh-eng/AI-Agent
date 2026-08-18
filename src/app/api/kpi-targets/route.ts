export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiTargetCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const p = new URL(req.url).searchParams;
  const where: any = { isActive: true };
  if (p.get("kpiDefinitionId")) where.kpiDefinitionId = p.get("kpiDefinitionId");
  const rows = await prisma.kpiTarget.findMany({ where, include: { definition: { select: { code: true, name: true, unit: true } } }, orderBy: [{ createdAt: "desc" }] });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const input = kpiTargetCreateSchema.parse(await req.json());
  const rec = await prisma.kpiTarget.create({
    data: {
      kpiDefinitionId: input.kpiDefinitionId, scope: input.scope ?? "COMPANY", scopeRef: input.scopeRef ?? null,
      targetValue: input.targetValue as any,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
    },
  });
  await auditLog({ userId: session.userId, action: "KPI_TARGET_CREATED", entityType: "KpiTarget", entityId: rec.id, changes: { kpiDefinitionId: input.kpiDefinitionId, scope: input.scope ?? "COMPANY" } });
  return created(rec);
});
