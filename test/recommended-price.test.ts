// =============================================================================
// PRICING / COSTING — PH3: Recommended Price / Target Margin. Test tích hợp HTTP+lib
// trên Postgres. Bao phủ A–V (PH3 §23): tạo từ Costing PUBLISHED · công thức target
// margin · ràng buộc Floor · immutability · so sánh Floor/Standard · finance mask · RBAC.
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
import { GET as listGetRaw, POST as createRaw } from "@/app/api/recommended-prices/route";
import { GET as getRaw, PATCH as patchRaw } from "@/app/api/recommended-prices/[id]/route";
import { POST as publishRaw } from "@/app/api/recommended-prices/[id]/publish/route";
import { POST as recalcRaw } from "@/app/api/recommended-prices/[id]/recalculate/route";
import { createCostingVersion, publishCostingVersion } from "@/lib/service-costing";
import { createFloorVersionFromCosting } from "@/lib/price-floor-service";
import { transitionFloorVersion } from "@/lib/price-floor-service";
import { computeRecommendedPrice } from "@/lib/recommended-price";

const listGet = (serviceId: string) => listGetRaw(new Request("http://t/api/recommended-prices?serviceId=" + serviceId), {} as any);
const create = (body: unknown) => createRaw(new Request("http://t/api/recommended-prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const get = (id: string) => getRaw(new Request("http://t/api/recommended-prices/" + id), { params: { id } } as any);
const patch = (id: string, body: unknown) => patchRaw(new Request("http://t/api/recommended-prices/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { id } } as any);
const publish = (id: string) => publishRaw(new Request("http://t/api/recommended-prices/" + id + "/publish", { method: "POST" }), { params: { id } } as any);
const recalc = (id: string) => recalcRaw(new Request("http://t/api/recommended-prices/" + id + "/recalculate", { method: "POST" }), { params: { id } } as any);

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { const j = t ? JSON.parse(t) : null; return j && "data" in j ? j.data : j; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("rec")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.33.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
async function asManager() { await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_APPROVE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ])); }

async function makeService(standardPrice = 1_800_000) {
  return prisma.service.create({ data: { code: uniq("DV"), name: "DV Rec", standardPrice, durationMinutes: 60 } });
}
async function publishCosting(serviceId: string, equipmentCost: number) {
  const { version } = await createCostingVersion({ serviceId, equipmentCost });
  const { version: pub } = await publishCostingVersion(version.id, "seed");
  return pub; // totalEstimatedCost === equipmentCost
}
async function activeFloor(serviceId: string, costingId: string, minMargin: number) {
  const f = await createFloorVersionFromCosting({ serviceId, serviceCostingVersionId: costingId, minMarginPercent: minMargin, roundingUnit: 1 });
  await transitionFloorVersion(f.id, "submit", { canApprove: true });
  await transitionFloorVersion(f.id, "approve", { actor: "x", canApprove: true });
  await transitionFloorVersion(f.id, "activate", { actor: "x", canApprove: true });
  return f;
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("PH3 · Recommended Price / Target Margin", () => {
  it("A+C+H tạo từ Costing PUBLISHED: target 40% → cost/0.6; rounding đúng", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_200_000);
    const res = await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40, roundingUnit: 1 });
    expect(res.status).toBe(201);
    const v = await rj(res);
    expect(v.status).toBe("DRAFT");
    expect(Number(v.calculatedRecommendedPrice)).toBe(2_000_000); // 1.2M/0.6
    expect(Number(v.costSnapshot)).toBe(1_200_000);
    // rounding 1000
    const v2 = await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 30, roundingUnit: 1000 }));
    expect(Number(v2.calculatedRecommendedPrice)).toBe(1_715_000); // ceil(1,714,285.7/1000)*1000
  });

  it("B published costing required: DRAFT costing → 422; costing khác dịch vụ → 422", async () => {
    await asManager();
    const svc = await makeService();
    const other = await makeService();
    const { version: draft } = await createCostingVersion({ serviceId: svc.id, equipmentCost: 1_000_000 });
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: draft.id, targetMarginPercent: 40 })).status).toBe(422);
    const c = await publishCosting(svc.id, 1_000_000);
    expect((await create({ serviceId: other.id, serviceCostingVersionId: c.id, targetMarginPercent: 40 })).status).toBe(422);
  });

  it("D+E target margin âm → 422; ≥100 → 422", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: -1 })).status).toBe(422);
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 100 })).status).toBe(422);
  });

  it("F+G ràng buộc Floor: target < minMargin floor → 422; target ≥ floor → OK, recommended ≥ floor", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_200_000);
    const f = await activeFloor(svc.id, c.id, 30); // floorPrice = 1,714,286
    // F: target 20% < 30% → 422
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 20 })).status).toBe(422);
    // G: target 40% ≥ 30% → OK và recommended (2,000,000) ≥ floor
    const v = await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40, roundingUnit: 1 }));
    expect(Number(v.calculatedRecommendedPrice)).toBe(2_000_000);
    expect(Number(v.floorPriceSnapshot)).toBe(Number(f.floorPrice));
    expect(Number(v.calculatedRecommendedPrice)).toBeGreaterThanOrEqual(Number(f.floorPrice));
    // target 30% (= floor margin) → recommended = floorPrice → OK (≥)
    const eq = await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 30, roundingUnit: 1 }));
    expect(Number(eq.calculatedRecommendedPrice)).toBe(Number(f.floorPrice));
  });

  it("I publish freeze: DRAFT → PUBLISHED", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40, roundingUnit: 1 }))).id;
    const p = await rj(await publish(id));
    expect(p.status).toBe("PUBLISHED");
    expect(p.publishedAt).toBeTruthy();
  });

  it("J+K immutable: đổi Product cost / publish Costing v2 sau → Recommended v1 KHÔNG đổi", async () => {
    await asManager();
    const svc = await makeService();
    const c1 = await publishCosting(svc.id, 1_200_000);
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c1.id, targetMarginPercent: 40, roundingUnit: 1 }))).id;
    await publish(id);
    const before = Number((await rj(await get(id))).calculatedRecommendedPrice); // 2,000,000
    // K: publish costing v2 (khác total)
    await publishCosting(svc.id, 1_400_000);
    const after = await rj(await get(id));
    expect(Number(after.calculatedRecommendedPrice)).toBe(before);
    expect(Number(after.costSnapshot)).toBe(1_200_000); // snapshot cũ
  });

  it("L new Recommended dùng Costing MỚI", async () => {
    await asManager();
    const svc = await makeService();
    const c1 = await publishCosting(svc.id, 1_200_000);
    const v1 = await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c1.id, targetMarginPercent: 40, roundingUnit: 1 }));
    await publish(v1.id);
    const c2 = await publishCosting(svc.id, 1_400_000);
    const v2 = await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c2.id, targetMarginPercent: 40, roundingUnit: 1 }));
    expect(v2.version).toBe(2);
    expect(Number(v2.costSnapshot)).toBe(1_400_000);
    expect(Number(v2.calculatedRecommendedPrice)).toBe(Math.ceil(1_400_000 / 0.6 - 1e-9)); // 2,333,334
    expect(Number(v2.calculatedRecommendedPrice)).toBe(computeRecommendedPrice(1_400_000, 40, 1));
  });

  it("M published edit blocked (PATCH/recalculate → 409)", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40 }))).id;
    await publish(id);
    expect((await patch(id, { targetMarginPercent: 45 })).status).toBe(409);
    expect((await recalc(id)).status).toBe(409);
  });

  it("N+O+P không double-write: Service.standardPrice / PriceRule / Floor KHÔNG đổi", async () => {
    await asManager();
    const svc = await makeService(1_800_000);
    const c = await publishCosting(svc.id, 1_200_000);
    const f = await activeFloor(svc.id, c.id, 30);
    const floorBefore = await prisma.servicePriceFloorVersion.findUnique({ where: { id: f.id } });
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40, roundingUnit: 1 }))).id;
    await publish(id);
    const svcAfter = await prisma.service.findUnique({ where: { id: svc.id }, select: { standardPrice: true } });
    expect(Number(svcAfter!.standardPrice)).toBe(1_800_000); // N
    expect(await prisma.priceRule.count({ where: {} })).toBe(0); // O
    const floorAfter = await prisma.servicePriceFloorVersion.findUnique({ where: { id: f.id } });
    expect(Number(floorAfter!.floorPrice)).toBe(Number(floorBefore!.floorPrice)); // P
    expect(floorAfter!.status).toBe(floorBefore!.status);
  });

  it("Q finance mask: non-finance → targetMargin/costSnapshot null; recommendedPrice hiển thị", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40, roundingUnit: 1 }))).id;
    await publish(id);
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const nf = await rj(await get(id));
    expect(nf.targetMarginPercent).toBeNull();
    expect(nf.costSnapshot).toBeNull();
    expect(Number(nf.calculatedRecommendedPrice)).toBeGreaterThan(0); // giá đề xuất vẫn hiện (guardrail)
    const list = await rj(await listGet(svc.id));
    expect(list[0].targetMarginPercent).toBeNull();
  });

  it("R RBAC: ẩn danh → 401; thiếu write → 403; thiếu read → 403", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    jar.clear();
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40 })).status).toBe(401);
    expect((await listGet(svc.id)).status).toBe(401);
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    expect((await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40 })).status).toBe(403);
    await login(await makeStaff([PERMISSIONS.CUSTOMER_READ]));
    expect((await listGet(svc.id)).status).toBe(403);
  });

  it("S audit: CREATED + RECALCULATED + PUBLISHED", async () => {
    await asManager();
    const svc = await makeService();
    const c = await publishCosting(svc.id, 1_000_000);
    const id = (await rj(await create({ serviceId: svc.id, serviceCostingVersionId: c.id, targetMarginPercent: 40 }))).id;
    await patch(id, { targetMarginPercent: 45 });
    await publish(id);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("RECOMMENDED_PRICE_CREATED");
    expect(actions).toContain("RECOMMENDED_PRICE_RECALCULATED");
    expect(actions).toContain("RECOMMENDED_PRICE_PUBLISHED");
  });
});
