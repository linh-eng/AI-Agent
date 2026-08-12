// =============================================================================
// Auth — JWT (jose, chạy được ở edge/middleware) + hash mật khẩu (bcrypt).
// Phiên đăng nhập lưu trong cookie httpOnly. Payload nhúng roles + permissions
// để middleware và server component kiểm quyền không cần truy vấn DB.
// =============================================================================
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "thng_session";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me"
);
const MAX_AGE = Number(process.env.SESSION_MAX_AGE ?? 60 * 60 * 8); // 8h mặc định

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  console.warn("[SECURITY] AUTH_SECRET (staff) chưa đặt trong production!");
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

// ----- Mật khẩu -----
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ----- JWT phiên -----
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      roles: (payload.roles as string[]) ?? [],
      permissions: (payload.permissions as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

/** Cấu hình cookie phiên (dùng khi set trong route handler). */
export function sessionCookieOptions(maxAge = MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Mặc định bật Secure ở production; đặt COOKIE_SECURE=false khi chạy HTTP LAN
    // nội bộ (không HTTPS) để trình duyệt vẫn gửi cookie.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
