export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.COMPENSATION_POLICY_READ);
  const policy = await prisma.compensationPolicy.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { version: "desc" }, include: { commissionRules: true, incentiveRules: true, kpiBonusRules: true } } },
  });
  if (!policy) return fail(404, "Không tìm thấy chính sách");
  return ok(policy);
});
