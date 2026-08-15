// =============================================================================
// Mục 15 — Phân quyền theo vai trò / RBAC toàn hệ thống: nghiệm thu tích hợp HTTP
// THẬT trên PostgreSQL thật. Đăng nhập bằng route thật (quyền suy từ ROLE_PERMISSIONS
// = nguồn sự thật), gọi route handler thật → kiểm ALLOW/DENY (status) + FIELD PRIVACY
// (JSON tài chính bị null khi không finance.read). KHÔNG dựa vào ẩn menu.
//   A persistence · B anonymous 401 · C Admin · D Quản lý · E Lễ tân · F CSKH ·
//   G Chuyên viên · H Thu ngân · I Marketing · J financial privacy · K direct-attack
//   · L multi-role union · M role-change effect · O audit.
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
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";

// Route handlers thật (production code — không mock RBAC). handle() có signature
// (req, ctx) → bọc lại để gọi 1 tham số cho collection route (ctx rỗng).
import { GET as _usersGet } from "@/app/api/users/route";
import { GET as _customersGet, POST as _customersPost } from "@/app/api/customers/route";
import { GET as _servicesGet } from "@/app/api/services/route";
import { GET as _spaProductsGet } from "@/app/api/spa-products/route";
import { GET as _priceFloorsGet } from "@/app/api/price-floors/route";
import { GET as _employeesGet } from "@/app/api/employees/route";
import { GET as _sessionStaffGet } from "@/app/api/session-staff/route";
import { POST as _sessionsPost } from "@/app/api/treatment-sessions/route";
import { POST as _protocolsPost } from "@/app/api/brand-protocols/route";
import { POST as _paymentsPost } from "@/app/api/payments/route";
import { POST as _campaignsPost } from "@/app/api/marketing-campaigns/route";
import { POST as _crmPost } from "@/app/api/crm-activities/route";
import { GET as _employeeGet } from "@/app/api/employees/[id]/route";

const wrap = (fn: (req: Request, ctx: any) => Promise<Response>) => (req: Request) => fn(req, {} as any);
const usersGet = wrap(_usersGet);
const customersGet = wrap(_customersGet);
const customersPost = wrap(_customersPost);
const servicesGet = wrap(_servicesGet);
const spaProductsGet = wrap(_spaProductsGet);
const priceFloorsGet = wrap(_priceFloorsGet);
const employeesGet = wrap(_employeesGet);
const sessionStaffGet = wrap(_sessionStaffGet);
const sessionsPost = wrap(_sessionsPost);
const protocolsPost = wrap(_protocolsPost);
const paymentsPost = wrap(_paymentsPost);
const campaignsPost = wrap(_campaignsPost);
const crmPost = wrap(_crmPost);

let ip = 0;
function jr(url: string, method = "GET", body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }

// Tạo user với các role code THẬT (quyền suy từ ROLE_PERMISSIONS lúc đăng nhập).
async function makeUser(roleCodes: string[]) {
  const email = `${uniq("u")}@sophia.com.vn`.toLowerCase();
  const roles = await Promise.all(roleCodes.map((code) => prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } })));
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123"), roles: { create: roles.map((r) => ({ roleId: r.id })) } } });
  return { user, email, password: "matkhau123" };
}
async function login(email: string, password = "matkhau123") {
  jar.clear();
  const res = await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.15.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {});
  return { status: res.status, body: await rj(res) };
}
async function loginAs(roleCodes: string[]) { const u = await makeUser(roleCodes); const r = await login(u.email); return { ...u, session: r.body?.data }; }

// ------- Fixtures nhạy cảm tài chính -------
let fx: { customerId: string; serviceId: string; sessionId: string; employeeId: string };
// Bảo đảm mọi Role code chuẩn tồn tại trong DB (như seed thật) — để PATCH đổi vai trò
// có Role row để liên kết (quyền vẫn suy từ ROLE_PERMISSIONS lúc đăng nhập).
async function seedAllRoles() {
  for (const code of Object.values(ROLES)) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
  }
}
async function seedFixtures() {
  await seedAllRoles();
  const customer = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH Test" } });
  const service = await prisma.service.create({ data: { code: uniq("DV"), name: "DV Test", standardPrice: 1800000, expectedCost: 900000 } });
  // Giá sàn (model cũ) để services.floorPrice + price-floors có dữ liệu.
  await prisma.servicePriceFloor.create({ data: { serviceId: service.id, laborCost: 400000, materialCost: 250000, minMarginPercent: 15 } });
  // SpaProduct có cost (nhạy cảm).
  await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "SP Test", productType: "PROFESSIONAL", cost: 350000 } });
  // Employee có defaultFee (nhạy cảm).
  const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "KTV Test", roles: ["Kỹ thuật viên"], defaultFee: 250000 } });
  // Session + SessionStaff.fee (nhạy cảm).
  const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: customer.id, name: "PĐ" } });
  const session = await prisma.treatmentSession.create({ data: { code: uniq("SS"), planId: plan.id, customerId: customer.id, sessionNumber: 1, name: "Buổi 1" } });
  await prisma.sessionStaff.create({ data: { sessionId: session.id, employeeId: emp.id, staffName: "KTV Test", role: "PRIMARY", fee: 250000 } });
  fx = { customerId: customer.id, serviceId: service.id, sessionId: session.id, employeeId: emp.id };
}
const employeeGet = (id: string) => _employeeGet(jr(`http://t/api/employees/${id}`), { params: { id } } as any);
async function employeeFeeSeen() {
  const e = (await rj(await employeeGet(fx.employeeId))).data as any;
  return e?.defaultFee ?? null;
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); await seedFixtures(); });
afterAll(async () => { await prisma.$disconnect(); });

// Helper đọc field cost dịch vụ (services trả list; tìm service fixture).
async function serviceCostSeen() {
  const list = (await rj(await servicesGet(jr("http://t/api/services")))).data as any[];
  const row = list.find((s) => s.id === fx.serviceId);
  return { expectedCost: row?.expectedCost ?? null, floorPrice: row?.floorPrice ?? null };
}
async function spaProductCostSeen() {
  const list = (await rj(await spaProductsGet(jr("http://t/api/spa-products")))).data as any[];
  return list[0]?.cost ?? null;
}
async function sessionStaffFeeSeen() {
  const r = (await rj(await sessionStaffGet(jr(`http://t/api/session-staff?sessionId=${fx.sessionId}`)))).data as any;
  return { fee: r?.staff?.[0]?.fee ?? null, totalFee: r?.totalFee ?? null, canSeeFinance: r?.canSeeFinance };
}

describe("Mục 15 · RBAC toàn hệ thống (HTTP thật)", () => {
  it("A · Persistence: role/permission suy từ ROLE_PERMISSIONS (nguồn sự thật) vào session THẬT", async () => {
    const mgr = await loginAs([ROLES.MANAGER]);
    expect(mgr.session.roles).toContain(ROLES.MANAGER);
    expect(mgr.session.permissions).toContain(PERMISSIONS.FINANCE_READ);
    expect(mgr.session.permissions).toContain(PERMISSIONS.TREATMENT_WRITE);
    const csr = await loginAs([ROLES.CUSTOMER_CARE]);
    expect(csr.session.permissions).not.toContain(PERMISSIONS.FINANCE_READ);
    // DB có user_roles thật
    const ur = await prisma.userRole.findFirst({ where: { userId: mgr.user.id }, include: { role: true } });
    expect(ur!.role.code).toBe(ROLES.MANAGER);
  });

  it("B · Anonymous → 401 trên mọi route nghiệp vụ protected", async () => {
    jar.clear();
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(401);
    expect((await customersGet(jr("http://t/api/customers"))).status).toBe(401);
    expect((await servicesGet(jr("http://t/api/services"))).status).toBe(401);
    expect((await employeesGet(jr("http://t/api/employees"))).status).toBe(401);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(401);
    expect((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status).toBe(401);
    expect((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status).toBe(401);
  });

  it("C · Admin: toàn quyền — /api/users 200 + nghiệp vụ không bị 403", async () => {
    await loginAs([ROLES.ADMIN]);
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(200);
    expect((await customersGet(jr("http://t/api/customers"))).status).toBe(200);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(200);
    expect((await employeesGet(jr("http://t/api/employees"))).status).toBe(200);
    // ghi nghiệp vụ: qua gate (không 403/401) — 422 body rỗng cũng chứng minh đã qua RBAC
    expect([200, 201, 422]).toContain((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status);
  });

  it("D · Quản lý: nghiệp vụ + tài chính; KHÔNG tự nhận user.manage", async () => {
    await loginAs([ROLES.MANAGER]);
    expect((await customersGet(jr("http://t/api/customers"))).status).toBe(200);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(200);
    // thấy tài chính
    expect((await serviceCostSeen()).expectedCost).not.toBeNull();
    expect((await sessionStaffFeeSeen()).canSeeFinance).toBe(true);
    // KHÔNG có quyền quản trị user
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
  });

  it("E · Lễ tân: khách/booking/thu tiền/hóa đơn ALLOW; user.manage + treatment.write DENY; KHÔNG thấy giá vốn", async () => {
    await loginAs([ROLES.RECEPTION]);
    expect((await customersGet(jr("http://t/api/customers"))).status).toBe(200);
    expect([200, 201, 422]).toContain((await customersPost(jr("http://t/api/customers", "POST", { fullName: "Khách Mới LT" }))).status);
    expect([200, 201, 422]).toContain((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status); // có payment.write
    // ngoài phạm vi
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
    expect((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status).toBe(403); // không treatment.write
    // KHÔNG finance.read → giá vốn dịch vụ bị mask
    expect((await serviceCostSeen()).expectedCost).toBeNull();
  });

  it("F · CSKH: CRM/task ALLOW; tài chính DENY (giá sàn 403, giá vốn null, phí null, user 403)", async () => {
    await loginAs([ROLES.CUSTOMER_CARE]);
    expect([200, 201, 422]).toContain((await crmPost(jr("http://t/api/crm-activities", "POST", { customerId: fx.customerId, type: "CALL", content: "gọi" }))).status);
    // finance-only
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(403); // không pricefloor.read/finance.read
    expect((await serviceCostSeen()).expectedCost).toBeNull(); // giá vốn mask
    expect((await spaProductCostSeen())).toBeNull(); // giá vốn SP mask
    expect((await sessionStaffFeeSeen()).fee).toBeNull(); // phí nhân sự mask
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
    expect((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status).toBe(403); // không treatment.write
  });

  it("G · Chuyên viên: treatment ALLOW; user.manage/finance DENY (giá vốn/giá sàn/phí không lộ)", async () => {
    await loginAs([ROLES.SPECIALIST]);
    expect([200, 201, 422]).toContain((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status); // có treatment.write
    expect((await servicesGet(jr("http://t/api/services"))).status).toBe(200); // xem dịch vụ để làm việc
    expect((await serviceCostSeen()).expectedCost).toBeNull(); // nhưng KHÔNG thấy giá vốn
    expect((await serviceCostSeen()).floorPrice).toBeNull(); // KHÔNG thấy giá sàn
    expect((await sessionStaffFeeSeen()).fee).toBeNull(); // KHÔNG thấy phí nhân sự
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(403);
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
  });

  it("H · Thu ngân: thanh toán/hóa đơn/giá sàn + tài chính ALLOW; user.manage/protocol DENY", async () => {
    await loginAs([ROLES.CASHIER]);
    expect([200, 201, 422]).toContain((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(200);
    expect((await serviceCostSeen()).expectedCost).not.toBeNull(); // có finance.read
    // ngoài phạm vi
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
    expect((await protocolsPost(jr("http://t/api/brand-protocols", "POST", {}))).status).toBe(403); // không protocol.write
  });

  it("I · Marketing: chiến dịch ALLOW; HR/user/treatment/payment DENY", async () => {
    await loginAs([ROLES.MARKETING]);
    expect([200, 201, 422]).toContain((await campaignsPost(jr("http://t/api/marketing-campaigns", "POST", {}))).status);
    // ngoài phạm vi (WRITE / quản trị)
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
    expect((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status).toBe(403); // không treatment.write
    expect((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status).toBe(403); // không payment.write
    // HR: đọc danh bạ được (CLINIC_READ có hr.read/staff.read cho mọi vai trò spa — baseline);
    // KHÔNG được quản lý HR (staff.write) — đã chứng minh ở test riêng. Marketing có finance.read
    // (phục vụ ROI) nên KHÔNG thuộc nhóm non-finance ở tiêu chí J (xem ghi chú baseline).
    expect((await employeesGet(jr("http://t/api/employees"))).status).toBe(200);
  });

  it("J · FINANCIAL PRIVACY (JSON trực tiếp): non-finance null, finance có giá trị", async () => {
    // non-finance: CSKH
    await loginAs([ROLES.CUSTOMER_CARE]);
    expect(await spaProductCostSeen()).toBeNull();
    expect((await serviceCostSeen()).expectedCost).toBeNull();
    expect((await sessionStaffFeeSeen()).fee).toBeNull();
    expect((await sessionStaffFeeSeen()).totalFee).toBeNull();
    // employees fee: RECEPTION có staff.read nhưng KHÔNG fee (finance/staff.fee.read) → defaultFee null
    await loginAs([ROLES.RECEPTION]);
    expect(await employeeFeeSeen()).toBeNull();
    // finance: MANAGER thấy giá trị thật
    await loginAs([ROLES.MANAGER]);
    expect(await spaProductCostSeen()).not.toBeNull();
    expect((await serviceCostSeen()).expectedCost).not.toBeNull();
    expect((await sessionStaffFeeSeen()).fee).not.toBeNull();
    expect(await employeeFeeSeen()).not.toBeNull();
  });

  it("K · Direct API attack: role thấp gọi thẳng route cao → 403/redacted (không dựa menu)", async () => {
    // RECEPTION → /api/users
    await loginAs([ROLES.RECEPTION]);
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
    // CSKH → giá sàn
    await loginAs([ROLES.CUSTOMER_CARE]);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(403);
    // SPECIALIST → phí nhân sự (session-staff) redacted, KHÔNG lộ dù gọi thẳng API
    await loginAs([ROLES.SPECIALIST]);
    expect((await sessionStaffFeeSeen()).fee).toBeNull();
    // MARKETING → payment write
    await loginAs([ROLES.MARKETING]);
    expect((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status).toBe(403);
  });

  it("L · Multi-role: user nhận UNION quyền (không chỉ role đầu)", async () => {
    // SPECIALIST (treatment.write, KHÔNG finance) + CASHIER (finance.read, payment.write)
    const u = await loginAs([ROLES.SPECIALIST, ROLES.CASHIER]);
    expect(u.session.roles.sort()).toEqual([ROLES.CASHIER, ROLES.SPECIALIST].sort());
    // union: có cả treatment.write (SPECIALIST) và finance.read + payment.write (CASHIER)
    expect(u.session.permissions).toContain(PERMISSIONS.TREATMENT_WRITE);
    expect(u.session.permissions).toContain(PERMISSIONS.FINANCE_READ);
    expect(u.session.permissions).toContain(PERMISSIONS.PAYMENT_WRITE);
    // route của cả hai đều hoạt động
    expect([200, 201, 422]).toContain((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status);
    expect([200, 201, 422]).toContain((await paymentsPost(jr("http://t/api/payments", "POST", {}))).status);
    // thấy tài chính (nhờ CASHIER)
    expect((await serviceCostSeen()).expectedCost).not.toBeNull();
    // nhưng KHÔNG có user.manage (không role nào cấp)
    expect((await usersGet(jr("http://t/api/users"))).status).toBe(403);
  });

  it("L2 · Role rác không sinh quyền (fallback DB rỗng)", async () => {
    // Vai trò không có trong ROLE_PERMISSIONS + không có RolePermission ⇒ 0 quyền.
    const u = await loginAs(["ROLE_KHONG_TON_TAI_XYZ"]);
    expect(u.session.permissions).toEqual([]);
    expect((await customersGet(jr("http://t/api/customers"))).status).toBe(403);
  });

  it("M · Đổi vai trò → phiên đăng nhập MỚI phản ánh quyền mới (quyền cũ mất, mới có)", async () => {
    const u = await makeUser([ROLES.CUSTOMER_CARE]);
    // trước: CSKH không thấy tài chính, không ghi buổi
    await login(u.email);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(403);
    expect((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status).toBe(403);
    // Admin đổi role CSKH → MANAGER
    const admin = await makeUser([ROLES.ADMIN]);
    await login(admin.email);
    const { PATCH: userPatch } = await import("@/app/api/users/[id]/route");
    await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { roleCodes: [ROLES.MANAGER] }), { params: { id: u.user.id } });
    // đăng nhập lại → quyền MỚI có hiệu lực
    await login(u.email);
    expect((await priceFloorsGet(jr("http://t/api/price-floors"))).status).toBe(200);
    expect([200, 201, 422]).toContain((await sessionsPost(jr("http://t/api/treatment-sessions", "POST", {}))).status);
    expect((await serviceCostSeen()).expectedCost).not.toBeNull();
  });

  it("O · Audit: đổi vai trò ghi USER_UPDATED (actor+before/after); đăng nhập ghi LOGIN; không log secret", async () => {
    const u = await makeUser([ROLES.RECEPTION]);
    const admin = await makeUser([ROLES.ADMIN]);
    await login(admin.email);
    const { PATCH: userPatch } = await import("@/app/api/users/[id]/route");
    await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { roleCodes: [ROLES.CASHIER] }), { params: { id: u.user.id } });
    const aud = await prisma.auditLog.findFirst({ where: { action: "USER_UPDATED", entityId: u.user.id }, orderBy: { createdAt: "desc" } });
    expect(aud!.userId).toBe(admin.user.id);
    const ch: any = aud!.changes;
    expect(ch.roles).toMatchObject({ before: [ROLES.RECEPTION], after: [ROLES.CASHIER] });
    // login audit + không rò rỉ mật khẩu/hash
    const loginAudit = await prisma.auditLog.findFirst({ where: { action: "LOGIN", userId: admin.user.id } });
    expect(loginAudit).toBeTruthy();
    expect(JSON.stringify(ch)).not.toContain("matkhau123");
    expect(JSON.stringify(ch)).not.toContain("$2");
  });
});
