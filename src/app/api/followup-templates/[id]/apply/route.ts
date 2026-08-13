export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { followUpApplySchema } from "@/lib/clinic-validation";
import { applyFollowUpTemplate } from "@/lib/followup";
import { auditLog } from "@/lib/clinic";

// Áp quy trình CSKH cho một khách → sinh Task follow-up theo lịch.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TASK_WRITE);
  const parsed = followUpApplySchema.parse(await req.json());
  const tasks = await applyFollowUpTemplate({
    templateId: params.id,
    customerId: parsed.customerId,
    anchorDate: parsed.anchorDate ?? undefined,
    assignee: parsed.assignee ?? session.name,
    createdBy: session.name,
  });
  await auditLog({
    userId: session.userId,
    action: "FOLLOWUP_APPLIED",
    entityType: "FollowUpTemplate",
    entityId: params.id,
    changes: { customerId: parsed.customerId, tasks: tasks.length },
  });
  return ok({ tasks, count: tasks.length });
});
