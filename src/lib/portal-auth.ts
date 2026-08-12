// =============================================================================
// P5 — Xác thực CUSTOMER PORTAL. TÁCH HOÀN TOÀN khỏi phiên nhân viên:
//   * Cookie riêng (thng_portal), payload chỉ chứa customerId.
//   * Không có bất kỳ quyền staff nào; mọi truy vấn portal scope theo customerId
//     lấy TỪ PHIÊN (không bao giờ tin customerId do client gửi) -> chống IDOR.
// =============================================================================
// LƯU Ý: file này phải EDGE-SAFE (dùng trong middleware) — KHÔNG import next/headers.
import { SignJWT, jwtVerify } from "jose";

export const PORTAL_COOKIE = "thng_portal";

// Bí mật RIÊNG cho phiên khách — TÁCH khỏi staff (AUTH_SECRET). Nếu chưa cấu hình
// PORTAL_AUTH_SECRET, phái sinh một giá trị KHÁC staff (hậu tố ::portal) để chữ ký
// token staff không bao giờ verify được ở portal (và ngược lại), kể cả môi trường dev.
const PORTAL_SECRET_RAW =
  process.env.PORTAL_AUTH_SECRET ??
  `${process.env.AUTH_SECRET ?? "dev-secret-change-me"}::portal`;
const SECRET = new TextEncoder().encode(PORTAL_SECRET_RAW);
const MAX_AGE = Number(process.env.PORTAL_SESSION_MAX_AGE ?? 60 * 60 * 24 * 7); // 7 ngày

if (
  process.env.NODE_ENV === "production" &&
  !process.env.PORTAL_AUTH_SECRET &&
  !process.env.AUTH_SECRET
) {
  // Cảnh báo (không throw để tránh chặn edge middleware) — production PHẢI đặt secret.
  console.warn("[SECURITY] PORTAL_AUTH_SECRET/AUTH_SECRET chưa đặt trong production!");
}

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
