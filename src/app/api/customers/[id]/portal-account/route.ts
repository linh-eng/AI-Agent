export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/clinic";

// Nhân viên cấp/đặt lại tài khoản Cổng khách cho một khách hàng.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  if (!email || password.length < 6) return fail(400, "Cần email và mật khẩu ≥ 6 ký tự");

  const customer = await prisma.customer.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!customer) return fail(404, "Không tìm thấy khách hàng");

  const passwordHash = await hashPassword(password);
  const account = await prisma.customerPortalAccount.upsert({
    where: { customerId: params.id },
    update: { email, passwordHash, isActive: true },
    create: { customerId: params.id, email, passwordHash },
  });
  await auditLog({ userId: session.userId, action: "PORTAL_ACCOUNT_SET", entityType: "Customer", entityId: params.id });
  return ok({ id: account.id, email: account.email });
});
