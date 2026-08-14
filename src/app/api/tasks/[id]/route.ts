export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { taskActionSchema, taskUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { recomputeCareInstanceStatus } from "@/lib/followup";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { code: true, fullName: true } },
      careInstance: { select: { code: true, templateName: true, templateVersion: true, status: true } },
    },
  });
  if (!task) return fail(404, "Không tìm thấy công việc");
  return ok(task);
});

// Vòng đời task CSKH (mục 9) — hành động có audit, KHÔNG hard-delete lịch sử.
// Nếu body có `action` → xử lý theo vòng đời; ngược lại giữ tương thích PATCH cũ.
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.TASK_WRITE);
  const session = await getSession();
  const who = session?.name ?? null;
  const body = await req.json();

  const current = await prisma.task.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy công việc");

  // --- Chế độ tương thích cũ: body không có `action` ---
  if (!body || typeof body !== "object" || !("action" in body)) {
    const parsed = taskUpdateSchema.parse(body);
    const task = await prisma.task.update({ where: { id: params.id }, data: parsed });
    return ok(task);
  }

  const parsed = taskActionSchema.parse(body);
  const now = new Date();

  switch (parsed.action) {
    case "start": {
      const task = await prisma.task.update({
        where: { id: params.id },
        data: { status: "IN_PROGRESS" },
      });
      await auditLog({ userId: session?.userId, action: "TASK_STARTED", entityType: "Task", entityId: task.id, changes: { from: current.status } });
      return ok(task);
    }
    case "complete": {
      const task = await prisma.task.update({
        where: { id: params.id },
        data: {
          status: "DONE",
          completedAt: now,
          completedBy: who,
          completionNote: parsed.completionNote ?? null,
          checklistState: parsed.checklistState ? (parsed.checklistState as unknown as object) : undefined,
          actualChannel: parsed.actualChannel ?? current.channel ?? undefined,
          // hoàn thành thì gỡ cờ reopen cũ (nếu có) để phản ánh trạng thái hiện tại
        },
      });
      await auditLog({
        userId: session?.userId, action: "TASK_COMPLETED", entityType: "Task", entityId: task.id,
        changes: { completedBy: who, completionNote: parsed.completionNote ?? null, actualChannel: task.actualChannel },
      });
      if (current.careProcessInstanceId) await recomputeCareInstanceStatus(current.careProcessInstanceId);
      return ok(task);
    }
    case "reopen": {
      if (current.status !== "DONE") return fail(409, "Chỉ mở lại được công việc đã hoàn thành");
      if (!parsed.reason || !parsed.reason.trim()) return fail(422, "Nhập lý do mở lại công việc");
      const task = await prisma.task.update({
        where: { id: params.id },
        data: {
          status: "OPEN",
          reopenedAt: now,
          reopenedBy: who,
          reopenReason: parsed.reason,
          completedAt: null,
          completedBy: null,
        },
      });
      await auditLog({
        userId: session?.userId, action: "TASK_REOPENED", entityType: "Task", entityId: task.id,
        changes: { reason: parsed.reason, previousCompletedBy: current.completedBy, previousCompletedAt: current.completedAt },
      });
      if (current.careProcessInstanceId) await recomputeCareInstanceStatus(current.careProcessInstanceId);
      return ok(task);
    }
    case "cancel": {
      if (!parsed.reason || !parsed.reason.trim()) return fail(422, "Nhập lý do hủy công việc");
      const task = await prisma.task.update({
        where: { id: params.id },
        data: { status: "CANCELLED", cancelledAt: now, cancelledBy: who, cancelReason: parsed.reason },
      });
      await auditLog({
        userId: session?.userId, action: "TASK_CANCELLED", entityType: "Task", entityId: task.id,
        changes: { reason: parsed.reason, from: current.status },
      });
      if (current.careProcessInstanceId) await recomputeCareInstanceStatus(current.careProcessInstanceId);
      return ok(task);
    }
    case "update": {
      // Sửa hạn/phụ trách/nội dung/kênh/ưu tiên → ghi diff từng trường (audit).
      const data: Record<string, unknown> = {};
      const diff: Record<string, { before: unknown; after: unknown }> = {};
      const track = (field: string, before: unknown, after: unknown) => {
        if (after !== undefined && String(after ?? "") !== String(before ?? "")) {
          data[field] = after;
          diff[field] = { before, after };
        }
      };
      track("assignee", current.assignee, parsed.assignee);
      track("dueDate", current.dueDate?.toISOString?.() ?? current.dueDate, parsed.dueDate ? parsed.dueDate.toISOString() : parsed.dueDate);
      track("priority", current.priority, parsed.priority);
      track("channel", current.channel, parsed.channel);
      track("description", current.description, parsed.description);
      track("title", current.title, parsed.title);
      // dueDate cần lưu dạng Date, không phải string
      if (parsed.dueDate !== undefined && diff.dueDate) data.dueDate = parsed.dueDate;

      if (Object.keys(data).length === 0) return ok(current);
      const task = await prisma.task.update({ where: { id: params.id }, data });
      await auditLog({
        userId: session?.userId, action: "TASK_UPDATED", entityType: "Task", entityId: task.id, changes: { diff },
      });
      return ok(task);
    }
    default:
      return fail(400, "Hành động không hợp lệ");
  }
});
