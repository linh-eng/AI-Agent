export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getInventory } from "@/lib/inventory";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const data = await getInventory();
  return ok(data);
});
