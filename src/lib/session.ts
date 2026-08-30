// =============================================================================
// Session server-side — đọc cookie phiên trong Server Component / Route Handler.
// Tách khỏi auth.ts vì phụ thuộc next/headers (chỉ chạy server).
// =============================================================================
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./auth";
import { ROLE_PERMISSIONS, type PermissionCode, type RoleCode } from "./rbac";

/**
 * Tính lại quyền TỪ VAI TRÒ (mã nguồn = nguồn sự thật) ở MỖI request.
 *
 * Lý do: JWT phiên nhúng sẵn `permissions` lúc đăng nhập. Khi cập nhật code
 * (thêm quyền mới cho vai trò), token cũ vẫn giữ danh sách quyền cũ → người dùng
 * đang đăng nhập KHÔNG thấy quyền mới cho tới khi đăng xuất/đăng nhập lại.
 * Bằng cách suy quyền lại từ `roles` (không đổi) qua `ROLE_PERMISSIONS`, quyền
 * luôn khớp code ngay lập tức — không cần đăng nhập lại. Vẫn hợp nhất (union)
 * với quyền trong token để giữ quyền cấp riêng cho vai trò lạ (không có trong code).
 */
function recomputePermissions(session: SessionPayload): SessionPayload {
  const permSet = new Set<string>();
  for (const code of session.roles ?? []) {
    const fromCode = ROLE_PERMISSIONS[code as RoleCode];
    if (fromCode) fromCode.forEach((p) => permSet.add(p));
  }
  // Hợp nhất quyền có sẵn trong token (fallback cho vai trò không nằm trong code).
  (session.permissions ?? []).forEach((p) => permSet.add(p));
  // Quyền BỔ SUNG cấp riêng cho tài khoản (ngoài vai trò).
  (session.extraPermissions ?? []).forEach((p) => permSet.add(p));
  return { ...session, permissions: Array.from(permSet) };
}

/** Lấy phiên hiện tại (null nếu chưa đăng nhập / token hỏng). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  return recomputePermissions(session);
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
