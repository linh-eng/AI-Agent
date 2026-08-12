// =============================================================================
// SEC1 — Rate limit / progressive lockout cho đăng nhập.
//
// Thiết kế:
//   * Trạng thái lưu trong DB (bảng auth_throttles) -> ĐÚNG trên nhiều instance /
//     serverless (không dùng bộ nhớ tiến trình).
//   * Đếm thất bại theo NHIỀU key: theo IP và theo account identifier.
//   * Khóa TẠM THỜI lũy tiến theo số lần thất bại; KHÔNG khóa vĩnh viễn.
//   * Áp dụng cho identifier bất kể account có tồn tại hay không -> không lộ sự tồn tại.
//   * KHÔNG log mật khẩu/bí mật; ghi audit khi vượt ngưỡng.
//
// Ngưỡng (mỗi cửa sổ WINDOW): 5→1', 8→5', 11→15', 15+→60' (cap). Reset khi đăng
// nhập thành công hoặc hết cửa sổ.
// =============================================================================
import { prisma } from "./prisma";

const WINDOW_MS = Number(process.env.LOGIN_THROTTLE_WINDOW_MS ?? 15 * 60 * 1000); // 15 phút
const MAX_LOCK_MS = 60 * 60 * 1000; // trần 60 phút

/** Bậc khóa: [số lần thất bại tối thiểu, thời gian khóa ms]. */
const LOCK_STEPS: [number, number][] = [
  [15, 60 * 60 * 1000],
  [11, 15 * 60 * 1000],
  [8, 5 * 60 * 1000],
  [5, 60 * 1000],
];

function lockMsFor(failures: number): number {
  for (const [threshold, ms] of LOCK_STEPS) {
    if (failures >= threshold) return Math.min(ms, MAX_LOCK_MS);
  }
  return 0;
}

export interface ThrottleResult {
  locked: boolean;
  retryAfterSec: number;
}

/** Lấy IP client an toàn từ header proxy. */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Kiểm tra xem có key nào đang bị khóa không (đọc-only, không tăng bộ đếm). */
export async function checkThrottle(keys: string[]): Promise<ThrottleResult> {
  const now = new Date();
  const rows = await prisma.authThrottle.findMany({
    where: { key: { in: keys }, lockedUntil: { gt: now } },
    select: { lockedUntil: true },
  });
  if (!rows.length) return { locked: false, retryAfterSec: 0 };
  const maxUntil = rows.reduce((m, r) => Math.max(m, r.lockedUntil!.getTime()), 0);
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((maxUntil - now.getTime()) / 1000)) };
}

/** Ghi nhận 1 lần đăng nhập THẤT BẠI cho các key; trả về trạng thái khóa mới. */
export async function recordFailure(keys: string[], auditLabel?: string): Promise<ThrottleResult> {
  const now = new Date();
  let maxLockUntil = 0;
  for (const key of keys) {
    const existing = await prisma.authThrottle.findUnique({ where: { key } });
    let failures = 1;
    let firstFailAt = now;
    if (existing) {
      const withinWindow = now.getTime() - existing.firstFailAt.getTime() < WINDOW_MS;
      failures = withinWindow ? existing.failures + 1 : 1;
      firstFailAt = withinWindow ? existing.firstFailAt : now;
    }
    const lockMs = lockMsFor(failures);
    const lockedUntil = lockMs > 0 ? new Date(now.getTime() + lockMs) : existing?.lockedUntil ?? null;
    if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
      maxLockUntil = Math.max(maxLockUntil, lockedUntil.getTime());
    }
    await prisma.authThrottle.upsert({
      where: { key },
      update: { failures, firstFailAt, lockedUntil },
      create: { key, failures, firstFailAt, lockedUntil },
    });
    // Ghi audit khi bắt đầu khóa (không log mật khẩu).
    if (lockMs > 0 && (!existing?.lockedUntil || existing.lockedUntil.getTime() <= now.getTime())) {
      await prisma.auditLog.create({
        data: { action: "LOGIN_THROTTLED", entityType: "AuthThrottle", entityId: key, changes: { failures, label: auditLabel ?? null } },
      }).catch(() => {});
    }
  }
  return maxLockUntil > 0
    ? { locked: true, retryAfterSec: Math.max(1, Math.ceil((maxLockUntil - now.getTime()) / 1000)) }
    : { locked: false, retryAfterSec: 0 };
}

/** Đăng nhập THÀNH CÔNG -> xóa bộ đếm cho các key. */
export async function recordSuccess(keys: string[]): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { key: { in: keys } } });
}
