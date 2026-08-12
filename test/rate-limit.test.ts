import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkThrottle, recordFailure, recordSuccess, getClientIp } from "@/lib/rate-limit";
import { resetDb, uniq } from "./helpers";

describe("SEC1 — rate limit / progressive lockout", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("khóa tạm thời sau nhiều lần thất bại (không khóa từ đầu)", async () => {
    const key = `staff:acct:${uniq("e")}@x.com`;
    // 4 lần đầu chưa khóa
    for (let i = 0; i < 4; i++) {
      const r = await recordFailure([key]);
      expect(r.locked).toBe(false);
    }
    // lần thứ 5 -> khóa
    const r5 = await recordFailure([key]);
    expect(r5.locked).toBe(true);
    expect(r5.retryAfterSec).toBeGreaterThan(0);

    const check = await checkThrottle([key]);
    expect(check.locked).toBe(true);
  });

  it("khóa lũy tiến: nhiều thất bại hơn -> khóa lâu hơn, có trần (không vĩnh viễn)", async () => {
    const key = `staff:acct:${uniq("e")}@x.com`;
    for (let i = 0; i < 5; i++) await recordFailure([key]);
    const at5 = (await prisma.authThrottle.findUnique({ where: { key } }))!.lockedUntil!.getTime();
    for (let i = 0; i < 10; i++) await recordFailure([key]); // tổng 15
    const at15 = (await prisma.authThrottle.findUnique({ where: { key } }))!.lockedUntil!.getTime();
    expect(at15).toBeGreaterThan(at5); // khóa lâu hơn
    // Không vĩnh viễn: lockedUntil hữu hạn trong tương lai gần (<= 60' + biên)
    expect(at15 - Date.now()).toBeLessThanOrEqual(61 * 60 * 1000);
  });

  it("đăng nhập thành công xóa bộ đếm", async () => {
    const key = `portal:acct:${uniq("e")}@x.com`;
    for (let i = 0; i < 5; i++) await recordFailure([key]);
    expect((await checkThrottle([key])).locked).toBe(true);
    await recordSuccess([key]);
    expect((await checkThrottle([key])).locked).toBe(false);
    expect(await prisma.authThrottle.findUnique({ where: { key } })).toBeNull();
  });

  it("ghi audit khi bắt đầu khóa (không lưu mật khẩu)", async () => {
    const key = `staff:acct:${uniq("e")}@x.com`;
    for (let i = 0; i < 5; i++) await recordFailure([key], "staff-login");
    const logs = await prisma.auditLog.findMany({ where: { action: "LOGIN_THROTTLED" } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(logs)).not.toMatch(/password|passwordHash/i);
  });

  it("getClientIp đọc x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("203.0.113.9");
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});
