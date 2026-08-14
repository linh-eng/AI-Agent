// =============================================================================
// Mục 8 — 6 BẰNG CHỨNG CUỐI: timezone nghỉ phép (Asia/Ho_Chi_Minh), Booking chặn
// trong giờ nghỉ / ngoài giờ làm, lọc năng lực HIFU, fee snapshot 500k→600k theo
// hiệu lực, mask phí theo RBAC, audit đổi phí. Không phụ thuộc TZ tiến trình.
// =============================================================================
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); }, delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { parseVnLocal, vnClock } from "@/lib/timezone";
import { formatDateTime } from "@/lib/utils";
import { employeeAvailability, suggestEmployeesForBooking, resolveRoleFee } from "@/lib/hr";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as getEmployee } from "@/app/api/employees/[id]/route";
import { POST as addLeave } from "@/app/api/employees/[id]/leaves/route";

function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase(); const password = "matkhau123";
  const user = await prisma.user.create({ data: { email, name: "NV " + uniq("n"), passwordHash: await hashPassword(password) } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, password };
}
async function login(email: string, password: string) { jar.clear(); await staffLogin(jsonReq("http://t/api/auth/login", "POST", { email, password }), {}); return jar.get(SESSION_COOKIE); }
async function emp(over: Record<string, any> = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV " + uniq("x"), status: "ACTIVE", ...over } });
}

describe("Mục 8 — A. Timezone nghỉ phép (giờ VN, ổn định bất kể TZ tiến trình)", () => {
  it("parseVnLocal: nhập 20/08/2026 08:00 (giờ VN) → lưu true-UTC 01:00Z", () => {
    const d = parseVnLocal("2026-08-20T08:00");
    expect(d.toISOString()).toBe("2026-08-20T01:00:00.000Z"); // 08:00 VN = 01:00 UTC
    // chuỗi đã có Z / ±hh:mm → tôn trọng nguyên trạng (true instant)
    expect(parseVnLocal("2026-08-20T01:00:00Z").toISOString()).toBe("2026-08-20T01:00:00.000Z");
    // date-only giữ nguyên (UTC 00:00)
    expect(parseVnLocal("1990-01-15").toISOString()).toBe("1990-01-15T00:00:00.000Z");
  });

  it("formatDateTime: instant 01:00Z (=08:00 VN) hiển thị ĐÚNG 08:00 Asia/Ho_Chi_Minh", () => {
    // DB lưu true-UTC; record nghỉ 08:00–12:00 VN = 01:00Z–05:00Z.
    const from = new Date("2026-08-20T01:00:00.000Z");
    const to = new Date("2026-08-20T05:00:00.000Z");
    expect(formatDateTime(from)).toContain("08:00");
    expect(formatDateTime(from)).toContain("20/08/2026");
    expect(formatDateTime(to)).toContain("12:00");
    // KHÔNG render UTC thô (01:00 / 05:00)
    expect(formatDateTime(from)).not.toContain("01:00");
    expect(formatDateTime(to)).not.toContain("05:00");
    // Round-trip qua input người dùng: parseVnLocal(08:00 VN) rồi format lại = 08:00.
    expect(formatDateTime(parseVnLocal("2026-08-20T08:00"))).toContain("08:00");
  });

  it("vnClock: convert true-UTC → wall-clock VN (Asia/Ho_Chi_Minh, +7)", () => {
    const c = vnClock(new Date("2026-08-20T02:30:00Z")); // 02:30 UTC = 09:30 VN
    expect(c.hour).toBe(9); expect(c.minute).toBe(30);
    expect(c.year).toBe(2026); expect(c.month).toBe(8); expect(c.day).toBe(20);
  });
});

// 2026-08-20 là Thứ 5 (dayOfWeek=4). Nhân sự làm T2–T6 (1..5) + nghỉ 08:00–12:00.
async function phamChuyenVien() {
  const e = await emp({ fullName: "Phạm Chuyên Viên " + uniq("p"), roles: ["Kỹ thuật viên"] });
  await prisma.employeeSchedule.createMany({ data: [1, 2, 3, 4, 5].map((d) => ({ employeeId: e.id, dayOfWeek: d, startTime: "08:00", endTime: "17:00" })) });
  await prisma.employeeLeave.create({ data: { employeeId: e.id, type: "ANNUAL", fromAt: parseVnLocal("2026-08-20T08:00"), toAt: parseVnLocal("2026-08-20T12:00"), reason: "Nghỉ buổi sáng" } });
  return e;
}

describe("Mục 8 — A2. MỘT record nghỉ phép hiển thị GIỐNG NHAU: DB → API → Hồ sơ → Availability", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("nhập 20/08 08:00–12:00 (giờ VN) → DB true-UTC, API format, Hồ sơ, Booking availability đều 08:00–12:00", async () => {
    const e = await emp({ fullName: "NV TZ " + uniq("z"), roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: e.id, dayOfWeek: 4, startTime: "08:00", endTime: "17:00" } });

    // (1) NHẬP qua API bằng chuỗi datetime-local GIỜ VN (như form nhân viên gõ).
    const mgr = await makeStaff(["staff.read", "staff.schedule.manage"]);
    await login(mgr.email, mgr.password);
    const r = await addLeave(jsonReq(`http://t/api/employees/${e.id}/leaves`, "POST", { type: "ANNUAL", fromAt: "2026-08-20T08:00", toAt: "2026-08-20T12:00", reason: "Nghỉ sáng" }), { params: { id: e.id } });
    expect(r.status).toBe(201);

    // (2) DB = true-UTC (01:00Z–05:00Z = 08:00–12:00 VN).
    const row = await prisma.employeeLeave.findFirstOrThrow({ where: { employeeId: e.id } });
    expect(row.fromAt.toISOString()).toBe("2026-08-20T01:00:00.000Z");
    expect(row.toAt.toISOString()).toBe("2026-08-20T05:00:00.000Z");

    // (3) API response (GET hồ sơ) trả ISO true-UTC — UI format ra 08:00–12:00.
    const g = await getEmployee(jsonReq(`http://t/api/employees/${e.id}`, "GET"), { params: { id: e.id } });
    const emp1 = (await readJson(g)).data;
    const lv = emp1.leaves[0];
    expect(formatDateTime(lv.fromAt)).toContain("08:00"); // Hồ sơ nhân sự (tab Nghỉ phép)
    expect(formatDateTime(lv.toAt)).toContain("12:00");
    expect(formatDateTime(lv.fromAt)).not.toContain("01:00");

    // (4) Booking availability đọc CÙNG record → chặn 09:00 VN (trong 08:00–12:00).
    const av9 = await employeeAvailability(e.id, parseVnLocal("2026-08-20T09:00"), parseVnLocal("2026-08-20T10:00"));
    expect(av9.onLeave).toBe(true);
    // 13:00 VN (ngoài giờ nghỉ) → rảnh
    const av13 = await employeeAvailability(e.id, parseVnLocal("2026-08-20T13:00"), parseVnLocal("2026-08-20T14:00"));
    expect(av13.onLeave).toBe(false);
    expect(av13.available).toBe(true);
  });
});

describe("Mục 8 — B/C. Booking dùng lịch làm việc + nghỉ phép (backend enforce)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("Case A — Booking 09:00 trong giờ nghỉ (08:00–12:00) → KHÔNG khả dụng (onLeave)", async () => {
    const e = await phamChuyenVien();
    const av = await employeeAvailability(e.id, parseVnLocal("2026-08-20T09:00"), parseVnLocal("2026-08-20T10:00"));
    expect(av.onLeave).toBe(true);
    expect(av.available).toBe(false);
  });

  it("Case B — Booking 13:00 (sau giờ nghỉ, trong ca) → khả dụng", async () => {
    const e = await phamChuyenVien();
    const av = await employeeAvailability(e.id, parseVnLocal("2026-08-20T13:00"), parseVnLocal("2026-08-20T14:00"));
    expect(av.onLeave).toBe(false);
    expect(av.working).toBe(true);
    expect(av.available).toBe(true);
  });

  it("Case C — Booking 18:00 ngoài ca (08:00–17:00) → KHÔNG khả dụng (working=false)", async () => {
    const e = await phamChuyenVien();
    const av = await employeeAvailability(e.id, parseVnLocal("2026-08-20T18:00"), parseVnLocal("2026-08-20T19:00"));
    expect(av.working).toBe(false);
    expect(av.available).toBe(false);
  });
});

describe("Mục 8 — D. Lọc theo năng lực HIFU", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("có HIFU → gợi ý; đang làm + rảnh nhưng THIẾU HIFU → không gợi ý", async () => {
    const hifu = await prisma.service.create({ data: { code: uniq("DV"), name: "HIFU", standardPrice: 6_000_000 } });
    const at = parseVnLocal("2026-08-20T13:00");
    // A: có năng lực HIFU
    const a = await emp({ fullName: "Có HIFU " + uniq("a"), roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: a.id, dayOfWeek: 4, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeCompetence.create({ data: { employeeId: a.id, kind: "SERVICE", refId: hifu.id, name: "HIFU" } });
    // B: đang làm + rảnh nhưng năng lực chỉ RF (không HIFU) → loại
    const b = await emp({ fullName: "Chỉ RF " + uniq("b"), roles: ["Kỹ thuật viên"] });
    await prisma.employeeSchedule.create({ data: { employeeId: b.id, dayOfWeek: 4, startTime: "08:00", endTime: "17:00" } });
    await prisma.employeeCompetence.create({ data: { employeeId: b.id, kind: "SERVICE", refId: "rf-khac", name: "RF" } });

    const list = await suggestEmployeesForBooking({ role: "Kỹ thuật viên", serviceId: hifu.id, at, durationMinutes: 60 });
    const names = list.map((x) => x.fullName);
    expect(names).toContain(a.fullName);
    expect(names).not.toContain(b.fullName);
  });
});

describe("Mục 8 — E. Fee snapshot theo effective date (500k→600k)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("buổi cũ giữ 500k; buổi mới từ 01/09 gợi ý 600k; version giá sàn cũ không đổi", async () => {
    const e = await emp({ fullName: "Master " + uniq("m") });
    await prisma.employeeRoleFee.createMany({ data: [
      { employeeId: e.id, role: "Master", fee: 500_000, effectiveFrom: new Date("2023-01-10"), effectiveTo: new Date("2026-08-31T23:59:59Z") },
      { employeeId: e.id, role: "Master", fee: 600_000, effectiveFrom: new Date("2026-09-01") },
    ] });
    // Buổi cũ (trước 01/09) đã snapshot 500k
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const sess = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, name: "B1", performedAt: new Date("2026-08-25T09:00:00Z") } });
    await prisma.sessionStaff.create({ data: { sessionId: sess.id, employeeId: e.id, staffName: e.fullName, role: "MASTER", fee: 500_000 } });

    // Phí hiện hành theo ngày
    expect(await resolveRoleFee(e.id, "Master", new Date("2026-08-25"))).toBe(500_000);
    expect(await resolveRoleFee(e.id, "Master", new Date("2026-09-15"))).toBe(600_000); // gợi ý buổi mới

    // Buổi cũ KHÔNG đổi dù master đã đổi phí
    const ss = await prisma.sessionStaff.findFirstOrThrow({ where: { sessionId: sess.id } });
    expect(Number(ss.fee)).toBe(500_000);
  });
});

describe("Mục 8 — F. Mask phí theo RBAC (server không trả field nhạy cảm)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("user KHÔNG finance/staff.fee.read → roleFees.fee = null; có quyền → thấy số", async () => {
    const e = await emp({ fullName: "NV Phí " + uniq("f"), defaultFee: 250_000 });
    await prisma.employeeRoleFee.create({ data: { employeeId: e.id, role: "Master", fee: 500_000, effectiveFrom: new Date("2024-01-01") } });

    // Người chỉ có staff.read (không tài chính) → fee bị ẩn
    const noFee = await makeStaff(["staff.read"]);
    await login(noFee.email, noFee.password);
    const r1 = await getEmployee(jsonReq(`http://t/api/employees/${e.id}`, "GET"), { params: { id: e.id } });
    const j1 = await readJson(r1);
    const emp1 = j1.data ?? j1;
    expect(emp1.roleFees[0].fee).toBeNull();
    expect(emp1.defaultFee).toBeNull();

    // Người có staff.fee.read → thấy số thật
    const withFee = await makeStaff(["staff.read", "staff.fee.read"]);
    await login(withFee.email, withFee.password);
    const r2 = await getEmployee(jsonReq(`http://t/api/employees/${e.id}`, "GET"), { params: { id: e.id } });
    const j2 = await readJson(r2);
    const emp2 = j2.data ?? j2;
    expect(emp2.roleFees[0].fee).toBe(500_000);
  });
});
