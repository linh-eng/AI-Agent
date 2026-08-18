export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { voucherRedeemSchema } from "@/lib/clinic-validation";
import { validateVoucher } from "@/lib/loyalty";

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.LOYALTY_READ);
  const i = voucherRedeemSchema.parse(await req.json());
  return ok(await validateVoucher(i.code, i.spend, i.customerId ?? undefined));
});
