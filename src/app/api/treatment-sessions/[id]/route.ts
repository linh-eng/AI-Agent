export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance } from "@/lib/clinic";

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
  return ok(item);
});
