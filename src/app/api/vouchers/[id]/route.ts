export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";

// POST — void voucher (không hard-delete).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.LOYALTY_WRITE);
  const v = await prisma.voucher.findUnique({ where: { id: params.id } });
  if (!v) return fail(404, "Không tìm thấy voucher");
  await prisma.voucher.update({ where: { id: params.id }, data: { status: "VOID" } });
  await auditLog({ userId: session.userId, action: "VOUCHER_VOIDED", entityType: "Voucher", entityId: params.id, changes: {} });
  return ok({ voided: true });
});
