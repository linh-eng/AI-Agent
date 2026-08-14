export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { depositVoidSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { voidDeposit } from "@/lib/deposit";

// Hủy phiếu cọc chưa phân bổ (giữ vết + audit). Cọc đã phân bổ phải gỡ trước.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.DEPOSIT_WRITE);
  const { reason } = depositVoidSchema.parse(await req.json());
  const deposit = await voidDeposit(params.id, reason, session.name);
  await auditLog({
    userId: session.userId,
    action: "DEPOSIT_VOID",
    entityType: "Deposit",
    entityId: params.id,
    changes: { reason },
  });
  return ok(deposit);
});
