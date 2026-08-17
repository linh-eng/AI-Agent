export const dynamic = "force-dynamic";

import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { materialUsageReverseSchema } from "@/lib/clinic-validation";
import { reverseUsage, MaterialError } from "@/lib/spa-material-service";
import { auditLog } from "@/lib/clinic";

// Redesign P4 — HOÀN TÁC không phá hủy: tạo record REVERSAL, giữ bản gốc, audit.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const { reason } = materialUsageReverseSchema.parse(await req.json());
  try {
    const res = await reverseUsage(params.id, { reason, performedBy: session.name });
    await auditLog({
      userId: session.userId,
      action: "MATERIAL_USAGE_REVERSED",
      entityType: "MaterialUsage",
      entityId: res.originalId,
      changes: { reversalId: res.reversalId, reason },
    });
    return ok(res);
  } catch (e) {
    if (e instanceof MaterialError) return fail(e.status, e.message);
    throw e;
  }
});
