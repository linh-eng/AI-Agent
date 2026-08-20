// =============================================================================
// ② Chi phí nhân sự theo VAI TRÒ — bảng đơn giá (StaffRoleRate) + dòng nhân sự
// (laborCostLines) trong Giá vốn dịch vụ: laborCost = Σ dòng khi có dòng; auto
// (staffRequirements × EmployeeRoleFee) khi rỗng; bất biến khi phát hành; mask
// theo finance.read; RBAC. HTTP thật trên Postgres.
// =============================================================================
import { describe, it, expect, beforeAll, vi } from "vitest";

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
import { POST as createCostingRaw } from "@/app/api/service-costings/route";
import { GET as listRatesRaw, POST as createRateRaw } from "@/app/api/staff-role-rates/route";
import { PATCH as patchRateRaw } from "@/app/api/staff-role-rates/[id]/route";

const createCosting = (r: Request) => createCostingRaw(r, {} as any);
const listRates = (r: Request) => listRatesRaw(r, {} as any);
const createRate = (r: Request) => createRateRaw(r, {} as any);

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.9.7" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("rr")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Đơn giá", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) { const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  const { POST: staffLogin } = await import("@/app/api/auth/login/route");
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.9.7" }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
  return jar.get(SESSION_COOKIE)!;
}
const as = (t: string) => { jar.clear(); jar.set(SESSION_COOKIE, t); };

let finToken = ""; let noFinToken = ""; let readOnlyToken = ""; let svcId = "";

beforeAll(async () => {
  await resetDb();
  finToken = await login(await makeStaff(["pricefloor.read", "pricefloor.write", "finance.read"]));
  noFinToken = await login(await makeStaff(["pricefloor.read", "pricefloor.write"]));
  readOnlyToken = await login(await makeStaff(["pricefloor.read", "finance.read"]));
  const cat = await prisma.serviceCategory.create({ data: { code: uniq("CAT"), name: "Nhóm" } });
  const svc = await prisma.service.create({ data: { code: uniq("SV"), name: "DV nhân sự", categoryId: cat.id, standardPrice: 3_000_000, durationMinutes: 60 } });
  svcId = svc.id;
});

describe("② Đơn giá nhân sự theo vai trò", () => {
  it("A · tạo đơn giá vai trò (sinh mã VR-) + mask theo finance.read", async () => {
    as(finToken);
    const res = await createRate(req("http://t/api/staff-role-rates", "POST", {
      roleName: "Kỹ thuật viên", certified: true, baseFee: 250_000, bonus: 50_000, tips: 30_000, commission: 0, commissionPercent: 0,
    }));
    expect(res.status).toBe(201);
    const r = (await readJson(res)).data;
    expect(r.code).toMatch(/^VR-/);
    expect(Number(r.baseFee)).toBe(250_000);

    // non-finance: số tiền bị mask
    as(noFinToken);
    const list = (await readJson(await listRates(req("http://t/api/staff-role-rates", "GET")))).data;
    const found = list.find((x: any) => x.code === r.code);
    expect(found.baseFee).toBeNull();
    expect(found.bonus).toBeNull();
    expect(found.roleName).toBe("Kỹ thuật viên"); // tên vai trò không nhạy cảm
  });

  it("B · laborCostLines: laborCost = Σ dòng (qty × (base+bonus+tips+commission))", async () => {
    as(finToken);
    const res = await createCosting(req("http://t/api/service-costings", "POST", {
      serviceId: svcId,
      laborCostLines: [
        { roleName: "Kỹ thuật viên", certified: true, quantity: 1, baseFee: 250_000, bonus: 50_000, tips: 30_000, commission: 0 }, // 330k
        { roleName: "Master", certified: true, quantity: 1, baseFee: 500_000, bonus: 100_000, tips: 0, commission: 0 }, // 600k
      ],
      equipmentCost: 0, facilityCost: 0, overheadMethod: "MANUAL", overheadValue: 0,
    }));
    expect(res.status).toBe(201);
    const v = (await readJson(res)).data;
    expect(Number(v.laborCost)).toBe(930_000);
    expect(Array.isArray(v.laborCostLines)).toBe(true);
    expect(v.laborCostLines).toHaveLength(2);
    // total = 0 + 930k + 0 + 0 + 0 + 0
    expect(Number(v.totalEstimatedCost)).toBe(930_000);
  });

  it("C · quantity nhân đúng số người/lượt", async () => {
    as(finToken);
    const v = (await readJson(await createCosting(req("http://t/api/service-costings", "POST", {
      serviceId: svcId,
      laborCostLines: [{ roleName: "Sales CV", quantity: 2, baseFee: 100_000, bonus: 0, tips: 0, commission: 200_000 }], // 2 × 300k = 600k
    })))).data;
    expect(Number(v.laborCost)).toBe(600_000);
  });

  it("D · KHÔNG có dòng → laborCost auto từ staffRequirements × EmployeeRoleFee (tương thích ngược)", async () => {
    // Dịch vụ có staffRequirements + 1 nhân sự ACTIVE có EmployeeRoleFee cho vai trò đó.
    as(finToken);
    const cat = await prisma.serviceCategory.create({ data: { code: uniq("CAT"), name: "N2" } });
    const svc2 = await prisma.service.create({ data: { code: uniq("SV"), name: "DV auto", categoryId: cat.id, standardPrice: 1_000_000, durationMinutes: 60, staffRequirements: [{ role: "KTV", quantity: 1, required: true }] as any } });
    const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "NV Auto", roles: ["KTV"], status: "ACTIVE", isActive: true } });
    await prisma.employeeRoleFee.create({ data: { employeeId: emp.id, role: "KTV", fee: 222_000, effectiveFrom: new Date("2020-01-01"), isActive: true } });
    const v = (await readJson(await createCosting(req("http://t/api/service-costings", "POST", { serviceId: svc2.id })))).data;
    expect(Number(v.laborCost)).toBe(222_000);
    expect(v.laborCostLines).toBeNull(); // không có dòng → cột null
  });

  it("E · phát hành → bất biến; sửa đơn giá vai trò sau KHÔNG đổi bản đã phát hành", async () => {
    as(finToken);
    const rate = (await readJson(await createRate(req("http://t/api/staff-role-rates", "POST", { roleName: "Bác sĩ", certified: true, baseFee: 800_000 })))).data;
    const c1 = (await readJson(await createCosting(req("http://t/api/service-costings", "POST", {
      serviceId: svcId, laborCostLines: [{ roleCode: rate.code, roleName: "Bác sĩ", quantity: 1, baseFee: 800_000, bonus: 0, tips: 0, commission: 0, source: "CATALOG" }],
    })))).data;
    const { POST: pubRaw } = await import("@/app/api/service-costings/[id]/publish/route");
    const pub = await pubRaw(req(`http://t/api/service-costings/${c1.id}/publish`, "POST"), { params: { id: c1.id } } as any);
    expect(pub.status).toBe(200);
    const published = (await readJson(pub)).data;
    expect(Number(published.laborCost)).toBe(800_000);
    expect(published.sourceSnapshot?.laborCostLines?.[0]?.roleName).toBe("Bác sĩ");

    // Sửa đơn giá vai trò lên 999k → bản PUBLISHED giữ nguyên 800k (snapshot).
    const { PATCH: patchRate } = await import("@/app/api/staff-role-rates/[id]/route");
    await patchRate(req(`http://t/api/staff-role-rates/${rate.id}`, "PATCH", { baseFee: 999_000 }), { params: { id: rate.id } } as any);
    const { GET: getOne } = await import("@/app/api/service-costings/[id]/route");
    const after = (await readJson(await getOne(req(`http://t/api/service-costings/${c1.id}`, "GET"), { params: { id: c1.id } } as any))).data;
    expect(Number(after.laborCost)).toBe(800_000);
  });

  it("F · non-finance: laborCost + laborCostLines bị mask (null)", async () => {
    as(noFinToken);
    const { GET: listRaw } = await import("@/app/api/service-costings/route");
    const rows = (await readJson(await listRaw(req(`http://t/api/service-costings?serviceId=${svcId}`, "GET"), {} as any))).data;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.laborCost).toBeNull(); expect(r.laborCostLines).toBeNull(); }
  });

  it("G · RBAC: thiếu pricefloor.write → tạo/sửa 403; ẩn danh → 401; đọc cần pricefloor.read", async () => {
    // read-only (pricefloor.read + finance.read, KHÔNG write) → POST 403
    as(readOnlyToken);
    expect((await createRate(req("http://t/api/staff-role-rates", "POST", { roleName: "X" }))).status).toBe(403);
    // đọc được
    expect((await listRates(req("http://t/api/staff-role-rates", "GET"))).status).toBe(200);
    // ẩn danh → 401
    jar.clear();
    expect((await listRates(req("http://t/api/staff-role-rates", "GET"))).status).toBe(401);
    expect((await createRate(req("http://t/api/staff-role-rates", "POST", { roleName: "X" }))).status).toBe(401);
  });

  it("H · PATCH bật/tắt đơn giá (KHÔNG hard-delete)", async () => {
    as(finToken);
    const rate = (await readJson(await createRate(req("http://t/api/staff-role-rates", "POST", { roleName: "Sales NV", baseFee: 80_000 })))).data;
    const { PATCH: patchRate } = await import("@/app/api/staff-role-rates/[id]/route");
    const res = await patchRate(req(`http://t/api/staff-role-rates/${rate.id}`, "PATCH", { isActive: false }), { params: { id: rate.id } } as any);
    expect(res.status).toBe(200);
    const still = await prisma.staffRoleRate.findUnique({ where: { id: rate.id } });
    expect(still).not.toBeNull(); // vẫn tồn tại (soft)
    expect(still!.isActive).toBe(false);
  });
});
