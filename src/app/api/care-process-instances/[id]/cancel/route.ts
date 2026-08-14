export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { careInstanceCancelSchema } from "@/lib/clinic-validation";
import { cancelCareInstance } from "@/lib/followup";
import { auditLog } from "@/lib/clinic";

// Hủy một LẦN ÁP quy trình CSKH (khác "ngưng dùng" mẫu) — giữ lịch sử, hủy task
// tương lai của lần áp. Lý do bắt buộc. Quyền: FOLLOWUP_APPLY.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.FOLLOWUP_APPLY);
  const parsed = careInstanceCancelSchema.parse(await req.json());
  const res = await cancelCareInstance({
    instanceId: params.id,
    reason: parsed.reason,
    cancelledBy: session.name,
  });
  await auditLog({
    userId: session.userId,
    action: "CARE_INSTANCE_CANCELLED",
    entityType: "CareProcessInstance",
    entityId: params.id,
    changes: { reason: parsed.reason, cancelledTasks: res.cancelledTasks },
  });
  return ok(res);
});
