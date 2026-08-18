export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { branchUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.STAFF_READ);
  const b = await prisma.branch.findUnique({
    where: { id: params.id },
    include: { _count: { select: { employees: true } } },
  });
  if (!b) return fail(404, "Không tìm thấy chi nhánh");
  return ok({ ...b, employeeCount: b._count.employees });
});

// PATCH — sửa/bật-tắt chi nhánh. KHÔNG hard-delete (soft qua isActive) để tránh mồ côi branchId.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_WRITE);
  const parsed = branchUpdateSchema.parse(await req.json());
  const before = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!before) return fail(404, "Không tìm thấy chi nhánh");
  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.code !== undefined && parsed.code) data.code = parsed.code;
  if (parsed.timezone !== undefined) data.timezone = parsed.timezone;
  if (parsed.address !== undefined) data.address = parsed.address;
  if (parsed.note !== undefined) data.note = parsed.note;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
  const branch = await prisma.branch.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId, action: "BRANCH_UPDATED", entityType: "Branch", entityId: branch.id,
    changes: { fields: Object.keys(data), ...(parsed.isActive !== undefined && parsed.isActive !== before.isActive ? { isActive: { from: before.isActive, to: branch.isActive } } : {}) },
  });
  return ok(branch);
});
