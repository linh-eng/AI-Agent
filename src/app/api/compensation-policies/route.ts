export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { compPolicyCreateSchema } from "@/lib/clinic-validation";
import { nextPolicyCode } from "@/lib/compensation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_READ);
  const rows = await prisma.compensationPolicy.findMany({ orderBy: [{ createdAt: "desc" }], include: { versions: { orderBy: { version: "desc" } } } });
  return ok(rows);
});

// POST — tạo chính sách + version 1 DRAFT.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = compPolicyCreateSchema.parse(await req.json());
  const code = await nextPolicyCode();
  const policy = await prisma.compensationPolicy.create({
    data: {
      code, name: input.name, scopeType: (input.scopeType as any) ?? "COMPANY",
      branchId: input.branchId ?? null, roleCode: input.roleCode ?? null, employeeId: input.employeeId ?? null,
      note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
      versions: { create: { version: 1, effectiveFrom: new Date(), status: "DRAFT", createdBy: session.name ?? session.email ?? null } },
    },
    include: { versions: true },
  });
  await auditLog({ userId: session.userId, action: "COMPENSATION_POLICY_CREATED", entityType: "CompensationPolicy", entityId: policy.id, changes: { code, scopeType: policy.scopeType } });
  return created(policy);
});
