export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { beforeAfterGroups } from "@/lib/review";

// Thư viện ảnh Before/After gom theo buổi (mục 8) — lọc theo khách/dịch vụ/ngày.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const serviceId = url.searchParams.get("serviceId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const groups = await beforeAfterGroups({
    customerId,
    serviceId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return ok(groups);
});
