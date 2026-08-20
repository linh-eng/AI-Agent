export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance } from "@/lib/clinic";
import { buildLaborLinesFromCatalog } from "@/lib/staff-role-rate";

// GET /api/service-costings/labor-defaults?serviceId= → gợi ý DÒNG nhân sự mặc định
// từ staffRequirements của dịch vụ khớp Bảng đơn giá vai trò. Mask số tiền theo finance.read.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const serviceId = new URL(req.url).searchParams.get("serviceId");
  if (!serviceId) return ok({ lines: [], warnings: [] });
  const { lines, warnings } = await buildLaborLinesFromCatalog(serviceId);
  const masked = canSee
    ? lines
    : lines.map((l) => ({ ...l, baseFee: null, bonus: null, tips: null, commission: null }));
  return ok({ lines: masked, warnings });
});
