export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionExecutionUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { executionItemInclude } from "@/lib/session-execution";

// Sửa METADATA của execution item (note/giờ/tên phương án). KHÔNG ghi đè executionSnapshot
// đã đông cứng — muốn đổi phương án/giá trị thực tế trước freeze thì DELETE + tạo lại.
export const PATCH = handle(async (req, { params }) => {
  const auth = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const d = sessionExecutionUpdateSchema.parse(await req.json());
  const item = await prisma.sessionExecutionItem.findUnique({
    where: { id: params.id },
    include: { session: { select: { status: true } } },
  });
  if (!item) return fail(404, "Không tìm thấy execution item");

  // Buổi đã hoàn thành → cần quyền editCompleted + lý do (baseline mục 29).
  if (item.session.status === "COMPLETED") {
    if (!auth.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED)) return fail(403, "Buổi đã hoàn thành — cần quyền sửa buổi đã hoàn thành.");
    if (!d.reason || !d.reason.trim()) return fail(422, "Cần nhập lý do khi sửa buổi đã hoàn thành.");
  }

  const before = { note: item.note, actualStartAt: item.actualStartAt, actualEndAt: item.actualEndAt, selectedOptionName: item.selectedOptionName };
  const updated = await prisma.sessionExecutionItem.update({
    where: { id: params.id },
    data: {
      note: d.note ?? item.note,
      actualStartAt: d.actualStartAt ?? item.actualStartAt,
      actualEndAt: d.actualEndAt ?? item.actualEndAt,
      selectedOptionName: d.selectedOptionName ?? item.selectedOptionName,
      // executionSnapshot KHÔNG đổi (bất biến sau đông cứng)
    },
    include: executionItemInclude,
  });

  await auditLog({
    userId: auth.userId,
    action: "SESSION_EXECUTION_CHANGED",
    entityType: "SessionExecutionItem",
    entityId: params.id,
    changes: { before, after: { note: updated.note, actualStartAt: updated.actualStartAt, actualEndAt: updated.actualEndAt, selectedOptionName: updated.selectedOptionName }, reason: d.reason ?? null },
  });
  return ok(updated);
});

export const DELETE = handle(async (_req, { params }) => {
  const auth = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const item = await prisma.sessionExecutionItem.findUnique({ where: { id: params.id }, include: { session: { select: { status: true } } } });
  if (!item) return fail(404, "Không tìm thấy execution item");
  if (item.session.status === "COMPLETED" && !auth.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED)) {
    return fail(403, "Buổi đã hoàn thành — cần quyền sửa buổi đã hoàn thành.");
  }
  await prisma.sessionExecutionItem.delete({ where: { id: params.id } });
  await auditLog({ userId: auth.userId, action: "SESSION_EXECUTION_CHANGED", entityType: "SessionExecutionItem", entityId: params.id, changes: { deleted: true } });
  return ok({ id: params.id, deleted: true });
});
