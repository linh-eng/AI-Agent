export const dynamic = "force-dynamic";
import { handle, ok } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance } from "@/lib/clinic";
import { materialsReport } from "@/lib/materials-report";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const data = await materialsReport();
  if (!canSeeFinance(session)) {
    // Ẩn chi phí nếu không có quyền tài chính.
    const strip = (arr: any[]) => arr.map((r) => ({ ...r, cost: 0 }));
    data.byCustomer = strip(data.byCustomer); data.bySession = strip(data.bySession);
    data.byService = strip(data.byService); data.byTech = strip(data.byTech);
    data.byProtocol = strip(data.byProtocol); data.byStaff = strip(data.byStaff);
    data.byPlan = strip(data.byPlan);
    data.expectedVsActual = data.expectedVsActual.map((r) => ({ ...r, cost: 0 }));
  }
  return ok(data);
});
