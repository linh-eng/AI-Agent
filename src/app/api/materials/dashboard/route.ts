export const dynamic = "force-dynamic";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { canSeeFinance } from "@/lib/clinic";
import { materialsDashboard } from "@/lib/materials-report";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const data = await materialsDashboard();
  if (!canSeeFinance(session)) {
    data.cards.usedTodayCost = 0;
    data.byService = data.byService.map((r) => ({ ...r, cost: 0 }));
    data.byTech = data.byTech.map((r) => ({ ...r, cost: 0 }));
  }
  return ok(data);
});
