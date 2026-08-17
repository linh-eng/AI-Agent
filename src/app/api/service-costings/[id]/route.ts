export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { costingUpdateSchema } from "@/lib/clinic-validation";
import { updateCostingVersion, maskCosting } from "@/lib/service-costing";

// GET /api/service-costings/[id] → chi tiết 1 version (kèm dịch vụ). Cost mask theo finance.read.
export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const v = await prisma.serviceCostingVersion.findUnique({
    where: { id: params.id },
    include: { service: { select: { id: true, code: true, name: true, version: true, standardPrice: true } } },
  });
  if (!v) return fail(404, "Không tìm thấy version giá vốn");
  return ok(maskCosting(v as any, canSee));
});

// PATCH /api/service-costings/[id] → sửa DRAFT + tính lại LIVE. Published → 409.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const patch = costingUpdateSchema.parse(await req.json());
  const before = await prisma.serviceCostingVersion.findUnique({ where: { id: params.id }, select: { materialOverride: true, materialOverrideReason: true } });
  if (!before) return fail(404, "Không tìm thấy version giá vốn");
  const { version, warnings, overrideChanged } = await updateCostingVersion(params.id, patch);

  if (overrideChanged) {
    await auditLog({
      userId: session.userId,
      action: "SERVICE_COSTING_OVERRIDE_CHANGED",
      entityType: "ServiceCostingVersion",
      entityId: version.id,
      changes: {
        materialOverride: { before: before.materialOverride, after: version.materialOverride },
        reason: version.materialOverrideReason,
      },
    });
  }
  await auditLog({
    userId: session.userId,
    action: "SERVICE_COSTING_RECALCULATED",
    entityType: "ServiceCostingVersion",
    entityId: version.id,
    changes: { totalEstimatedCost: version.totalEstimatedCost },
  });
  return ok({ ...maskCosting(version as any, canSee), warnings });
});
