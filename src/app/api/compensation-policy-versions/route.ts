export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { compVersionCreateSchema } from "@/lib/clinic-validation";

// POST — tạo version DRAFT mới cho một chính sách.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const input = compVersionCreateSchema.parse(await req.json());
  const agg = await prisma.compensationPolicyVersion.aggregate({ where: { policyId: input.policyId }, _max: { version: true } });
  const policy = await prisma.compensationPolicy.findUnique({ where: { id: input.policyId }, select: { id: true } });
  if (!policy) return fail(404, "Không tìm thấy chính sách");
  const v = await prisma.compensationPolicyVersion.create({
    data: {
      policyId: input.policyId, version: (agg._max.version ?? 0) + 1,
      effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`), effectiveTo: input.effectiveTo ? new Date(`${input.effectiveTo}T00:00:00.000Z`) : null,
      status: "DRAFT", createdBy: session.name ?? session.email ?? null,
    },
  });
  return created(v);
});
