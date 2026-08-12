export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { signPortalSession, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { checkThrottle, recordFailure, recordSuccess, getClientIp } from "@/lib/rate-limit";

export const POST = handle(async (req) => {
  const { email, password } = await req.json();
  if (!email || !password) return fail(400, "Thiếu email/mật khẩu");
  const emailNorm = String(email).toLowerCase();
  const ip = getClientIp(req);
  const keys = [`portal:ip:${ip}`, `portal:acct:${emailNorm}`];

  const throttled = await checkThrottle(keys);
  if (throttled.locked) {
    return fail(429, `Quá nhiều lần thử. Vui lòng thử lại sau ${throttled.retryAfterSec}s`);
  }

  const account = await prisma.customerPortalAccount.findUnique({
    where: { email: emailNorm },
    include: { customer: { select: { isActive: true, fullName: true } } },
  });
  // Thông báo lỗi chung để không lộ email nào tồn tại + ghi nhận thất bại.
  const invalid = async () => {
    await recordFailure(keys, "portal-login");
    return fail(401, "Email hoặc mật khẩu không đúng");
  };
  if (!account || !account.isActive || !account.customer.isActive) return invalid();
  const okPass = await verifyPassword(String(password), account.passwordHash);
  if (!okPass) return invalid();

  await recordSuccess(keys);

  const token = await signPortalSession({ customerId: account.customerId, email: account.email });
  cookies().set(PORTAL_COOKIE, token, portalCookieOptions());
  await prisma.customerPortalAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

  return ok({ fullName: account.customer.fullName });
});
