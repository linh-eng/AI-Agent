export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { voucherRedeemSchema } from "@/lib/clinic-validation";
import { redeemVoucher } from "@/lib/loyalty";

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.LOYALTY_WRITE);
  const i = voucherRedeemSchema.parse(await req.json());
  return ok(await redeemVoucher(session, i.code, { spend: i.spend, customerId: i.customerId ?? undefined, invoiceId: i.invoiceId ?? undefined }));
});
