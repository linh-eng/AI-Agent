export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { materialMoveSchema } from "@/lib/ext-validation";
import { applyMaterialMovement } from "@/lib/material-service";

// Ghi biến động vật tư: REQUEST/RESERVE/ISSUE/CONSUME/RETURN/WASTE/DAMAGE.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const parsed = materialMoveSchema.parse(await req.json());
  const result = await applyMaterialMovement(params.id, {
    ...parsed,
    staff: parsed.staff ?? session.name,
  });
  return ok(result);
});
