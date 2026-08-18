export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiDefinitionCreateSchema } from "@/lib/clinic-validation";
import { ensureKpiDefinitions } from "@/lib/kpi";
import { auditLog } from "@/lib/clinic";

// GET — danh mục KPI (attendance.read HOẶC self linked-employee được xem để tự theo dõi).
export const GET = handle(async () => {
  await requireAuth();
  await ensureKpiDefinitions();
  const rows = await prisma.kpiDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  return ok(rows);
});

// POST — tạo KPI (attendance.write). KHÔNG dùng payroll.read cho KPI thường.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const input = kpiDefinitionCreateSchema.parse(await req.json());
  const rec = await prisma.kpiDefinition.create({ data: { ...input } as any });
  await auditLog({ userId: session.userId, action: "KPI_DEFINITION_CREATED", entityType: "KpiDefinition", entityId: rec.id, changes: { code: rec.code } });
  return created(rec);
});
