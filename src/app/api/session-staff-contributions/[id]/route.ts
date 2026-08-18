export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { contributionUpdateSchema } from "@/lib/clinic-validation";
import { updateDraftContribution } from "@/lib/contribution-service";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

export const GET = handle(async (_req, { params }) => {
  const session = await requireAuth();
  const rec = await prisma.sessionStaffContribution.findUnique({ where: { id: params.id }, include: { employee: { select: { code: true, fullName: true } } } });
  if (!rec) return fail(404, "Không tìm thấy đóng góp");
  if (!session.permissions.includes(PERMISSIONS.TREATMENT_READ)) {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId || rec.employeeId !== selfId) return fail(404, "Không tìm thấy đóng góp"); // không lộ tồn tại
  }
  return ok(rec);
});

// PATCH — sửa DRAFT (treatment.write). ACTIVE/frozen → 409 (dùng reverse).
export const PATCH = handle(async (req, { params }) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.TREATMENT_WRITE);
  const patch = contributionUpdateSchema.parse(await req.json());
  const rec = await updateDraftContribution(session, params.id, patch as any, canWrite);
  return ok(rec);
});
