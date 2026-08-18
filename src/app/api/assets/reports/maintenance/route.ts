export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getMaintenanceSchedule } from "@/lib/asset-reports";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  return ok(await getMaintenanceSchedule());
});
