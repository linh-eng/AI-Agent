// =============================================================================
// PRICING / COSTING — PH1: Service Costing Foundation. Test tích hợp HTTP thật
// trên Postgres (đi qua auth + RBAC + Prisma). Bao phủ A–T (PH1 §22).
//   material từ SOP · labor từ staffRequirements×EmployeeRoleFee · manual equip/
//   facility/other · overhead method · total formula · override+reason · publish
//   freeze · immutability sau khi đổi cost/SOP/fee · recalc lấy nguồn mới ·
//   published edit blocked · finance mask · RBAC · audit · legacy floor unchanged.
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
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as listGetRaw, POST as createRaw } from "@/app/api/service-costings/route";
import { GET as getRaw, PATCH as patchRaw } from "@/app/api/service-costings/[id]/route";
import { POST as publishRaw } from "@/app/api/service-costings/[id]/publish/route";
import { POST as recalcRaw } from "@/app/api/service-costings/[id]/recalculate/route";

const listGet = (serviceId: string) => listGetRaw(new Request("http://t/api/service-costings?serviceId=" + serviceId), {} as any);
const create = (body: unknown) => createRaw(new Request("http://t/api/service-costings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const get = (id: string) => getRaw(new Request("http://t/api/service-costings/" + id), { params: { id } } as any);
const patch = (id: string, body: unknown) => patchRaw(new Request("http://t/api/service-costings/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { id } } as any);
const publish = (id: string) => publishRaw(new Request("http://t/api/service-costings/" + id + "/publish", { method: "POST" }), { params: { id } } as any);
const recalc = (id: string) => recalcRaw(new Request("http://t/api/service-costings/" + id + "/recalculate", { method: "POST" }), { params: { id } } as any);

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("cst")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.31.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
async function asWriter() { await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ])); }

// --- Fixture: dịch vụ có SOP (2 SP có cost) + staffRequirements + Employee/RoleFee ---
let SVC = "", PROD_A = "", PROD_B = "", ROLE_NAME = "Chuyên viên";
async function seedService() {
  const a = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Cleanser", productType: "PROFESSIONAL", cost: 100000 } });
  const b = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Mist", productType: "PROFESSIONAL", cost: 50000 } });
  PROD_A = a.id; PROD_B = b.id;
  const svc = await prisma.service.create({
    data: {
      code: uniq("DV"), name: "Dịch vụ Costing", standardPrice: 2000000, durationMinutes: 60,
      staffRequirements: [{ role: ROLE_NAME, quantity: 1, required: true }],
      steps: {
        create: [
          { sortOrder: 0, name: "Làm sạch", durationMinutes: 20, products: { create: [{ spaProductId: a.id, name: "Cleanser", quantity: 5, unit: "ml", sortOrder: 0 }] } },
          { sortOrder: 1, name: "Dưỡng", durationMinutes: 40, products: { create: [{ spaProductId: b.id, name: "Mist", quantity: 3, unit: "ml", sortOrder: 0 }] } },
        ],
      },
    },
  });
  SVC = svc.id;
  // Employee ACTIVE có vai trò + phí hiện hành 300k.
  const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "KTV A", roles: [ROLE_NAME], status: "ACTIVE", isActive: true, defaultFee: 0 } });
  await prisma.employeeRoleFee.create({ data: { employeeId: emp.id, role: ROLE_NAME, fee: 300000, effectiveFrom: new Date("2020-01-01"), isActive: true } });
  return { empId: emp.id };
}
// Kỳ vọng: material 5×100k + 3×50k = 650k; labor 1×300k; equip 100k; facility 50k; other 0
//   direct = 650+300+100+50 = 1,100k; overhead PER_MINUTE 1000×60 = 60k → total 1,160k
const baseInputs = { equipmentCost: 100000, facilityCost: 50000, otherCost: 0, overheadMethod: "PER_MINUTE", overheadValue: 1000 };

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); await seedService(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("PH1 · Service Costing (giá vốn dịch vụ có version)", () => {
  it("A+B+C+D+E+F create draft: material từ SOP, labor từ staffReq×fee, manual + overhead + total đúng", async () => {
    await asWriter();
    const res = await create({ serviceId: SVC, ...baseInputs });
    expect(res.status).toBe(201);
    const d = (await rj(res)).data;
    expect(d.status).toBe("DRAFT");
    expect(Number(d.computedMaterialCost)).toBe(650000); // B
    expect(Number(d.finalMaterialCost)).toBe(650000);
    expect(Number(d.laborCost)).toBe(300000); // C
    expect(Number(d.equipmentCost)).toBe(100000); // D
    expect(Number(d.facilityCost)).toBe(50000);
    expect(Number(d.overheadCost)).toBe(60000); // E: PER_MINUTE 1000×60
    expect(Number(d.directCost)).toBe(1100000); // F
    expect(Number(d.totalEstimatedCost)).toBe(1160000); // F
    // DB persist đúng
    const db = await prisma.serviceCostingVersion.findUnique({ where: { id: d.id } });
    expect(Number(db!.totalEstimatedCost)).toBe(1160000);
    expect(db!.version).toBe(1);
  });

  it("E overhead MANUAL = value (không nhân phút)", async () => {
    await asWriter();
    const d = (await rj(await create({ serviceId: SVC, ...baseInputs, overheadMethod: "MANUAL", overheadValue: 77000 }))).data;
    expect(Number(d.overheadCost)).toBe(77000);
    expect(Number(d.totalEstimatedCost)).toBe(1100000 + 77000);
  });

  it("G override vật tư + lý do → finalMaterial dùng override; total giảm theo", async () => {
    await asWriter();
    const d = (await rj(await create({ serviceId: SVC, ...baseInputs, materialOverride: 500000, materialOverrideReason: "Đàm phán giá lô" }))).data;
    expect(Number(d.computedMaterialCost)).toBe(650000); // computed vẫn giữ
    expect(Number(d.finalMaterialCost)).toBe(500000); // dùng override
    expect(d.materialOverrideReason).toBe("Đàm phán giá lô");
    expect(Number(d.directCost)).toBe(500000 + 300000 + 100000 + 50000); // 950k
    expect(Number(d.totalEstimatedCost)).toBe(950000 + 60000); // 1,010k
  });

  it("H override thiếu lý do → 422", async () => {
    await asWriter();
    expect((await create({ serviceId: SVC, ...baseInputs, materialOverride: 500000 })).status).toBe(422);
  });

  it("I publish freeze: DRAFT → PUBLISHED + snapshot đủ evidence", async () => {
    await asWriter();
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    const p = await publish(id);
    expect(p.status).toBe(200);
    const d = (await rj(p)).data;
    expect(d.status).toBe("PUBLISHED");
    expect(d.publishedAt).toBeTruthy();
    // sourceSnapshot đủ evidence
    expect(d.sourceSnapshot.materialInputs.length).toBe(2);
    expect(d.sourceSnapshot.laborInputs[0].role).toBe(ROLE_NAME);
    expect(d.sourceSnapshot.laborInputs[0].fee).toBe(300000);
    expect(d.sourceSnapshot.overheadInput.method).toBe("PER_MINUTE");
  });

  it("J+K+L immutable: đổi Product.cost / SOP quantity / EmployeeRoleFee sau publish → v1 KHÔNG đổi", async () => {
    await asWriter();
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await publish(id);
    const beforeTotal = Number((await rj(await get(id))).data.totalEstimatedCost); // 1,160k

    // J: đổi giá vốn Cleanser 100k→999k
    await prisma.spaProduct.update({ where: { id: PROD_A }, data: { cost: 999000 } });
    // K: đổi SOP quantity của bước 1 (5→50)
    const step0 = await prisma.serviceStep.findFirst({ where: { serviceId: SVC, sortOrder: 0 }, include: { products: true } });
    await prisma.serviceStepProduct.update({ where: { id: step0!.products[0].id }, data: { quantity: 50 } });
    await prisma.service.update({ where: { id: SVC }, data: { version: { increment: 1 } } });
    // L: đổi EmployeeRoleFee 300k→900k (bản mới)
    const emp = await prisma.employee.findFirst({ where: { roles: { has: ROLE_NAME } } });
    await prisma.employeeRoleFee.updateMany({ where: { employeeId: emp!.id, role: ROLE_NAME }, data: { isActive: false } });
    await prisma.employeeRoleFee.create({ data: { employeeId: emp!.id, role: ROLE_NAME, fee: 900000, effectiveFrom: new Date("2020-01-01"), isActive: true } });

    const after = (await rj(await get(id))).data;
    expect(Number(after.totalEstimatedCost)).toBe(beforeTotal); // BẤT BIẾN
    expect(Number(after.computedMaterialCost)).toBe(650000);
    expect(Number(after.laborCost)).toBe(300000);
    // snapshot cũng giữ nguyên fee/qty cũ
    expect(after.sourceSnapshot.laborInputs[0].fee).toBe(300000);
    expect(after.sourceSnapshot.materialInputs.find((m: any) => m.productId === PROD_A).qty).toBe(5);
  });

  it("M new draft lấy nguồn MỚI sau khi thay đổi (create v2 & recalculate)", async () => {
    await asWriter();
    const id1 = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await publish(id1);
    // đổi giá vốn Cleanser 100k→200k (material +5×100k = +500k)
    await prisma.spaProduct.update({ where: { id: PROD_A }, data: { cost: 200000 } });
    // v2 draft
    const v2 = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data;
    expect(v2.version).toBe(2);
    expect(Number(v2.computedMaterialCost)).toBe(5 * 200000 + 3 * 50000); // 1,150k
    // recalculate v2 sau khi đổi tiếp
    await prisma.spaProduct.update({ where: { id: PROD_B }, data: { cost: 60000 } }); // +3×10k=30k
    const r = (await rj(await recalc(v2.id))).data;
    expect(Number(r.computedMaterialCost)).toBe(5 * 200000 + 3 * 60000); // 1,180k
  });

  it("N published edit blocked (PATCH/recalculate → 409)", async () => {
    await asWriter();
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await publish(id);
    expect((await patch(id, { equipmentCost: 5 })).status).toBe(409);
    expect((await recalc(id)).status).toBe(409);
  });

  it("O+P finance mask: finance thấy số; non-finance nhận null (kể cả sourceSnapshot)", async () => {
    await asWriter();
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await publish(id);
    // O finance
    const f = (await rj(await get(id))).data;
    expect(Number(f.totalEstimatedCost)).toBe(1160000);
    expect(f.sourceSnapshot).not.toBeNull();
    // P non-finance (có pricefloor.read, KHÔNG finance.read)
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const nf = (await rj(await get(id))).data;
    expect(nf.totalEstimatedCost).toBeNull();
    expect(nf.finalMaterialCost).toBeNull();
    expect(nf.laborCost).toBeNull();
    expect(nf.sourceSnapshot).toBeNull();
    // list cũng mask
    const nfList = (await rj(await listGet(SVC))).data;
    expect(nfList[0].totalEstimatedCost).toBeNull();
  });

  it("Q RBAC: ẩn danh → 401; thiếu pricefloor.write → 403 (POST); thiếu pricefloor.read → 403 (GET)", async () => {
    // ẩn danh
    jar.clear();
    expect((await create({ serviceId: SVC, ...baseInputs })).status).toBe(401);
    expect((await listGet(SVC)).status).toBe(401);
    // có read, thiếu write
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    expect((await create({ serviceId: SVC, ...baseInputs })).status).toBe(403);
    // thiếu read
    await login(await makeStaff([PERMISSIONS.CUSTOMER_READ]));
    expect((await listGet(SVC)).status).toBe(403);
  });

  it("R audit: CREATED + PUBLISHED + OVERRIDE_CHANGED được ghi, không lộ secret", async () => {
    await asWriter();
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await patch(id, { materialOverride: 400000, materialOverrideReason: "Giảm giá NCC" });
    await publish(id);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("SERVICE_COSTING_CREATED");
    expect(actions).toContain("SERVICE_COSTING_OVERRIDE_CHANGED");
    expect(actions).toContain("SERVICE_COSTING_PUBLISHED");
    const all = JSON.stringify(await prisma.auditLog.findMany({ where: { entityId: id } }));
    expect(all).not.toMatch(/matkhau123|passwordHash/);
  });

  it("S legacy: tạo costing KHÔNG ghi ngược Service.expectedCost / floor / materialStandard", async () => {
    await asWriter();
    const before = await prisma.service.findUnique({ where: { id: SVC }, select: { expectedCost: true } });
    const id = (await rj(await create({ serviceId: SVC, ...baseInputs }))).data.id;
    await publish(id);
    const after = await prisma.service.findUnique({ where: { id: SVC }, select: { expectedCost: true } });
    expect(after!.expectedCost).toEqual(before!.expectedCost); // không đổi (null)
    expect(await prisma.servicePriceFloor.count({ where: { serviceId: SVC } })).toBe(0);
    expect(await prisma.servicePriceFloorVersion.count({ where: { serviceId: SVC } })).toBe(0);
    expect(await prisma.serviceMaterialStandard.count({ where: { serviceId: SVC } })).toBe(0);
  });

  it("warnings: SP thiếu cost + vai trò chưa có phí → cảnh báo rõ (không bịa số)", async () => {
    await asWriter();
    // Thêm bước có SP không cost + vai trò không có nhân sự
    const noCost = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "KhôngGiá", productType: "PROFESSIONAL", cost: null } });
    const svc2 = await prisma.service.create({
      data: { code: uniq("DV"), name: "SV2", durationMinutes: 30, staffRequirements: [{ role: "VaiTròLạ", quantity: 1 }],
        steps: { create: [{ sortOrder: 0, name: "B", products: { create: [{ spaProductId: noCost.id, name: "KhôngGiá", quantity: 2, unit: "ml", sortOrder: 0 }] } }] } } });
    const d = (await rj(await create({ serviceId: svc2.id }))).data;
    expect(Number(d.computedMaterialCost)).toBe(0); // SP thiếu cost không cộng
    expect(Number(d.laborCost)).toBe(0);
    expect(Array.isArray(d.warnings)).toBe(true);
    expect(d.warnings.join(" ")).toMatch(/giá vốn/);
    expect(d.warnings.join(" ")).toMatch(/phí/);
  });
});
