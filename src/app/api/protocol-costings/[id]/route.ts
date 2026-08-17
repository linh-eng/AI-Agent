export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { protocolCostingUpdateSchema } from "@/lib/clinic-validation";
import { updateProtocolCostingVersion, maskProtocolCosting } from "@/lib/protocol-pricing";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const canSee = canSeeFinance(await getSession());
  const v = await prisma.protocolCostingVersion.findUnique({ where: { id: params.id }, include: { protocol: { select: { id: true, code: true, name: true, version: true, compositionMode: true } } } });
  if (!v) return fail(404, "Không tìm thấy version giá vốn gói");
  return ok(maskProtocolCosting(v as any, canSee));
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const patch = protocolCostingUpdateSchema.parse(await req.json());
  const { version, warnings } = await updateProtocolCostingVersion(params.id, patch);
  await auditLog({ userId: session.userId, action: "PROTOCOL_COSTING_RECALCULATED", entityType: "ProtocolCostingVersion", entityId: version.id, changes: { totalEstimatedCost: version.totalEstimatedCost } });
  return ok({ ...maskProtocolCosting(version as any, canSee), warnings });
});
