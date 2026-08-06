export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { warrantyRouteSchema } from "@/lib/validation";
import { routeWarrantyIntake } from "@/lib/warranty-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = warrantyRouteSchema.parse(await req.json());
  const result = await routeWarrantyIntake(params.id, input, session.userId);
  return ok(result);
});
