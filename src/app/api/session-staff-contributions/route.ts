export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { contributionCreateSchema } from "@/lib/clinic-validation";
import { createContribution } from "@/lib/contribution-service";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

// GET — treatment.read xem tất cả; nếu không → chỉ đóng góp của CHÍNH MÌNH (self FK); else 403.
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const canRead = session.permissions.includes(PERMISSIONS.TREATMENT_READ);
  const p = new URL(req.url).searchParams;
  const where: any = {
    ...(p.get("treatmentSessionId") ? { treatmentSessionId: p.get("treatmentSessionId") } : {}),
    ...(p.get("sessionExecutionItemId") ? { sessionExecutionItemId: p.get("sessionExecutionItemId") } : {}),
    ...(p.get("employeeId") ? { employeeId: p.get("employeeId") } : {}),
    ...(p.get("status") ? { status: p.get("status") as any } : {}),
    ...(p.get("contributionTypeCode") ? { contributionTypeCode: p.get("contributionTypeCode") } : {}),
  };
  if (!canRead) {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId) return fail(403, "Không có quyền xem đóng góp");
    where.employeeId = selfId; // scope cứng theo self
  }
  const rows = await prisma.sessionStaffContribution.findMany({
    where,
    include: { employee: { select: { code: true, fullName: true } }, session: { select: { code: true, customerId: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 1000,
  });
  return ok(rows);
});

// POST — tạo đóng góp (treatment.write; buổi đã freeze cần treatment.editCompleted).
export const POST = handle(async (req) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.TREATMENT_WRITE);
  const canEdit = session.permissions.includes(PERMISSIONS.TREATMENT_EDIT_COMPLETED);
  const input = contributionCreateSchema.parse(await req.json());
  const rec = await createContribution(session, input, canWrite, canEdit);
  return created(rec);
});
