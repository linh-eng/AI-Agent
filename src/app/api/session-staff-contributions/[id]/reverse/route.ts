export const dynamic = "force-dynamic";
import { created, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { contributionReverseSchema } from "@/lib/clinic-validation";
import { reverseContribution } from "@/lib/contribution-service";

export const POST = handle(async (req, { params }) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.TREATMENT_WRITE);
  const canEdit = session.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED);
  const { reason } = contributionReverseSchema.parse(await req.json());
  const rec = await reverseContribution(session, params.id, reason, canWrite, canEdit);
  return created(rec);
});
