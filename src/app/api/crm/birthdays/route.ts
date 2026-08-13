export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { upcomingBirthdays } from "@/lib/followup";

// Danh sách khách có sinh nhật sắp tới (chương trình CSKH sinh nhật, mục 34).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
  return ok(await upcomingBirthdays(days));
});
