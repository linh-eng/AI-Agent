export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { membershipTierSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async () => {
  await requireAuth();
  const rows = await prisma.membershipTier.findMany({ orderBy: [{ sortOrder: "asc" }, { minLifetimeSpend: "asc" }] });
  return ok(rows);
});
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.LOYALTY_WRITE);
  const input = membershipTierSchema.parse(await req.json());
  const rec = await prisma.membershipTier.create({ data: {
    code: input.code, name: input.name, minLifetimeSpend: (input.minLifetimeSpend ?? 0) as any,
    pointsPerThousand: (input.pointsPerThousand ?? 1) as any, discountPercent: (input.discountPercent ?? 0) as any,
    sortOrder: input.sortOrder ?? 0, isActive: input.isActive ?? true,
  } });
  await auditLog({ userId: session.userId, action: "MEMBERSHIP_TIER_CREATED", entityType: "MembershipTier", entityId: rec.id, changes: { code: input.code } });
  return created(rec);
});
