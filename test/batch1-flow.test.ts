// =============================================================================
// BATCH 1 (Owner-approved) — bằng chứng từng FLOW. READ-mostly, minimal-fix.
//  FLOW-002 (D5): manualRecord bắt P2002 → 409 dễ hiểu; RBAC BOD có attendance.write,
//    CASHIER KHÔNG.
//  FLOW-004 (D3): employeeAvailability — APPROVED hard-block; PENDING chỉ cảnh báo
//    (pendingLeave=true, không chặn); REJECTED/CANCELLED → available.
//  FLOW-005 (D4 cash): /api/clinic/dashboard doanh thu = tiền thực thu (Payment chưa
//    hủy + Deposit ALLOCATED); LOẠI phiếu đã hủy.
//  FLOW-001 (D1): POST /api/treatment-sessions walk-in {bookingId} → session planId null
//    + bookingId set; GET booking trả session link.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/rbac";
import { employeeAvailability } from "@/lib/hr";
import { manualRecord } from "@/lib/attendance-service";
import { parseVnLocal } from "@/lib/timezone";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as dashboardRaw } from "@/app/api/clinic/dashboard/route";
import { POST as sessionCreateRaw } from "@/app/api/treatment-sessions/route";
import { GET as bookingGetRaw } from "@/app/api/bookings/[id]/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const data = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("b1")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id, name: user.name };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.71.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const dashboard = () => dashboardRaw(new Request("http://t/api/clinic/dashboard"), {} as any);
const sessionCreate = (b: unknown) => sessionCreateRaw(new Request("http://t/api/treatment-sessions", J(b)), {} as any);
const bookingGet = (id: string) => bookingGetRaw(new Request("http://t/api/bookings/" + id), { params: { id } } as any);

const mkEmp = () => prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV " + uniq("f"), status: "ACTIVE" } });
const mkCustomer = () => prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH " + uniq("c"), isActive: true } });

describe("BATCH 1 — bằng chứng FLOW", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  // ---- FLOW-002 (D5) ----
  it("FLOW-002 · manualRecord: bỏ trống Giờ ra 2 lần cùng nhân sự → 409 thông báo DỄ HIỂU (P2002 được bắt)", async () => {
    const mgr = await makeUser([PERMISSIONS.ATTENDANCE_WRITE]);
    const emp = await mkEmp();
    const sess: any = { userId: mgr.userId, name: mgr.name, email: mgr.email, roles: [], permissions: [PERMISSIONS.ATTENDANCE_WRITE] };
    const r1 = await manualRecord(sess, { employeeId: emp.id, checkInAt: "2026-08-20T08:00" });
    expect(r1.status).toBe("OPEN");
    await expect(manualRecord(sess, { employeeId: emp.id, checkInAt: "2026-08-20T09:00" }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining("MỞ") });
    // Nhập cả Giờ ra → COMPLETED (không dính OPEN unique) → tạo được.
    const r2 = await manualRecord(sess, { employeeId: emp.id, checkInAt: "2026-08-21T08:00", checkOutAt: "2026-08-21T17:00" });
    expect(r2.status).toBe("COMPLETED");
  });

  it("FLOW-002 · D5 RBAC: BOD có attendance.write; CASHIER KHÔNG; MANAGER có", () => {
    expect(ROLE_PERMISSIONS[ROLES.BOD]).toContain(PERMISSIONS.ATTENDANCE_WRITE);
    expect(ROLE_PERMISSIONS[ROLES.MANAGER]).toContain(PERMISSIONS.ATTENDANCE_WRITE);
    expect(ROLE_PERMISSIONS[ROLES.CASHIER]).not.toContain(PERMISSIONS.ATTENDANCE_WRITE);
    // BOD vẫn CHỈ ĐỌC lương (không mở payroll.write)
    expect(ROLE_PERMISSIONS[ROLES.BOD]).not.toContain(PERMISSIONS.PAYROLL_WRITE);
  });

  // ---- FLOW-004 (D3) ----
  it("FLOW-004 · availability: APPROVED hard-block; PENDING chỉ cảnh báo; REJECTED/CANCELLED available", async () => {
    const emp = await mkEmp(); // không có schedule → working=true
    const from = parseVnLocal("2026-09-01T09:00");
    const to = parseVnLocal("2026-09-01T10:00");
    const win = { fromAt: parseVnLocal("2026-09-01T00:00"), toAt: parseVnLocal("2026-09-02T00:00") };

    // Không có đơn nghỉ → available
    let av = await employeeAvailability(emp.id, from, to);
    expect(av.available).toBe(true);
    expect(av.onLeave).toBe(false);
    expect(av.pendingLeave).toBe(false);

    // PENDING → CẢNH BÁO, KHÔNG chặn
    const pend = await prisma.employeeLeave.create({ data: { employeeId: emp.id, type: "ANNUAL", status: "PENDING", ...win } });
    av = await employeeAvailability(emp.id, from, to);
    expect(av.pendingLeave).toBe(true);
    expect(av.onLeave).toBe(false);
    expect(av.available).toBe(true); // vẫn khả dụng

    // APPROVED → HARD-BLOCK
    await prisma.employeeLeave.update({ where: { id: pend.id }, data: { status: "APPROVED" } });
    av = await employeeAvailability(emp.id, from, to);
    expect(av.onLeave).toBe(true);
    expect(av.available).toBe(false);

    // REJECTED → available (không chặn, không cảnh báo)
    await prisma.employeeLeave.update({ where: { id: pend.id }, data: { status: "REJECTED" } });
    av = await employeeAvailability(emp.id, from, to);
    expect(av.available).toBe(true);
    expect(av.onLeave).toBe(false);
    expect(av.pendingLeave).toBe(false);

    // CANCELLED → available
    await prisma.employeeLeave.update({ where: { id: pend.id }, data: { status: "CANCELLED" } });
    av = await employeeAvailability(emp.id, from, to);
    expect(av.available).toBe(true);
    expect(av.onLeave).toBe(false);
  });

  // ---- FLOW-005 (D4 cash) ----
  it("FLOW-005 · dashboard doanh thu = tiền thực thu (Payment chưa hủy + Deposit ALLOCATED); LOẠI phiếu đã hủy", async () => {
    const fin = await makeUser([PERMISSIONS.BOOKING_READ, PERMISSIONS.FINANCE_READ]);
    const c = await mkCustomer();
    const now = new Date();
    // Payment hợp lệ 1.000.000 (tháng này) + Payment ĐÃ HỦY 500.000 (không tính) + Deposit ALLOCATED 300.000.
    await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, amount: 1_000_000, method: "CASH", paidAt: now } });
    await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, amount: 500_000, method: "CASH", paidAt: now, voidedAt: now, voidReason: "thu nhầm" } });
    await prisma.deposit.create({ data: { code: uniq("DC"), customerId: c.id, amount: 300_000, method: "CASH", status: "ALLOCATED", allocatedAt: now } });

    await login(fin.email);
    const d = await data(await dashboard());
    // 1.000.000 (payment hợp lệ) + 300.000 (deposit allocated) = 1.300.000; KHÔNG gồm 500.000 đã hủy.
    expect(d.revenue).toBe(1_300_000);
    expect(d.canSeeFinance).toBe(true);
  });

  it("FLOW-005 · non-finance → revenue = null (mask server, không lộ)", async () => {
    const u = await makeUser([PERMISSIONS.BOOKING_READ]);
    const c = await mkCustomer();
    await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, amount: 1_000_000, method: "CASH", paidAt: new Date() } });
    await login(u.email);
    const d = await data(await dashboard());
    expect(d.revenue).toBeNull();
    expect(d.revenueSeries).toBeNull();
  });

  // ---- FLOW-001 (D1) ----
  it("FLOW-001 · walk-in: POST session {bookingId} → planId null + bookingId set; GET booking trả session", async () => {
    const u = await makeUser([PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.BOOKING_READ]);
    const c = await mkCustomer();
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: new Date(), status: "IN_PROGRESS", durationMinutes: 60 } });
    await login(u.email);
    const s = await data(await sessionCreate({ bookingId: bk.id, customerId: c.id, status: "IN_PROGRESS", scheduledAt: new Date().toISOString() }));
    expect(s.planId).toBeNull();
    expect(s.bookingId).toBe(bk.id);
    expect(s.customerId).toBe(c.id);
    // GET booking → có link session (dùng để hiện nút "Xem lần thực hiện").
    const b = await data(await bookingGet(bk.id));
    expect(b.session?.id).toBe(s.id);
  });
});
