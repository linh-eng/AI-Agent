export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance } from "@/lib/clinic";
import { buildSpaReport, maskSpaReport } from "@/lib/spa-reports";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const session = await getSession();
  const report = await buildSpaReport();
  return ok(maskSpaReport(report, canSeeFinance(session)));
});
