// =============================================================================
// Server-side helper cho phiên CỔNG KHÁCH (dùng next/headers — chỉ chạy server,
// KHÔNG dùng trong middleware edge).
// =============================================================================
import { cookies } from "next/headers";
import { HttpError } from "./session";
import { PORTAL_COOKIE, verifyPortalSession, type PortalSession } from "./portal-auth";

export async function getPortalSession(): Promise<PortalSession | null> {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  return verifyPortalSession(token);
}

/** Bắt buộc có phiên portal — ném 401. customerId trả về là ĐÁNG TIN (từ phiên). */
export async function requirePortal(): Promise<PortalSession> {
  const s = await getPortalSession();
  if (!s) throw new HttpError(401, "Chưa đăng nhập cổng khách hàng");
  return s;
}
