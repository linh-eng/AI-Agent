export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { compReverseSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// POST — void attribution (không hard-delete).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const { reason } = compReverseSchema.parse(await req.json());
  const rec = await prisma.salesAttribution.findUnique({ where: { id: params.id } });
  if (!rec) return fail(404, "Không tìm thấy attribution");
  await prisma.salesAttribution.update({ where: { id: params.id }, data: { status: "VOID", voidReason: reason, voidedBy: session.name ?? session.email ?? null, voidedAt: new Date() } });
  await auditLog({ userId: session.userId, action: "SALES_ATTRIBUTION_VOIDED", entityType: "SalesAttribution", entityId: params.id, changes: { reason } });
  return ok({ voided: true });
});
