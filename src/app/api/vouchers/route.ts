export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { voucherCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LOYALTY_READ);
  const p = new URL(req.url).searchParams;
  const where: any = {};
  if (p.get("customerId")) where.customerId = p.get("customerId");
  if (p.get("status")) where.status = p.get("status");
  const rows = await prisma.voucher.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 500, include: { _count: { select: { redemptions: true } } } });
  return ok(rows);
});
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.LOYALTY_WRITE);
  const input = voucherCreateSchema.parse(await req.json());
  const rec = await prisma.voucher.create({ data: {
    code: input.code, name: input.name, type: input.type, value: input.value as any,
    maxDiscount: input.maxDiscount ?? null, minSpend: input.minSpend ?? null, customerId: input.customerId ?? null,
    maxRedemptions: input.maxRedemptions ?? 1, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
  } });
  await auditLog({ userId: session.userId, action: "VOUCHER_CREATED", entityType: "Voucher", entityId: rec.id, changes: { code: input.code, type: input.type } });
  return created(rec);
});
