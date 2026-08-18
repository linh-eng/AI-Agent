export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { compReverseSchema } from "@/lib/clinic-validation";
import { reverseCompensationEvent } from "@/lib/compensation";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const { reason } = compReverseSchema.parse(await req.json());
  await reverseCompensationEvent(session, params.id, reason);
  return ok({ reversed: true });
});
