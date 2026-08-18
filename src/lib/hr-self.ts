// =============================================================================
// HR-PH1 — Nền "self-view": ánh xạ tài khoản đăng nhập ↔ hồ sơ Nhân sự CHỈ theo
// FK `Employee.userId` (1-1, tùy chọn). Dùng cho các phase sau (tự xem chấm công/
// KPI/lương của CHÍNH MÌNH — mục 9).
//
// NGUYÊN TẮC CỨNG:
//  * Identity theo FK userId — TUYỆT ĐỐI KHÔNG fallback khớp tên/email (chống mạo nhận).
//  * Không suy quyền RBAC từ liên kết này (Employee ≠ User, không merge vai trò).
//  * User chưa liên kết → không có self-context (trả null / false).
//  * self-view KHÔNG tương đương payroll.read (đó là quyền cấp tổ chức, khác phạm vi).
// =============================================================================
import { prisma } from "./prisma";
import type { SessionPayload } from "./auth";

type SessionLike = Pick<SessionPayload, "userId"> | null | undefined;

/** Hồ sơ Employee liên kết tài khoản đang đăng nhập (theo FK userId). null nếu chưa liên kết. */
export async function resolveSelfEmployee(session: SessionLike) {
  const userId = session?.userId;
  if (!userId) return null;
  return prisma.employee.findUnique({ where: { userId } });
}

/** Chỉ id (nhẹ) của Employee-self. null nếu chưa liên kết. */
export async function resolveSelfEmployeeId(session: SessionLike): Promise<string | null> {
  const userId = session?.userId;
  if (!userId) return null;
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  return emp?.id ?? null;
}

/** Employee `employeeId` có đúng là của người đang đăng nhập không (ownership FK). */
export async function isSelfEmployee(session: SessionLike, employeeId: string | null | undefined): Promise<boolean> {
  if (!employeeId) return false;
  const selfId = await resolveSelfEmployeeId(session);
  return selfId !== null && selfId === employeeId;
}
