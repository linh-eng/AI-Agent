export const dynamic = "force-dynamic";

import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { followUpApplySchema } from "@/lib/clinic-validation";
import { applyFollowUpTemplate, FollowUpDuplicateError } from "@/lib/followup";
import { auditLog } from "@/lib/clinic";

// Áp quy trình CSKH cho một khách → tạo LẦN ÁP (instance) + sinh Task follow-up
// theo lịch. Quyền: FOLLOWUP_APPLY (Quản lý + CSKH), KHÔNG dùng TASK_WRITE chung.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.FOLLOWUP_APPLY);
  const parsed = followUpApplySchema.parse(await req.json());
  try {
    const result = await applyFollowUpTemplate({
      templateId: params.id,
      customerId: parsed.customerId,
      anchorDate: parsed.anchorDate ?? undefined,
      assignee: parsed.assignee ?? session.name,
      createdBy: session.name,
      force: parsed.force,
      note: parsed.note ?? null,
    });
    await auditLog({
      userId: session.userId,
      action: "FOLLOWUP_APPLIED",
      entityType: "CareProcessInstance",
      entityId: result.instance.id,
      changes: {
        templateId: params.id,
        customerId: parsed.customerId,
        instanceCode: result.instance.code,
        templateVersion: result.instance.templateVersion,
        tasks: result.tasks.length,
        forced: !!parsed.force,
      },
    });
    return ok({ instance: result.instance, tasks: result.tasks, count: result.tasks.length });
  } catch (e) {
    // Chống trùng: trả 409 kèm thông tin lần áp đang chạy để UI hỏi xác nhận.
    if (e instanceof FollowUpDuplicateError) {
      return fail(409, e.message, {
        code: e.code,
        existing: {
          id: e.existing.id,
          code: e.existing.code,
          appliedAt: e.existing.appliedAt,
          startDate: e.existing.startDate,
        },
      });
    }
    throw e;
  }
});
