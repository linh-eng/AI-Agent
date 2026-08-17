// =============================================================================
// PRICING / COSTING — PH2: Floor Normalization + Costing Reference.
// Test tích hợp HTTP thật + lib trên Postgres. Bao phủ A–U (PH2 §26):
//   Floor v2 tạo từ Costing PUBLISHED · công thức MARGIN chuẩn · immutability ·
//   provenance V2_COSTING/LEGACY_V2/LEGACY_V1 · below-floor · finance mask · RBAC.
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
import { GET as floorDetailRaw, POST as floorCreateRaw } from "@/app/api/price-floors/[serviceId]/route";
import { POST as floorStatusRaw } from "@/app/api/price-floor-versions/[id]/status/route";
import { createCostingVersion, publishCostingVersion } from "@/lib/service-costing";
import { checkServicePriceFloor, proposalOptionFloorTotal, computeFloorPrice } from "@/lib/price-floor";
import { createFloorVersion } from "@/lib/price-floor-service";

const floorCreate = (serviceId: string, body: unknown) => floorCreateRaw(new Request("http://t/api/price-floors/" + serviceId, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { serviceId } } as any);
const floorDetail = (serviceId: string) => floorDetailRaw(new Request("http://t/api/price-floors/" + serviceId), { params: { serviceId } } as any);
const floorStatus = (id: string, body: unknown) => floorStatusRaw(new Request("http://t/api/price-floor-versions/" + id + "/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { id } } as any);

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { const j = t ? JSON.parse(t) : null; return j && "data" in j ? j.data : j; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("flr")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.32.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
async function asManager() { await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_APPROVE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ])); }

// Dịch vụ trần (không SOP/staff) → costing total = equipmentCost (kiểm soát chính xác).
async function makeService(standardPrice = 3_000_000) {
  return prisma.service.create({ data: { code: uniq("DV"), name: "DV Floor", standardPrice, durationMinutes: 60 } });
}
async function publishCosting(serviceId: string, equipmentCost: number) {
  const { version } = await createCostingVersion({ serviceId, equipmentCost });
  const { version: pub } = await publishCostingVersion(version.id, "seed");
  return pub; // totalEstimatedCost === equipmentCost
}
async function activate(versionId: string) {
  await floorStatus(versionId, { action: "submit" });
  await floorStatus(versionId, { action: "approve" });
  await floorStatus(versionId, { action: "activate" });
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("PH2 · Floor Normalization + Costing Reference", () => {
  it("A+B+C+H tạo Floor từ Costing PUBLISHED: MARGIN chuẩn + snapshot cost, không cost lines", async () => {
    await asManager();
    const svc = await makeService();
    const costing = await publishCosting(svc.id, 1_200_000);
    const res = await floorCreate(svc.id, { serviceCostingVersionId: costing.id, minMarginPercent: 30, roundingUnit: 1 });
    expect(res.status).toBe(201);
    const v = await rj(res);
    // B/C: MARGIN 1,200,000 / 0.70 = 1,714,285.714 → ceil(round=1) = 1,714,286
    expect(Number(v.floorPrice)).toBe(1_714_286);
    expect(Number(v.totalCost)).toBe(1_200_000);
    expect(v.costSource).toBe("COSTING_VERSION");
    expect(v.serviceCostingVersionId).toBe(costing.id);
    expect(Number(v.machineCost)).toBe(1_200_000); // equipment → MACHINE cột snapshot
    // H: KHÔNG có cost lines editable
    expect(await prisma.priceFloorCostLine.count({ where: { versionId: v.id } })).toBe(0);
  });

  it("B công thức MARGIN (pure): 1.4M/0.7 = 2.0M exact", () => {
    expect(computeFloorPrice({ totalCost: 1_400_000, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1 })).toBe(2_000_000);
  });

  it("D draft Costing bị từ chối (422)", async () => {
    await asManager();
    const svc = await makeService();
    const { version } = await createCostingVersion({ serviceId: svc.id, equipmentCost: 1_000_000 }); // DRAFT
    const res = await floorCreate(svc.id, { serviceCostingVersionId: version.id, minMarginPercent: 30 });
    expect(res.status).toBe(422);
  });

  it("E missing Costing → 404", async () => {
    await asManager();
    const svc = await makeService();
    expect((await floorCreate(svc.id, { serviceCostingVersionId: "khong-co", minMarginPercent: 30 })).status).toBe(404);
  });

  it("F+G immutable: Costing đổi/thêm v2 → Floor cũ giữ nguyên; Floor mới dùng Costing mới", async () => {
    await asManager();
    const svc = await makeService();
    const c1 = await publishCosting(svc.id, 1_200_000);
    const f1 = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c1.id, minMarginPercent: 30, roundingUnit: 1 }));
    const floor1 = Number(f1.floorPrice); // 1,714,286
    // publish costing v2 = 1.4M
    const c2 = await publishCosting(svc.id, 1_400_000);
    // Floor cũ KHÔNG đổi
    const f1db = await prisma.servicePriceFloorVersion.findUnique({ where: { id: f1.id } });
    expect(Number(f1db!.totalCost)).toBe(1_200_000);
    expect(Number(f1db!.floorPrice)).toBe(floor1);
    // Floor mới từ Costing v2
    const f2 = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c2.id, minMarginPercent: 30, roundingUnit: 1 }));
    expect(Number(f2.totalCost)).toBe(1_400_000);
    expect(Number(f2.floorPrice)).toBe(2_000_000);
    expect(f2.serviceCostingVersionId).toBe(c2.id);
  });

  it("K checkServicePriceFloor ưu tiên v2 từ Costing (source V2_COSTING)", async () => {
    await asManager();
    const svc = await makeService();
    const c1 = await publishCosting(svc.id, 1_000_000);
    const f = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c1.id, minMarginPercent: 30, roundingUnit: 1 }));
    await activate(f.id);
    const check = await checkServicePriceFloor(svc.id, 1_000_000);
    expect(check.hasFloor).toBe(true);
    expect(check.source).toBe("V2_COSTING");
    expect(check.serviceCostingVersionId).toBe(c1.id);
    expect(check.floorVersionId).toBe(f.id);
    // M below-floor: giá < floor → below true, shortfall đúng
    expect(check.below).toBe(true);
    expect(check.floorPrice).toBe(Number(f.floorPrice));
  });

  it("J legacy v2 (cost lines) vẫn hoạt động, không dính Costing (LEGACY_LINES)", async () => {
    await asManager();
    const svc = await makeService();
    const v = await createFloorVersion({ serviceId: svc.id, minMarginPercent: 30, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_000_000, calcType: "FIXED" }] });
    expect(v.costSource).toBe("LEGACY_LINES");
    expect(v.serviceCostingVersionId).toBeNull();
    expect(Number(v.totalCost)).toBe(1_000_000);
    // provenance khi active = LEGACY_V2
    await activate(v.id);
    const check = await checkServicePriceFloor(svc.id, 1);
    expect(check.source).toBe("LEGACY_V2");
  });

  it("I+L legacy v1 fallback: chỉ có v1 → source LEGACY_V1; v1 row bất biến", async () => {
    await asManager();
    const svc = await makeService();
    const v1 = await prisma.servicePriceFloor.create({ data: { serviceId: svc.id, materialCost: 500_000, laborCost: 500_000, minMarginPercent: 30 } });
    const check = await checkServicePriceFloor(svc.id, 100);
    expect(check.hasFloor).toBe(true);
    expect(check.source).toBe("LEGACY_V1");
    // v1 = totalCost 1,000,000 × (1+30%) [MARKUP cũ — KHÔNG rewrite sang margin]
    expect(check.floorPrice).toBe(1_300_000);
    const v1db = await prisma.servicePriceFloor.findUnique({ where: { id: v1.id } });
    expect(Number(v1db!.materialCost)).toBe(500_000); // không đổi
  });

  it("M+N proposal below-floor dùng Floor mới (proposalOptionFloorTotal)", async () => {
    await asManager();
    const svc = await makeService();
    const c1 = await publishCosting(svc.id, 1_000_000);
    const f = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c1.id, minMarginPercent: 30, roundingUnit: 1 }));
    await activate(f.id);
    const floorPrice = Number(f.floorPrice); // 1,428,572
    // agreedPrice thấp hơn floor → below true, floorTotal = floorPrice
    const below = await proposalOptionFloorTotal([{ itemType: "SERVICE", refId: svc.id, name: "DV", quantity: 1, sessions: 1 }], floorPrice - 100_000);
    expect(below.floorApplicable).toBe(true);
    expect(below.floorTotal).toBe(floorPrice);
    expect(below.below).toBe(true);
    // agreedPrice ≥ floor → không below
    const ok = await proposalOptionFloorTotal([{ itemType: "SERVICE", refId: svc.id, name: "DV", quantity: 1, sessions: 1 }], floorPrice + 100_000);
    expect(ok.below).toBe(false);
  });

  it("edge (§25): margin âm → 422; margin ≥100 → 422; costing khác dịch vụ → 422", async () => {
    await asManager();
    const svc = await makeService();
    const other = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    expect((await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: -5 })).status).toBe(422);
    expect((await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: 100 })).status).toBe(422);
    // costing thuộc svc nhưng tạo cho `other` → 422 (không thuộc dịch vụ)
    expect((await floorCreate(other.id, { serviceCostingVersionId: c.id, minMarginPercent: 30 })).status).toBe(422);
  });

  it("P+Q finance mask + RBAC: non-finance không thấy totalCost; ẩn danh 401; thiếu write 403", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const f = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: 30, roundingUnit: 1 }));
    await activate(f.id);
    // P: non-finance (chỉ pricefloor.read) — totalCost null, publishedCostings.totalEstimatedCost null; floorPrice hiện (guardrail)
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const d = await rj(await floorDetail(svc.id));
    const ver = d.versions.find((x: any) => x.id === f.id);
    expect(ver.totalCost).toBeNull();
    expect(ver.breakdown).toBeNull();
    expect(Number(ver.floorPrice)).toBe(Number(f.floorPrice));
    // Q: ẩn danh → 401
    jar.clear();
    expect((await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: 30 })).status).toBe(401);
    // thiếu write → 403
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    expect((await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: 30 })).status).toBe(403);
  });

  it("R audit: PRICE_FLOOR_CREATED + PRICE_FLOOR_COSTING_LINKED + PRICE_FLOOR_PUBLISHED", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const f = await rj(await floorCreate(svc.id, { serviceCostingVersionId: c.id, minMarginPercent: 30 }));
    await activate(f.id);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: f.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("PRICE_FLOOR_CREATED");
    expect(actions).toContain("PRICE_FLOOR_COSTING_LINKED");
    expect(actions).toContain("PRICE_FLOOR_PUBLISHED");
  });
});
