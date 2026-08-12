export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { signPortalSession, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";

export const POST = handle(async (req) => {
  const { email, password } = await req.json();
  if (!email || !password) return fail(400, "Thiếu email/mật khẩu");

  const account = await prisma.customerPortalAccount.findUnique({
    where: { email: String(email).toLowerCase() },
    include: { customer: { select: { isActive: true, fullName: true } } },
  });
  // Thông báo lỗi chung để không lộ email nào tồn tại.
  const invalid = () => fail(401, "Email hoặc mật khẩu không đúng");
  if (!account || !account.isActive || !account.customer.isActive) return invalid();
  const okPass = await verifyPassword(String(password), account.passwordHash);
  if (!okPass) return invalid();

  const token = await signPortalSession({ customerId: account.customerId, email: account.email });
  cookies().set(PORTAL_COOKIE, token, portalCookieOptions());
  await prisma.customerPortalAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

  return ok({ fullName: account.customer.fullName });
});
