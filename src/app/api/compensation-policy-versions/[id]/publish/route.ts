export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { publishPolicyVersion } from "@/lib/compensation";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  await publishPolicyVersion(session, params.id);
  return ok({ published: true });
});
