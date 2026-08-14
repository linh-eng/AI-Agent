export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { certificationCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_ROLE_MANAGE);
  const parsed = certificationCreateSchema.parse(await req.json());
  const row = await prisma.employeeCertification.create({
    data: { employeeId: params.id, name: parsed.name, issuer: parsed.issuer ?? null, issuedAt: parsed.issuedAt ?? null, expiresAt: parsed.expiresAt ?? null, mediaId: parsed.mediaId ?? null, note: parsed.note ?? null },
  });
  await auditLog({ userId: session.userId, action: "STAFF_CERT_ADDED", entityType: "Employee", entityId: params.id, changes: { name: parsed.name } });
  return created(row);
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_ROLE_MANAGE);
  const certId = new URL(req.url).searchParams.get("certId");
  if (!certId) return fail(400, "Thiếu certId");
  const row = await prisma.employeeCertification.findFirst({ where: { id: certId, employeeId: params.id } });
  if (!row) return fail(404, "Không tìm thấy chứng nhận");
  await prisma.employeeCertification.delete({ where: { id: certId } });
  await auditLog({ userId: session.userId, action: "STAFF_CERT_REMOVED", entityType: "Employee", entityId: params.id, changes: { name: row.name } });
  return ok({ ok: true });
});
