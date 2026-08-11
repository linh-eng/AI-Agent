export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { careInstructionUpdateSchema } from "@/lib/ext-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const item = await prisma.careInstruction.findUnique({ where: { id: params.id } });
  if (!item) return fail(404, "Không tìm thấy hướng dẫn");
  return ok(item);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.CARE_WRITE);
  const parsed = careInstructionUpdateSchema.parse(await req.json());
  const { bumpVersion, changeReason, status, updatedBy, ...rest } = parsed;

  const current = await prisma.careInstruction.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy hướng dẫn");
  if (status && (status === "APPROVED" || status === "ACTIVE")) {
    await requirePermission(PERMISSIONS.PROTOCOL_APPROVE);
  }

  const data: Record<string, unknown> = { ...rest, updatedBy: updatedBy ?? session.name };
  if (status) data.status = status;
  if (bumpVersion) {
    const log = Array.isArray(current.changeLog) ? (current.changeLog as any[]) : [];
    log.push({ fromVersion: current.version, toVersion: current.version + 1, reason: changeReason ?? null, changedBy: session.name, at: new Date().toISOString() });
    data.version = current.version + 1;
    data.changeLog = log as any;
  }
  const item = await prisma.careInstruction.update({ where: { id: params.id }, data });
  await auditLog({ userId: session.userId, action: bumpVersion ? "VERSION_BUMP" : "UPDATE", entityType: "CareInstruction", entityId: item.id, changes: { version: item.version, status: item.status } });
  return ok(item);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CARE_WRITE);
  const item = await prisma.careInstruction.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: item.id, isActive: item.isActive });
});
