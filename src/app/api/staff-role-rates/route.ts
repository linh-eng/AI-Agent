export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { staffRoleRateCreateSchema } from "@/lib/clinic-validation";
import { nextRoleRateCode } from "@/lib/staff-role-rate";

const RATE_SENSITIVE = ["baseFee", "bonus", "tips", "commission", "commissionPercent"] as const;
function maskRate<T extends Record<string, any>>(r: T, canSee: boolean): T {
  if (canSee) return r;
  const c: Record<string, any> = { ...r };
  for (const f of RATE_SENSITIVE) if (f in c) c[f] = null;
  return c as T;
}

// GET /api/staff-role-rates?active=1 → bảng đơn giá vai trò. Số tiền mask theo finance.read.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const { searchParams } = new URL(req.url);
  const where = searchParams.get("active") === "1" ? { isActive: true } : {};
  const rows = await prisma.staffRoleRate.findMany({ where, orderBy: [{ isActive: "desc" }, { roleName: "asc" }] });
  return ok(rows.map((r) => maskRate(r as any, canSee)));
});

// POST /api/staff-role-rates → tạo đơn giá vai trò. Quyền: pricefloor.write.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const input = staffRoleRateCreateSchema.parse(await req.json());
  const code = input.code?.trim() || (await nextRoleRateCode());
  const rate = await prisma.staffRoleRate.create({
    data: {
      code,
      roleName: input.roleName,
      certified: input.certified ?? false,
      baseFee: input.baseFee ?? 0,
      bonus: input.bonus ?? 0,
      tips: input.tips ?? 0,
      commission: input.commission ?? 0,
      commissionPercent: input.commissionPercent ?? null,
      note: input.note ?? null,
      isActive: input.isActive ?? true,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "STAFF_ROLE_RATE_CREATED",
    entityType: "StaffRoleRate",
    entityId: rate.id,
    changes: { code: rate.code, roleName: rate.roleName, certified: rate.certified },
  });
  return created(maskRate(rate as any, canSee));
});
