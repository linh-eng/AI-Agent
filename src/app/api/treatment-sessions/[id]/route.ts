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
  // Tự đóng dấu thời điểm thực hiện khi chuyển sang COMPLETED mà chưa có performedAt
  if (parsed.status === "COMPLETED" && !parsed.performedAt) {
    const cur = await prisma.treatmentSession.findUnique({
      where: { id: params.id },
      select: { performedAt: true },
    });
    if (!cur?.performedAt) data.performedAt = new Date();
  }
  const item = await prisma.treatmentSession.update({ where: { id: params.id }, data });
  return ok(item);
});
