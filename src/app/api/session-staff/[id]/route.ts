export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";

export const DELETE = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const existing = await prisma.sessionStaff.findUnique({ where: { id: params.id } });
  if (!existing) return fail(404, "Không tìm thấy phân công");
  await prisma.sessionStaff.delete({ where: { id: params.id } });
  await auditLog({
    userId: session.userId,
    action: "SESSION_STAFF_REMOVED",
    entityType: "SessionStaff",
    entityId: params.id,
    changes: { sessionId: existing.sessionId },
  });
  return ok({ id: params.id });
});
