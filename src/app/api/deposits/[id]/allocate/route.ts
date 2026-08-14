export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { depositAllocateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { allocateDeposit } from "@/lib/deposit";

// Phân bổ cọc ACTIVE vào một hóa đơn (đúng một lần). Chặn phân bổ trùng / vượt công nợ.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.DEPOSIT_WRITE);
  const { invoiceId } = depositAllocateSchema.parse(await req.json());
  const result = await allocateDeposit(params.id, invoiceId, session.name);
  await auditLog({
    userId: session.userId,
    action: "DEPOSIT_ALLOCATED",
    entityType: "Deposit",
    entityId: params.id,
    changes: { invoiceId, invoiceStatus: result.invoice?.status },
  });
  return ok(result);
});
