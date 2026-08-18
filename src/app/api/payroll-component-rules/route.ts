export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { payrollComponentSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PAYROLL_READ);
  const rows = await prisma.payrollComponentRule.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PAYROLL_WRITE);
  const input = payrollComponentSchema.parse(await req.json());
  const rec = await prisma.payrollComponentRule.create({ data: {
    code: input.code, name: input.name, kind: input.kind, calcType: (input.calcType as any) ?? "FIXED",
    value: input.value as any, scope: input.scope ?? "COMPANY", scopeRef: input.scopeRef ?? null,
    sortOrder: input.sortOrder ?? 0, isActive: input.isActive ?? true, createdBy: session.name ?? session.email ?? null,
  } });
  await auditLog({ userId: session.userId, action: "PAYROLL_COMPONENT_CREATED", entityType: "PayrollComponentRule", entityId: rec.id, changes: { code: input.code, kind: input.kind } });
  return created(rec);
});
