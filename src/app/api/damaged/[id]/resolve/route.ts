export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { damagedResolveSchema } from "@/lib/validation";
import { resolveDamaged } from "@/lib/warranty-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = damagedResolveSchema.parse(await req.json());
  const result = await resolveDamaged(params.id, input, session.userId);
  return ok(result);
});
