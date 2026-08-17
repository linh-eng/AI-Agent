export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionExecutionCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { buildExecutionSnapshot, executionItemInclude } from "@/lib/session-execution";

// Danh sách execution item của 1 buổi.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return fail(400, "Thiếu sessionId");
  const items = await prisma.sessionExecutionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    include: executionItemInclude,
  });
  return ok(items);
});

// Thêm 1 dịch vụ THỰC TẾ đã làm + ĐÔNG CỨNG snapshot ngay (bất biến).
export const POST = handle(async (req) => {
  const auth = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const d = sessionExecutionCreateSchema.parse(await req.json());

  const sess = await prisma.treatmentSession.findUnique({ where: { id: d.sessionId }, select: { id: true, status: true } });
  if (!sess) return fail(404, "Không tìm thấy buổi");
  // Sửa buổi ĐÃ hoàn thành cần quyền editCompleted (giữ baseline mục 29).
  if (sess.status === "COMPLETED" && !auth.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED)) {
    return fail(403, "Buổi đã hoàn thành — cần quyền sửa buổi đã hoàn thành.");
  }

  const svc = await prisma.service.findUnique({ where: { id: d.serviceId }, select: { id: true, version: true } });
  if (!svc) return fail(422, "Dịch vụ không tồn tại");

  const snapshot = await buildExecutionSnapshot({
    serviceId: d.serviceId,
    selectedOptionSource: d.selectedOptionSource,
    selectedOptionId: d.selectedOptionId ?? null,
    selectedOptionName: d.selectedOptionName ?? null,
    actualValues: d.actualValues ?? [],
    instructions: d.instructions ?? null,
  });

  const count = await prisma.sessionExecutionItem.count({ where: { sessionId: d.sessionId } });
  const item = await prisma.sessionExecutionItem.create({
    data: {
      sessionId: d.sessionId,
      bookingItemId: d.bookingItemId ?? null,
      serviceId: d.serviceId,
      sortOrder: count,
      selectedOptionSource: d.selectedOptionSource,
      selectedOptionId: d.selectedOptionId ?? null,
      selectedOptionName: d.selectedOptionName ?? null,
      sourceVersion: svc.version, // version Service lúc thực hiện (đối chiếu)
      executionSnapshot: snapshot as any, // BẤT BIẾN
      actualStartAt: d.actualStartAt ?? null,
      actualEndAt: d.actualEndAt ?? null,
      note: d.note ?? null,
    },
    include: executionItemInclude,
  });

  await auditLog({ userId: auth.userId, action: "SESSION_OPTION_SELECTED", entityType: "TreatmentSession", entityId: d.sessionId, changes: { executionItemId: item.id, serviceId: d.serviceId, option: d.selectedOptionName ?? null, source: d.selectedOptionSource } });
  await auditLog({ userId: auth.userId, action: "SESSION_SNAPSHOT_FROZEN", entityType: "SessionExecutionItem", entityId: item.id, changes: { serviceVersion: svc.version } });
  return created(item);
});
