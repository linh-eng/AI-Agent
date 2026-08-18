export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

// GET — sự kiện thu nhập. compensationPolicy.read → toàn tổ chức (lọc). Không có
// → CHỈ của chính mình (self FK). Ngược lại 403. finance.read KHÔNG cấp quyền.
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const canRead = session.permissions.includes(PERMISSIONS.COMPENSATION_POLICY_READ) || session.permissions.includes(PERMISSIONS.COMMISSION_READ);
  const p = new URL(req.url).searchParams;
  const where: any = {};
  if (p.get("eventType")) where.eventType = p.get("eventType");
  if (p.get("status")) where.status = p.get("status");
  if (p.get("sourceType")) where.sourceType = p.get("sourceType");
  if (p.get("sourceId")) where.sourceId = p.get("sourceId");
  if (canRead) {
    if (p.get("employeeId")) where.employeeId = p.get("employeeId");
  } else {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId) return fail(403, "Không có quyền xem sự kiện thu nhập");
    where.employeeId = selfId; // scope cứng theo self
  }
  const rows = await prisma.compensationEvent.findMany({ where, include: { employee: { select: { code: true, fullName: true } } }, orderBy: [{ eventDate: "desc" }], take: 2000 });
  return ok(rows);
});
