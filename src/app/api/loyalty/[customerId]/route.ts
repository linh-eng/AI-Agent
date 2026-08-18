export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { loyaltySummary } from "@/lib/loyalty";

export const GET = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.LOYALTY_READ);
  return ok(await loyaltySummary(params.customerId));
});
