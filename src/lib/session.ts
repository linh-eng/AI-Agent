// =============================================================================
// Session server-side — đọc cookie phiên trong Server Component / Route Handler.
// Tách khỏi auth.ts vì phụ thuộc next/headers (chỉ chạy server).
// =============================================================================
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./auth";
import type { PermissionCode } from "./rbac";

/** Lấy phiên hiện tại (null nếu chưa đăng nhập / token hỏng). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Lỗi có kèm HTTP status để route handler trả về đúng mã. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bắt buộc đã đăng nhập — ném 401 nếu chưa. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Chưa đăng nhập");
  return session;
}

/** Bắt buộc có quyền cụ thể — ném 401/403. */
export async function requirePermission(
  permission: PermissionCode
): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!session.permissions.includes(permission)) {
    throw new HttpError(403, `Không có quyền: ${permission}`);
  }
  return session;
}

export function hasPermission(
  session: SessionPayload | null,
  permission: PermissionCode
): boolean {
  return !!session?.permissions.includes(permission);
}
