export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { competenceCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_ROLE_MANAGE);
  const parsed = competenceCreateSchema.parse(await req.json());
  const row = await prisma.employeeCompetence.create({
    data: { employeeId: params.id, kind: parsed.kind, refId: parsed.refId ?? null, name: parsed.name, note: parsed.note ?? null },
  });
  await auditLog({ userId: session.userId, action: "STAFF_COMPETENCE_ADDED", entityType: "Employee", entityId: params.id, changes: { kind: parsed.kind, name: parsed.name } });
  return created(row);
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_ROLE_MANAGE);
  const cid = new URL(req.url).searchParams.get("cid");
  if (!cid) return fail(400, "Thiếu cid");
  const row = await prisma.employeeCompetence.findFirst({ where: { id: cid, employeeId: params.id } });
  if (!row) return fail(404, "Không tìm thấy năng lực");
  await prisma.employeeCompetence.delete({ where: { id: cid } });
  await auditLog({ userId: session.userId, action: "STAFF_COMPETENCE_REMOVED", entityType: "Employee", entityId: params.id, changes: { name: row.name } });
  return ok({ ok: true });
});
