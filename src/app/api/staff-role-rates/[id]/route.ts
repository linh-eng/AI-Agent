export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { staffRoleRateUpdateSchema } from "@/lib/clinic-validation";

const RATE_SENSITIVE = ["baseFee", "bonus", "tips", "commission", "commissionPercent"] as const;
function maskRate<T extends Record<string, any>>(r: T, canSee: boolean): T {
  if (canSee) return r;
  const c: Record<string, any> = { ...r };
  for (const f of RATE_SENSITIVE) if (f in c) c[f] = null;
  return c as T;
}

// PATCH /api/staff-role-rates/[id] → sửa đơn giá/bật-tắt (KHÔNG hard-delete). Quyền: pricefloor.write.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const patch = staffRoleRateUpdateSchema.parse(await req.json());
  const existing = await prisma.staffRoleRate.findUnique({ where: { id: params.id } });
  if (!existing) return fail(404, "Không tìm thấy đơn giá vai trò");
  const rate = await prisma.staffRoleRate.update({
    where: { id: params.id },
    data: {
      ...(patch.roleName !== undefined ? { roleName: patch.roleName } : {}),
      ...(patch.certified !== undefined ? { certified: patch.certified } : {}),
      ...(patch.baseFee !== undefined ? { baseFee: patch.baseFee } : {}),
      ...(patch.bonus !== undefined ? { bonus: patch.bonus } : {}),
      ...(patch.tips !== undefined ? { tips: patch.tips } : {}),
      ...(patch.commission !== undefined ? { commission: patch.commission } : {}),
      ...(patch.commissionPercent !== undefined ? { commissionPercent: patch.commissionPercent } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
  });
  await auditLog({
    userId: session.userId,
    action: "STAFF_ROLE_RATE_UPDATED",
    entityType: "StaffRoleRate",
    entityId: rate.id,
    changes: { code: rate.code, isActive: rate.isActive },
  });
  return ok(maskRate(rate as any, canSee));
});
