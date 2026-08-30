export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance, auditLog } from "@/lib/clinic";
import { deriveStageStatus, PRE_EXECUTION_PLAN_STATUSES } from "@/lib/treatment-plan";
import { buildSessionSnapshot } from "@/lib/session-execution";
import { freezeSessionContributions } from "@/lib/contribution-service";
import { freezeRecognizedRevenue, reverseRecognizedRevenue } from "@/lib/recognized-revenue";

// Các trường "thực tế" được kiểm khi sửa buổi đã hoàn thành (để ghi diff audit).
const AUDIT_FIELDS = [
  "status", "serviceId", "technologyId", "brandProtocolId", "performer", "treatmentArea",
  "conditionBefore", "conditionAfter", "customerFeedback", "postCare", "note",
  "actualCost", "incident", "handledAction", "nextSuggestion",
] as const;
function scalarStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const session = await getSession();
  const item = await prisma.treatmentSession.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { id: true, name: true } },
      technology: { select: { id: true, name: true } },
      brandProtocol: { select: { id: true, name: true, code: true, steps: true, contraindications: true } },
      plan: { select: { id: true, code: true, name: true, version: true, status: true } },
      stage: { select: { id: true, name: true, plannedStartDate: true, plannedEndDate: true } },
      booking: {
        select: {
          id: true, code: true, scheduledAt: true, status: true, durationMinutes: true,
          technician: true, master: true, room: true, bed: true, machine: true,
        },
      },
      customer: { select: { id: true, code: true, fullName: true, phone: true } },
      // Redesign P4 — dịch vụ thực tế đã làm (execution items) + snapshot cấp buổi.
      executionItems: {
        orderBy: { sortOrder: "asc" },
        include: { service: { select: { id: true, code: true, name: true, version: true } }, bookingItem: { select: { id: true, serviceId: true } } },
      },
    },
  });
  if (!item) return fail(404, "Không tìm thấy buổi thực hiện");
  return ok(maskFinance(item, canSeeFinance(session), ["plannedCost", "actualCost", "recognizedRevenue"]));
});

// Ghi nhận thông số/vật tư/before-after/chi phí thực tế của buổi (mục 16, 17, 20) + hoàn thành/sửa (mục 5)
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const { editReason, ...parsed } = sessionUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = { ...parsed };

  const cur = await prisma.treatmentSession.findUnique({
    where: { id: params.id },
    select: {
      status: true, performedAt: true, versionAtExecution: true, serviceId: true,
      technologyId: true, brandProtocolId: true, performer: true, treatmentArea: true,
      conditionBefore: true, conditionAfter: true, customerFeedback: true, postCare: true,
      note: true, actualCost: true, incident: true, handledAction: true, nextSuggestion: true,
      editLog: true, executionFrozenAt: true, plan: { select: { version: true } },
    },
  });
  if (!cur) return fail(404, "Không tìm thấy buổi thực hiện");
  const wasCompleted = cur.status === "COMPLETED";

  // KHÓA SAU HOÀN THÀNH (mục 29): buổi đã COMPLETED chỉ sửa được khi có quyền + lý do; ghi audit diff.
  if (wasCompleted) {
    if (!session.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED)) {
      return fail(403, "Buổi đã hoàn thành — bạn không có quyền sửa ghi nhận đã hoàn thành.");
    }
    if (!editReason || !editReason.trim()) {
      return fail(422, "Cần nhập lý do khi sửa buổi đã hoàn thành.");
    }
  }

  // VALIDATE HOÀN THÀNH (mục 28): cần có dịch vụ thực tế trước khi đánh dấu Hoàn thành.
  if (parsed.status === "COMPLETED" && !wasCompleted) {
    const effectiveService = parsed.serviceId ?? cur.serviceId;
    if (!effectiveService) {
      return fail(422, "Cần chọn dịch vụ thực tế trước khi hoàn thành buổi.");
    }
    if (!parsed.performedAt && !cur.performedAt) data.performedAt = new Date();
    // Ghim version thực hiện nếu chưa có — buổi đã hoàn thành thuộc đúng version tại thời điểm đó
    if (cur.versionAtExecution == null) data.versionAtExecution = cur.plan?.version ?? undefined;
    // Redesign P4 — ĐÔNG CỨNG snapshot cấp buổi khi hoàn thành (idempotent: chỉ freeze nếu chưa).
    // KHÔNG auto-deduct vật tư (chỉ usage đã POST mới trừ kho). freeze = metadata, không double-effect.
    if (cur.executionFrozenAt == null) {
      const execItems = await prisma.sessionExecutionItem.findMany({ where: { sessionId: params.id }, orderBy: { sortOrder: "asc" }, select: { serviceId: true, selectedOptionName: true, executionSnapshot: true } });
      data.executionFrozenAt = new Date();
      data.executionSnapshot = buildSessionSnapshot(execItems as any) as any;
    }
  }

  const item = await prisma.treatmentSession.update({ where: { id: params.id }, data });

  // Audit hoàn thành buổi (P4) — không log secret.
  if (parsed.status === "COMPLETED" && !wasCompleted) {
    // HR-PH3 — đông cứng đóng góp nhân sự khi buổi freeze (DRAFT → ACTIVE, bất biến).
    if (data.executionFrozenAt) await freezeSessionContributions(params.id);
    // D4 — ĐÔNG CỨNG doanh thu ghi nhận (idempotent; giá tại thời điểm giao dịch, KHÔNG dùng giá hiện hành).
    const rr = await freezeRecognizedRevenue(params.id);
    await auditLog({ userId: session.userId, action: "SESSION_COMPLETED", entityType: "TreatmentSession", entityId: params.id, changes: { frozenAt: (data.executionFrozenAt as any) ?? cur.performedAt, recognizedSource: rr.source } });
  }
  // D4 — hủy buổi ĐÃ ghi nhận → BÚT TOÁN ĐẢO (giữ số cũ, loại khỏi tổng).
  if (parsed.status === "CANCELLED" && cur.status !== "CANCELLED") {
    const rev = await reverseRecognizedRevenue(params.id, { reason: parsed.note?.trim() || "Hủy buổi sau ghi nhận", by: session.name });
    if (rev.reversed) await auditLog({ userId: session.userId, action: "SESSION_REVENUE_REVERSED", entityType: "TreatmentSession", entityId: params.id, changes: { reason: parsed.note?.trim() || "Hủy buổi" } });
  }

  // Ghi AUDIT khi sửa buổi đã hoàn thành: field nào đổi (trước/sau) + ai/khi/lý do (mục 29).
  if (wasCompleted) {
    const changes: { field: string; before: string; after: string }[] = [];
    for (const f of AUDIT_FIELDS) {
      if (!(f in parsed)) continue;
      const before = scalarStr((cur as any)[f]);
      const after = scalarStr((parsed as any)[f]);
      if (before !== after) changes.push({ field: f, before, after });
    }
    const log = Array.isArray(cur.editLog) ? (cur.editLog as any[]) : [];
    log.push({ by: session.name, at: new Date().toISOString(), reason: editReason!.trim(), changes });
    await prisma.treatmentSession.update({ where: { id: params.id }, data: { editLog: log as any } });
    await auditLog({
      userId: session.userId, action: "SESSION_EDIT_COMPLETED", entityType: "TreatmentSession",
      entityId: params.id, changes: { reason: editReason!.trim(), fields: changes.map((c) => c.field) },
    });
  }

  // Tự cập nhật trạng thái GIAI ĐOẠN khi buổi đổi trạng thái (mục 2 — xử lý khi đủ buổi):
  // đủ buổi hoàn thành → COMPLETED; có buổi hoàn thành → IN_PROGRESS. Tôn trọng CANCELLED thủ công.
  if (item.stageId) {
    try {
      const stage = await prisma.treatmentStage.findUnique({
        where: { id: item.stageId },
        select: { status: true, plannedSessions: true, sessions: { select: { status: true, performedAt: true } } },
      });
      if (stage) {
        const derived = deriveStageStatus(stage, stage.sessions);
        if (derived !== stage.status) {
          await prisma.treatmentStage.update({ where: { id: item.stageId }, data: { status: derived as any } });
        }
      }
    } catch {
      // không chặn ghi nhận buổi nếu cập nhật trạng thái giai đoạn lỗi
    }
  }

  // Tự tiến trạng thái PHÁC ĐỒ khi buổi bắt đầu/hoàn thành (tránh mâu thuẫn):
  // nếu phác đồ còn ở trạng thái tiền-thực-hiện (Bản nháp/Chờ duyệt/Đã duyệt) → nâng lên ĐANG THỰC HIỆN.
  if ((parsed.status === "COMPLETED" || parsed.status === "IN_PROGRESS") && item.planId) {
    try {
      const plan = await prisma.treatmentPlan.findUnique({ where: { id: item.planId }, select: { status: true } });
      if (plan && PRE_EXECUTION_PLAN_STATUSES.includes(plan.status as any)) {
        await prisma.treatmentPlan.update({ where: { id: item.planId }, data: { status: "ACTIVE" } });
      }
    } catch {
      // không chặn ghi nhận buổi nếu cập nhật trạng thái phác đồ lỗi
    }
  }
  return ok(item);
});
