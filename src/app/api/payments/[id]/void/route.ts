export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { paymentVoidSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { voidPayment } from "@/lib/deposit";

// Hủy phiếu thu (mục 16) — không hard-delete, ghi vết + audit, tính lại công nợ hóa đơn.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PAYMENT_VOID);
  const { reason } = paymentVoidSchema.parse(await req.json());
  const result = await voidPayment(params.id, reason, session.name);
  await auditLog({
    userId: session.userId,
    action: "PAYMENT_VOID",
    entityType: "Payment",
    entityId: params.id,
    changes: { reason, invoice: result.invoice?.status },
  });
  return ok(result);
});
