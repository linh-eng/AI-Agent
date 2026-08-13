export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance } from "@/lib/clinic";
import { deriveStageStatus } from "@/lib/treatment-plan";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const session = await getSession();
  const item = await prisma.treatmentSession.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { name: true } },
      plan: { select: { code: true, name: true } },
      customer: { select: { code: true, fullName: true } },
    },
  });
  if (!item) return fail(404, "Không tìm thấy buổi thực hiện");
  return ok(maskFinance(item, canSeeFinance(session), ["plannedCost", "actualCost"]));
});

// Ghi nhận thông số/vật tư/before-after/chi phí thực tế của buổi (mục 16, 17, 20)
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = sessionUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = { ...parsed };
  // Tự đóng dấu thời điểm thực hiện + ghim version phác đồ khi chuyển sang COMPLETED (mục 13, 19)
  if (parsed.status === "COMPLETED") {
    const cur = await prisma.treatmentSession.findUnique({
      where: { id: params.id },
      select: { performedAt: true, versionAtExecution: true, plan: { select: { version: true } } },
    });
    if (!parsed.performedAt && !cur?.performedAt) data.performedAt = new Date();
    // Ghim version thực hiện nếu chưa có — buổi đã hoàn thành thuộc đúng version tại thời điểm đó
    if (cur?.versionAtExecution == null) data.versionAtExecution = cur?.plan?.version ?? undefined;
  }
  const item = await prisma.treatmentSession.update({ where: { id: params.id }, data });

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
  return ok(item);
});
