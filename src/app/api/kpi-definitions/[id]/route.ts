export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiDefinitionUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const patch = kpiDefinitionUpdateSchema.parse(await req.json());
  const rec = await prisma.kpiDefinition.update({ where: { id: params.id }, data: { ...patch } as any });
  await auditLog({ userId: session.userId, action: "KPI_DEFINITION_UPDATED", entityType: "KpiDefinition", entityId: rec.id, changes: { fields: Object.keys(patch) } });
  return ok(rec);
});
