// =============================================================================
// HR-PH1 — Employee foundation + Branch + HR privacy/RBAC. Chứng minh A–T.
//   RBAC (unit trên ROLE_PERMISSIONS/PERMISSIONS — nguồn sự thật):
//     A quyền cũ bất biến · B finance.read KHÔNG suy ra payroll.read ·
//     C staff.fee.read ≠ payroll.read · G staff.read/write giữ · H union đa vai trò ·
//     + namespace HR mới tách biệt, vai trò thấp KHÔNG nhận.
//   Self-view (unit, FK-only): D self resolve theo userId · E A không self-resolve B ·
//     F user chưa liên kết → null; KHÔNG fallback tên/email.
//   Branch/Employee (HTTP thật): I code unique(409) · J branchId hợp lệ · K legacy branch
//     String giữ · L+M backfill deterministic (KHÔNG merge khác hoa/thường) · N inactive
//     filter · O list không regress · Employee link user (1-1).
//   Privacy (HTTP): P không lộ field salary/payroll · Q finance.read không mở HR profile
//     khi thiếu staff.read · S EmployeeRoleFee mask giữ · T ẩn danh 401.
// KHÔNG đổi EmployeeRoleFee semantics; KHÔNG merge Employee/User.
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
import { resolveSelfEmployee, resolveSelfEmployeeId, isSelfEmployee } from "@/lib/hr-self";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as empListRaw, POST as empCreateRaw } from "@/app/api/employees/route";
import { GET as empGetRaw, PATCH as empPatchRaw } from "@/app/api/employees/[id]/route";
import { POST as empLinkRaw } from "@/app/api/employees/[id]/link-user/route";
import { GET as brListRaw, POST as brCreateRaw } from "@/app/api/branches/route";
import { PATCH as brPatchRaw } from "@/app/api/branches/[id]/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const data = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };

async function makeStaff(perms: string[]) {
  const email = `${uniq("hr")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.51.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const empList = (qs = "") => empListRaw(new Request("http://t/api/employees" + qs), {} as any);
const empCreate = (b: unknown) => empCreateRaw(new Request("http://t/api/employees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), {} as any);
const empGet = (id: string) => empGetRaw(new Request("http://t/api/employees/" + id), { params: { id } } as any);
const empPatch = (id: string, b: unknown) => empPatchRaw(new Request("http://t/api/employees/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);
const empLink = (id: string, b: unknown) => empLinkRaw(new Request("http://t/api/employees/" + id + "/link-user", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);
const brList = (qs = "") => brListRaw(new Request("http://t/api/branches" + qs), {} as any);
const brCreate = (b: unknown) => brCreateRaw(new Request("http://t/api/branches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), {} as any);
const brPatch = (id: string, b: unknown) => brPatchRaw(new Request("http://t/api/branches/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);

// ---------------------------------------------------------------------------
// RBAC — unit trên nguồn sự thật (không DB)
// ---------------------------------------------------------------------------
describe("HR-PH1 · RBAC namespace tách biệt (unit)", () => {
  const has = (role: string, perm: string) => ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS].includes(perm as any);

  it("A · quyền cũ của các vai trò BẤT BIẾN (spot-check)", () => {
    expect(has(ROLES.MANAGER, PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(has(ROLES.MANAGER, PERMISSIONS.STAFF_FEE_READ)).toBe(true);
    expect(has(ROLES.MANAGER, PERMISSIONS.INVOICE_WRITE)).toBe(true);
    expect(has(ROLES.CASHIER, PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(has(ROLES.CASHIER, PERMISSIONS.PAYMENT_WRITE)).toBe(true);
    expect(has(ROLES.SPECIALIST, PERMISSIONS.TREATMENT_WRITE)).toBe(true);
  });

  it("B · finance.read KHÔNG kéo theo payroll.read (khác namespace)", () => {
    // MARKETING có finance.read (phục vụ ROI) nhưng KHÔNG có payroll.read → chứng minh
    // 2 quyền độc lập, không suy diễn. (Kế toán/CASHIER được owner cấp payroll RIÊNG — xem test dưới.)
    expect(has(ROLES.MARKETING, PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(has(ROLES.MARKETING, PERMISSIONS.PAYROLL_READ)).toBe(false);
    // Hằng số khác nhau (không phải alias).
    expect(PERMISSIONS.FINANCE_READ).not.toBe(PERMISSIONS.PAYROLL_READ);
  });

  it("C · staff.fee.read ≠ payroll.read (khác nhau; không suy diễn)", () => {
    expect(PERMISSIONS.STAFF_FEE_READ).not.toBe(PERMISSIONS.PAYROLL_READ);
    // MANAGER có cả hai (theo mapping owner), nhưng là 2 quyền độc lập.
    expect(has(ROLES.MANAGER, PERMISSIONS.STAFF_FEE_READ)).toBe(true);
    expect(has(ROLES.MANAGER, PERMISSIONS.PAYROLL_READ)).toBe(true);
  });

  it("mapping HR (owner v0.38.9): MANAGER+CASHIER+BOD đủ quyền lương; vai trò thấp KHÔNG nhận", () => {
    // Quản lý (Trợ lý GĐ) + Kế toán: ĐỦ quyền lương (tính/duyệt/chấm công/chính sách).
    for (const role of [ROLES.MANAGER, ROLES.CASHIER])
      for (const p of [PERMISSIONS.ATTENDANCE_WRITE, PERMISSIONS.PAYROLL_WRITE, PERMISSIONS.PAYROLL_APPROVE, PERMISSIONS.COMPENSATION_POLICY_WRITE, PERMISSIONS.COMMISSION_READ])
        expect(has(role, p)).toBe(true);
    // Giám đốc (BOD): TOÀN QUYỀN như Admin trừ user.manage → có đủ quyền lương.
    for (const p of [PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_WRITE, PERMISSIONS.PAYROLL_APPROVE, PERMISSIONS.ATTENDANCE_WRITE])
      expect(has(ROLES.BOD, p)).toBe(true);
    expect(has(ROLES.BOD, PERMISSIONS.USER_MANAGE)).toBe(false); // trừ đúng 1 quyền quản trị user
    // Vai trò đầu ra / read-only KHÔNG có quyền lương.
    for (const role of [ROLES.RECEPTION, ROLES.CUSTOMER_CARE, ROLES.SPECIALIST, ROLES.MARKETING])
      for (const p of [PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_WRITE, PERMISSIONS.ATTENDANCE_WRITE, PERMISSIONS.COMPENSATION_POLICY_READ, PERMISSIONS.COMMISSION_READ])
        expect(has(role, p)).toBe(false);
    expect(ROLE_PERMISSIONS[ROLES.ADMIN].includes(PERMISSIONS.PAYROLL_APPROVE as any)).toBe(true); // ADMIN qua ALL_PERMISSIONS
  });

  it("G+H · staff.read/write giữ; union đa vai trò hợp nhất", () => {
    expect(has(ROLES.MANAGER, PERMISSIONS.STAFF_WRITE)).toBe(true);
    expect(has(ROLES.RECEPTION, PERMISSIONS.STAFF_WRITE)).toBe(true);
    // SPECIALIST (đầu ra) + RECEPTION (lễ tân) — cả hai KHÔNG có payroll → union không có.
    const union = new Set<string>([...ROLE_PERMISSIONS[ROLES.SPECIALIST], ...ROLE_PERMISSIONS[ROLES.RECEPTION]]);
    expect(union.has(PERMISSIONS.TREATMENT_WRITE)).toBe(true);
    expect(union.has(PERMISSIONS.PAYMENT_WRITE)).toBe(true);
    expect(union.has(PERMISSIONS.PAYROLL_WRITE)).toBe(false); // không role nào trong 2 role này có
  });
});

// ---------------------------------------------------------------------------
// Self-view — FK only (unit + DB)
// ---------------------------------------------------------------------------
describe("HR-PH1 · Self-view foundation (FK-only)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("D · user liên kết resolve đúng Employee của mình (theo userId FK)", async () => {
    const u = await prisma.user.create({ data: { email: `${uniq("self")}@t.vn`, name: "U", passwordHash: "x" } });
    const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "Tôi", userId: u.id } });
    expect((await resolveSelfEmployee({ userId: u.id }))?.id).toBe(emp.id);
    expect(await resolveSelfEmployeeId({ userId: u.id })).toBe(emp.id);
    expect(await isSelfEmployee({ userId: u.id }, emp.id)).toBe(true);
  });

  it("E · user A KHÔNG self-resolve Employee B", async () => {
    const uA = await prisma.user.create({ data: { email: `${uniq("a")}@t.vn`, name: "A", passwordHash: "x" } });
    const uB = await prisma.user.create({ data: { email: `${uniq("b")}@t.vn`, name: "B", passwordHash: "x" } });
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "A", userId: uA.id } });
    const empB = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "B", userId: uB.id } });
    expect(await isSelfEmployee({ userId: uA.id }, empB.id)).toBe(false);
  });

  it("F · user chưa liên kết → null; KHÔNG fallback theo tên/email", async () => {
    const u = await prisma.user.create({ data: { email: `${uniq("nolink")}@t.vn`, name: "Trùng Tên", passwordHash: "x" } });
    // Employee có CÙNG email/tên nhưng KHÔNG gắn userId → không được coi là self.
    const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "Trùng Tên", email: u.email } });
    expect(await resolveSelfEmployee({ userId: u.id })).toBeNull();
    expect(await isSelfEmployee({ userId: u.id }, emp.id)).toBe(false);
    expect(await resolveSelfEmployeeId({ userId: undefined as any })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Branch + Employee (HTTP) + Privacy
// ---------------------------------------------------------------------------
describe("HR-PH1 · Branch + Employee + Privacy (HTTP thật)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("I · Branch code unique → 409 khi trùng", async () => {
    await login((await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE])).email);
    const a = await brCreate({ code: "CN-DUP", name: "Cơ sở 1" });
    expect(a.status).toBe(201);
    const b = await brCreate({ code: "CN-DUP", name: "Cơ sở khác" });
    expect(b.status).toBe(409);
  });

  it("J+K · gán branchId hợp lệ; branch (String) legacy GIỮ NGUYÊN", async () => {
    await login((await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE])).email);
    const br = await data(await brCreate({ name: "Quận 1" }));
    const emp = await data(await empCreate({ fullName: "NV A", branch: "Quận 1 (ghi chú cũ)" }));
    await empPatch(emp.id, { branchId: br.id });
    const got = await data(await empGet(emp.id));
    expect(got.branchId).toBe(br.id);
    expect(got.branchRef?.name).toBe("Quận 1");
    expect(got.branch).toBe("Quận 1 (ghi chú cũ)"); // legacy String KHÔNG bị xóa
    // branchId không tồn tại → 422
    expect((await empPatch(emp.id, { branchId: "khong-co-that" })).status).toBe(422);
  });

  it("L+M · backfill deterministic: gộp theo trim, KHÔNG gộp khác hoa/thường", async () => {
    // Dữ liệu legacy: 'Q1', 'Q1 ' (thừa space) → 1 branch; 'q1' khác hoa → branch riêng (không merge).
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "e1", branch: "Q1" } });
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "e2", branch: "Q1 " } });
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "e3", branch: "q1" } });
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "e4", branch: "  " } }); // rỗng → bỏ qua
    // Chạy CHÍNH backfill của migration (idempotent, deterministic).
    await prisma.$executeRawUnsafe(`
      INSERT INTO "branches" ("id","code","name","isActive","createdAt","updatedAt")
      SELECT gen_random_uuid()::text, 'CN-' || LPAD((ROW_NUMBER() OVER (ORDER BY b))::text,4,'0'), b, true, now(), now()
      FROM (SELECT DISTINCT TRIM("branch") AS b FROM "employees" WHERE "branch" IS NOT NULL AND TRIM("branch") <> '') d;`);
    await prisma.$executeRawUnsafe(`
      UPDATE "employees" e SET "branchId" = br."id" FROM "branches" br
      WHERE e."branch" IS NOT NULL AND TRIM(e."branch") = br."name" AND e."branchId" IS NULL;`);
    const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
    expect(branches.map((b) => b.name).sort()).toEqual(["Q1", "q1"]); // 2 branch: KHÔNG merge khác hoa/thường; trim gộp 'Q1'+'Q1 '
    const q1 = branches.find((b) => b.name === "Q1")!;
    const e1 = await prisma.employee.findFirst({ where: { fullName: "e1" } });
    const e2 = await prisma.employee.findFirst({ where: { fullName: "e2" } });
    const e4 = await prisma.employee.findFirst({ where: { fullName: "e4" } });
    expect(e1?.branchId).toBe(q1.id);
    expect(e2?.branchId).toBe(q1.id); // 'Q1 ' trim = 'Q1'
    expect(e4?.branchId).toBeNull();  // rỗng KHÔNG đoán
  });

  it("N · inactive branch bị loại khỏi ?active=1", async () => {
    await login((await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE])).email);
    const br = await data(await brCreate({ name: "Cơ sở tạm" }));
    await brPatch(br.id, { isActive: false });
    const active = await data(await brList("?active=1"));
    expect(active.find((b: any) => b.id === br.id)).toBeUndefined();
    const all = await data(await brList());
    expect(all.find((b: any) => b.id === br.id)).toBeTruthy();
  });

  it("O · employee list không regress + có field HR mới", async () => {
    await login((await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE])).email);
    const br = await data(await brCreate({ name: "CN List" }));
    const emp = await data(await empCreate({ fullName: "NV List", employmentType: "MONTHLY", branchId: br.id }));
    const rows = await data(await empList());
    const row = rows.find((r: any) => r.id === emp.id);
    expect(row.code).toBeTruthy();
    expect(row.fullName).toBe("NV List");
    expect(row.branchName).toBe("CN List");
    expect(row.employmentType).toBe("MONTHLY");
    expect(row.hasAccount).toBe(false);
  });

  it("Link user 1-1: gắn/gỡ + chặn 1 user cho 2 employee", async () => {
    await login((await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE])).email);
    const u = await prisma.user.create({ data: { email: `${uniq("link")}@t.vn`, name: "U", passwordHash: "x" } });
    const e1 = await data(await empCreate({ fullName: "E1" }));
    const e2 = await data(await empCreate({ fullName: "E2" }));
    expect((await empLink(e1.id, { userId: u.id })).status).toBe(200);
    expect((await data(await empGet(e1.id))).user?.id).toBe(u.id);
    // user đã gắn e1 → gắn cho e2 phải 422
    expect((await empLink(e2.id, { userId: u.id })).status).toBe(422);
    // user không tồn tại → 422
    expect((await empLink(e2.id, { userId: "khong-co" })).status).toBe(422);
    // gỡ liên kết
    expect((await empLink(e1.id, { userId: null })).status).toBe(200);
    expect((await data(await empGet(e1.id))).user).toBeNull();
  });

  it("P+S+T · privacy: không lộ salary/payroll; mask EmployeeRoleFee; ẩn danh 401", async () => {
    // seed 1 employee + roleFee
    const setup = await makeStaff([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE, PERMISSIONS.STAFF_FEE_READ]);
    await login(setup.email);
    const emp = await data(await empCreate({ fullName: "NV Fee" }));
    await prisma.employeeRoleFee.create({ data: { employeeId: emp.id, role: "KTV chính", fee: 250000, effectiveFrom: new Date("2020-01-01"), isActive: true } });

    // P: GET không có field salary/payroll/commission
    const withFee = await data(await empGet(emp.id));
    for (const k of ["salary", "payroll", "commission", "basePay", "netPay"]) expect(k in withFee).toBe(false);
    // S: có staff.fee.read → thấy fee
    expect(withFee.roleFees[0].fee).toBe(250000);
    expect(withFee.canSeeFee).toBe(true);

    // S: KHÔNG có staff.fee.read/finance.read → fee bị mask null
    await login((await makeStaff([PERMISSIONS.STAFF_READ])).email);
    const noFee = await data(await empGet(emp.id));
    expect(noFee.roleFees[0].fee).toBeNull();
    expect(noFee.defaultFee).toBeNull();
    expect(noFee.canSeeFee).toBe(false);

    // T: ẩn danh → 401
    jar.clear();
    expect((await empGet(emp.id)).status).toBe(401);
    expect((await brList()).status).toBe(401);
  });

  it("Q · finance.read KHÔNG mở hồ sơ HR khi thiếu staff.read (403)", async () => {
    // finance.read có, staff.read KHÔNG → GET employees 403 (payroll/HR không suy từ finance.read)
    await login((await makeStaff([PERMISSIONS.FINANCE_READ])).email);
    expect((await empList()).status).toBe(403);
    expect((await brList()).status).toBe(403);
  });
});
