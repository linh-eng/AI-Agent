// =============================================================================
// Quyền BỔ SUNG cấp riêng cho tài khoản (ngoài vai trò). Danh sách được phép cấp
// = mọi quyền hợp lệ TRỪ user.manage (giữ trục an ninh "quản trị user chỉ Admin").
// =============================================================================
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/rbac";

export const GRANTABLE_EXTRA_PERMISSIONS = new Set<string>(
  ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.USER_MANAGE),
);

/** Lọc danh sách quyền bổ sung: bỏ trùng + bỏ quyền lạ / user.manage. */
export function sanitizeExtra(list?: string[]): string[] {
  return Array.from(new Set((list ?? []).filter((p) => GRANTABLE_EXTRA_PERMISSIONS.has(p))));
}
