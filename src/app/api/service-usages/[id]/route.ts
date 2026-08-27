export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { cancelReasonSchema } from "@/lib/validation";
import { cancelServiceUsage } from "@/lib/service-service";

// Hủy ghi nhận dịch vụ — chỉ Quản trị/Quản lý (service.write). Hoàn tồn kho +
// hủy phiếu xuất tiêu hao liên quan, bắt buộc lý do.
export const DELETE = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const { reason } = cancelReasonSchema.parse(await req.json());
  const result = await cancelServiceUsage(ctx.params.id, reason, session.userId);
  return ok(result);
});
