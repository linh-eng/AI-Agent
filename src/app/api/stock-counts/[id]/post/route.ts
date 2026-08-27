export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stockCountPostSchema } from "@/lib/validation";
import { postStockCount } from "@/lib/stockcount-service";

export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.STOCKCOUNT_WRITE);
  const { items } = stockCountPostSchema.parse(await req.json());
  const result = await postStockCount(ctx.params.id, items, session.userId);
  return ok(result);
});
