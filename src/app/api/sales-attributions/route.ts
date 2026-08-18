export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { salesAttributionSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_READ);
  const p = new URL(req.url).searchParams;
  const where: any = {};
  if (p.get("sourceType")) where.sourceType = p.get("sourceType");
  if (p.get("sourceId")) where.sourceId = p.get("sourceId");
  if (p.get("employeeId")) where.employeeId = p.get("employeeId");
  const rows = await prisma.salesAttribution.findMany({ where, include: { employee: { select: { code: true, fullName: true } } }, orderBy: [{ createdAt: "desc" }], take: 1000 });
  return ok(rows);
});

// POST — attribution TƯỜNG MINH theo FK nhân sự (KHÔNG suy từ createdBy tên tự do).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = salesAttributionSchema.parse(await req.json());
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, fullName: true, title: true, branchId: true } });
  if (!emp) return fail(422, "Nhân sự không tồn tại");
  const rec = await prisma.salesAttribution.create({ data: {
    employeeId: emp.id, sourceType: input.sourceType as any, sourceId: input.sourceId, attributionRole: input.attributionRole as any,
    weight: (input.weight ?? 1) as any, branchId: input.branchId ?? emp.branchId ?? null,
    employeeNameSnapshot: emp.fullName, roleSnapshot: emp.title ?? null, status: "ACTIVE", createdBy: session.name ?? session.email ?? null,
  } });
  await auditLog({ userId: session.userId, action: "SALES_ATTRIBUTION_CREATED", entityType: "SalesAttribution", entityId: rec.id, changes: { employeeId: emp.id, sourceType: input.sourceType, sourceId: input.sourceId, role: input.attributionRole } });
  return created(rec);
});
