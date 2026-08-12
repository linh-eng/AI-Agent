// =============================================================================
// P5 — Xác thực CUSTOMER PORTAL. TÁCH HOÀN TOÀN khỏi phiên nhân viên:
//   * Cookie riêng (thng_portal), payload chỉ chứa customerId.
//   * Không có bất kỳ quyền staff nào; mọi truy vấn portal scope theo customerId
//     lấy TỪ PHIÊN (không bao giờ tin customerId do client gửi) -> chống IDOR.
// =============================================================================
// LƯU Ý: file này phải EDGE-SAFE (dùng trong middleware) — KHÔNG import next/headers.
import { SignJWT, jwtVerify } from "jose";

export const PORTAL_COOKIE = "thng_portal";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");
const MAX_AGE = Number(process.env.PORTAL_SESSION_MAX_AGE ?? 60 * 60 * 24 * 7); // 7 ngày

export interface PortalSession {
  customerId: string;
  email: string;
}

export async function signPortalSession(payload: PortalSession): Promise<string> {
  return new SignJWT({ ...payload, scope: "portal" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifyPortalSession(token: string): Promise<PortalSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.scope !== "portal" || !payload.customerId) return null;
    return { customerId: String(payload.customerId), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export function portalCookieOptions(maxAge = MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
