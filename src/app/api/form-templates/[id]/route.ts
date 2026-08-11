export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { formTemplateUpdateSchema } from "@/lib/library-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const template = await prisma.formTemplate.findUnique({ where: { id: params.id } });
  if (!template) return fail(404, "Không tìm thấy biểu mẫu");
  return ok(template);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.FORM_WRITE);
  const parsed = formTemplateUpdateSchema.parse(await req.json());
  const { bumpVersion, changeReason, changedBy, status, schema, ...rest } = parsed;

  const current = await prisma.formTemplate.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy biểu mẫu");

  if (status && (status === "APPROVED" || status === "ACTIVE")) {
    await requirePermission(PERMISSIONS.PROTOCOL_APPROVE);
  }

  const data: Record<string, unknown> = { ...rest };
  if (schema !== undefined) data.schema = schema as any;
  if (status) data.status = status;

  if (bumpVersion) {
    const log = Array.isArray(current.changeLog) ? (current.changeLog as any[]) : [];
    log.push({
      fromVersion: current.version,
      toVersion: current.version + 1,
      reason: changeReason ?? null,
      changedBy: changedBy ?? session.name,
      at: new Date().toISOString(),
    });
    data.version = current.version + 1;
    data.changeLog = log as any;
  }

  const template = await prisma.formTemplate.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: bumpVersion ? "VERSION_BUMP" : status ? "STATUS_CHANGE" : "UPDATE",
    entityType: "FormTemplate",
    entityId: template.id,
    changes: { version: template.version, status: template.status },
  });
  return ok(template);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.FORM_WRITE);
  const t = await prisma.formTemplate.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: t.id, isActive: t.isActive });
});
