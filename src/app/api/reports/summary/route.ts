export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { reportSummary } from "@/lib/reports";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const data = await reportSummary();
  return ok(data);
});
