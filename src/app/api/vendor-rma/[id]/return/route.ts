export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { vendorRmaReturnSchema } from "@/lib/validation";
import { returnFromVendor } from "@/lib/warranty-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = vendorRmaReturnSchema.parse(await req.json());
  const result = await returnFromVendor(params.id, input, session.userId);
  return ok(result);
});
