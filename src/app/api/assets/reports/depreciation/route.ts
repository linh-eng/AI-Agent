export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getDepreciationReport } from "@/lib/asset-reports";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const url = new URL(req.url);
  const asOfStr = url.searchParams.get("asOf");
  let asOf = new Date();
  if (asOfStr) {
    const d = new Date(asOfStr);
    if (!isNaN(d.getTime())) asOf = d;
  }
  return ok(await getDepreciationReport(asOf));
});
