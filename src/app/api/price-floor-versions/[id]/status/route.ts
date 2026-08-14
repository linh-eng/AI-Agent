export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { floorVersionStatusSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { transitionFloorVersion } from "@/lib/price-floor-service";

// Chuyển trạng thái version: submit / approve / activate / cancel.
// submit cần pricefloor.write; approve|activate cần pricefloor.approve (enforce trong service).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const { action, effectiveFrom, effectiveTo, reason } = floorVersionStatusSchema.parse(await req.json());
  const canApprove = session.permissions.includes(PERMISSIONS.PRICEFLOOR_APPROVE);
  const version = await transitionFloorVersion(params.id, action, { effectiveFrom, effectiveTo, reason, actor: session.name, canApprove });
  await auditLog({
    userId: session.userId,
    action: action === "activate" ? "PRICE_FLOOR_VERSION_ACTIVATE" : action === "approve" ? "PRICE_FLOOR_VERSION_APPROVE" : action === "cancel" ? "PRICE_FLOOR_VERSION_CANCEL" : "PRICE_FLOOR_VERSION_SUBMIT",
    entityType: "ServicePriceFloorVersion", entityId: version.id,
    changes: { version: version.version, status: version.status, reason: reason ?? null },
  });
  return ok(version);
});
