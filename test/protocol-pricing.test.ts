// =============================================================================
// PRICING / COSTING — PH5: Protocol / Package pricing. Test HTTP+lib trên Postgres.
// Bao phủ A–X (PH5 §32): package costing (required-only) · optional semantics ·
// package-specific · floor/recommended MARGIN · PriceRule PACKAGE · retail compare ·
// proposal integration · immutability · legacy · finance mask · RBAC · audit.
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
import { GET as costListRaw, POST as costCreateRaw } from "@/app/api/protocol-costings/route";
import { GET as costGetRaw } from "@/app/api/protocol-costings/[id]/route";
import { POST as costPublishRaw } from "@/app/api/protocol-costings/[id]/publish/route";
import { POST as floorCreateRaw } from "@/app/api/protocol-floor-prices/route";
import { POST as floorPublishRaw } from "@/app/api/protocol-floor-prices/[id]/publish/route";
import { POST as recCreateRaw } from "@/app/api/protocol-recommended-prices/route";
import { POST as recPublishRaw } from "@/app/api/protocol-recommended-prices/[id]/publish/route";
import { createCostingVersion, publishCostingVersion } from "@/lib/service-costing";

const costCreate = (body: unknown) => costCreateRaw(new Request("http://t/api/protocol-costings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const costList = (pid: string) => costListRaw(new Request("http://t/api/protocol-costings?protocolId=" + pid), {} as any);
const costGet = (id: string) => costGetRaw(new Request("http://t/api/protocol-costings/" + id), { params: { id } } as any);
const costPublish = (id: string) => costPublishRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);
const floorCreate = (body: unknown) => floorCreateRaw(new Request("http://t/api/protocol-floor-prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const floorPublish = (id: string) => floorPublishRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);
const recCreate = (body: unknown) => recCreateRaw(new Request("http://t/api/protocol-recommended-prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const recPublish = (id: string) => recPublishRaw(new Request("http://t/x", { method: "POST" }), { params: { id } } as any);

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { const j = t ? JSON.parse(t) : null; return j && "data" in j ? j.data : j; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("ppr")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.35.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
async function asManager() { await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ])); }

async function svcWithCosting(standard: number, cost: number) {
  const s = await prisma.service.create({ data: { code: uniq("DV"), name: uniq("S"), standardPrice: standard, durationMinutes: 30 } });
  const { version } = await createCostingVersion({ serviceId: s.id, equipmentCost: cost });
  await publishCostingVersion(version.id, "x"); // totalEstimatedCost = cost
  return s;
}
// Protocol SERVICES: DMK(1.5M,req) + Laser(1.2M,req) + Recovery(0.4M,optional)
async function seedProtocol(opts: { recoveryPublished?: boolean } = {}) {
  const dmk = await svcWithCosting(3_000_000, 1_500_000);
  const laser = await svcWithCosting(2_500_000, 1_200_000);
  const rec = opts.recoveryPublished === false
    ? await prisma.service.create({ data: { code: uniq("DV"), name: "Recovery", standardPrice: 900_000, durationMinutes: 20 } })
    : await svcWithCosting(900_000, 400_000);
  const proto = await prisma.brandProtocol.create({
    data: {
      code: uniq("PROTO"), name: "Combo sắc tố", kind: "INTERNAL", status: "ACTIVE", compositionMode: "SERVICES", version: 1,
      services: { create: [
        { serviceId: dmk.id, sortOrder: 0, isRequired: true },
        { serviceId: laser.id, sortOrder: 1, isRequired: true },
        { serviceId: rec.id, sortOrder: 2, isRequired: false },
      ] },
    },
  });
  return { proto, dmk, laser, rec };
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("PH5 · Protocol / Package pricing", () => {
  it("A+B+C+D+E costing: required summed (2.7M), optional bỏ, package-specific 0.1M → total 2.8M", async () => {
    await asManager();
    const { proto } = await seedProtocol();
    const res = await costCreate({ protocolId: proto.id, packageSpecificCost: 100_000, packageSpecificReason: "Kit dùng chung" });
    expect(res.status).toBe(201);
    const v = await rj(res);
    expect(Number(v.serviceCostTotal)).toBe(2_700_000); // B: chỉ required DMK+Laser
    expect(Number(v.packageSpecificCost)).toBe(100_000); // D
    expect(Number(v.totalEstimatedCost)).toBe(2_800_000); // E
    // C: component Recovery included=false
    const rec = v.components.find((c: any) => !c.required);
    expect(rec.included).toBe(false);
    expect(v.warnings.join(" ")).toMatch(/tùy chọn/);
  });

  it("F required component thiếu ServiceCosting PUBLISHED → 422", async () => {
    await asManager();
    // Recovery required nhưng chưa publish costing
    const dmk = await svcWithCosting(3_000_000, 1_500_000);
    const noCost = await prisma.service.create({ data: { code: uniq("DV"), name: "X", standardPrice: 1, durationMinutes: 10 } });
    const proto = await prisma.brandProtocol.create({ data: { code: uniq("PROTO"), name: "P", kind: "INTERNAL", compositionMode: "SERVICES", services: { create: [{ serviceId: dmk.id, sortOrder: 0, isRequired: true }, { serviceId: noCost.id, sortOrder: 1, isRequired: true }] } } });
    expect((await costCreate({ protocolId: proto.id })).status).toBe(422);
  });

  it("G+H publish immutable: snapshot component + đổi ServiceCosting sau → package v1 KHÔNG đổi", async () => {
    await asManager();
    const { proto, dmk } = await seedProtocol();
    const id = (await rj(await costCreate({ protocolId: proto.id, packageSpecificCost: 100_000, packageSpecificReason: "kit" }))).id;
    await costPublish(id);
    const before = await rj(await costGet(id));
    expect(before.sourceSnapshot.components.length).toBe(3);
    expect(before.sourceSnapshot.components.find((c: any) => c.required)?.serviceCostingVersionId).toBeTruthy();
    // Publish ServiceCosting v2 cho DMK (cost khác)
    const { version: cv2 } = await createCostingVersion({ serviceId: dmk.id, equipmentCost: 9_000_000 });
    await publishCostingVersion(cv2.id, "x");
    const after = await rj(await costGet(id));
    expect(Number(after.totalEstimatedCost)).toBe(2_800_000); // bất biến
    expect(Number(after.serviceCostTotal)).toBe(2_700_000);
  });

  it("I package floor MARGIN: cost 2.8M biên 30% → 4.0M", async () => {
    await asManager();
    const { proto } = await seedProtocol();
    const cid = (await rj(await costCreate({ protocolId: proto.id, packageSpecificCost: 100_000, packageSpecificReason: "kit" }))).id;
    await costPublish(cid);
    const f = await rj(await floorCreate({ protocolId: proto.id, protocolCostingVersionId: cid, minMarginPercent: 30, roundingUnit: 1 }));
    expect(Number(f.floorPrice)).toBe(Math.ceil(2_800_000 / 0.7 - 1e-9)); // 4,000,000
  });

  it("J+K package recommended: target 40% → 2.8/0.6; target < floor margin → 422", async () => {
    await asManager();
    const { proto } = await seedProtocol();
    const cid = (await rj(await costCreate({ protocolId: proto.id, packageSpecificCost: 100_000, packageSpecificReason: "kit" }))).id;
    await costPublish(cid);
    const f = await rj(await floorCreate({ protocolId: proto.id, protocolCostingVersionId: cid, minMarginPercent: 30, roundingUnit: 1 }));
    await floorPublish(f.id);
    // K: target 20% < 30% → 422
    expect((await recCreate({ protocolId: proto.id, protocolCostingVersionId: cid, targetMarginPercent: 20 })).status).toBe(422);
    // J: target 40% OK
    const r = await rj(await recCreate({ protocolId: proto.id, protocolCostingVersionId: cid, targetMarginPercent: 40, roundingUnit: 1 }));
    expect(Number(r.calculatedRecommendedPrice)).toBe(Math.ceil(2_800_000 / 0.6 - 1e-9)); // 4,666,667
    expect(Number(r.floorPriceSnapshot)).toBe(4_000_000);
  });

  it("L+M package PriceRule STANDARD/VIP: resolvePackagePrice theo segment", async () => {
    const { resolvePackagePrice } = await import("@/lib/protocol-pricing");
    const { proto } = await seedProtocol();
    await prisma.priceRule.create({ data: { targetType: "PACKAGE", targetId: proto.id, priceType: "STANDARD", price: 5_000_000, isActive: true } });
    await prisma.priceRule.create({ data: { targetType: "PACKAGE", targetId: proto.id, priceType: "VIP", price: 4_700_000, isActive: true } });
    const std = await resolvePackagePrice(proto.id, { customerGroup: null });
    expect(std?.price).toBe(5_000_000);
    const vip = await resolvePackagePrice(proto.id, { customerGroup: "VIP" });
    expect(vip?.price).toBe(4_700_000);
  });

  it("N sum retail ≠ package (commercial comparison)", async () => {
    const { packageRetailComparison } = await import("@/lib/protocol-pricing");
    const { proto } = await seedProtocol();
    await prisma.priceRule.create({ data: { targetType: "PACKAGE", targetId: proto.id, priceType: "STANDARD", price: 5_000_000, isActive: true } });
    const cmp = await packageRetailComparison(proto.id);
    expect(cmp.sumRetail).toBe(3_000_000 + 2_500_000); // Σ required Service.standardPrice (DMK+Laser)
    expect(cmp.packagePrice).toBe(5_000_000);
    expect(cmp.saving).toBe(5_500_000 - 5_000_000);
  });

  it("O+P proposal BRAND_PROTOCOL: dùng package price + package floor (below-floor)", async () => {
    const { proposalOptionFloorTotal } = await import("@/lib/price-floor");
    const { resolveItemPricing } = await import("@/lib/pricing");
    await asManager();
    const { proto } = await seedProtocol();
    const cid = (await rj(await costCreate({ protocolId: proto.id, packageSpecificCost: 100_000, packageSpecificReason: "kit" }))).id;
    await costPublish(cid);
    const f = await rj(await floorCreate({ protocolId: proto.id, protocolCostingVersionId: cid, minMarginPercent: 30, roundingUnit: 1 }));
    await floorPublish(f.id); // floor 4.0M
    await prisma.priceRule.create({ data: { targetType: "PACKAGE", targetId: proto.id, priceType: "STANDARD", price: 5_000_000, isActive: true } });
    // P: proposal item resolve package selling + protocol cost
    const pricing = await resolveItemPricing("BRAND_PROTOCOL", proto.id, null);
    expect(pricing.unitPrice).toBe(5_000_000); // PACKAGE rule
    expect(pricing.unitCost).toBe(2_800_000); // protocol costing total
    // O: below floor khi bán 3.5M < 4.0M
    const below = await proposalOptionFloorTotal([{ itemType: "BRAND_PROTOCOL", refId: proto.id, name: "Gói", quantity: 1, sessions: 1 }], 3_500_000);
    expect(below.floorApplicable).toBe(true);
    expect(below.floorTotal).toBe(4_000_000);
    expect(below.below).toBe(true);
    // bán ≥ floor → không below
    const okr = await proposalOptionFloorTotal([{ itemType: "BRAND_PROTOCOL", refId: proto.id, name: "Gói", quantity: 1, sessions: 1 }], 4_500_000);
    expect(okr.below).toBe(false);
  });

  it("S legacy protocol (LEGACY_STEPS) → package costing 422 (không ép)", async () => {
    await asManager();
    const legacy = await prisma.brandProtocol.create({ data: { code: uniq("PROTO"), name: "Legacy", kind: "INTERNAL", compositionMode: "LEGACY_STEPS", steps: { items: [{ name: "B1" }] } } });
    expect((await costCreate({ protocolId: legacy.id })).status).toBe(422);
  });

  it("T+U finance mask + RBAC: non-finance cost null; ẩn danh 401; thiếu write 403", async () => {
    await asManager();
    const { proto } = await seedProtocol();
    const id = (await rj(await costCreate({ protocolId: proto.id }))).id;
    await costPublish(id);
    // T non-finance
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const nf = await rj(await costGet(id));
    expect(nf.totalEstimatedCost).toBeNull();
    expect(nf.serviceCostTotal).toBeNull();
    expect(nf.sourceSnapshot).toBeNull();
    // U RBAC
    jar.clear();
    expect((await costCreate({ protocolId: proto.id })).status).toBe(401);
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    expect((await costCreate({ protocolId: proto.id })).status).toBe(403);
    await login(await makeStaff([PERMISSIONS.CUSTOMER_READ]));
    expect((await costList(proto.id)).status).toBe(403);
  });

  it("V audit: PROTOCOL_COSTING_CREATED/PUBLISHED + FLOOR_CREATED/PUBLISHED + RECOMMENDED", async () => {
    await asManager();
    const { proto } = await seedProtocol();
    const cid = (await rj(await costCreate({ protocolId: proto.id }))).id;
    await costPublish(cid);
    const f = await rj(await floorCreate({ protocolId: proto.id, protocolCostingVersionId: cid, minMarginPercent: 30 }));
    await floorPublish(f.id);
    const r = await rj(await recCreate({ protocolId: proto.id, protocolCostingVersionId: cid, targetMarginPercent: 40 }));
    await recPublish(r.id);
    const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
    for (const a of ["PROTOCOL_COSTING_CREATED", "PROTOCOL_COSTING_PUBLISHED", "PROTOCOL_FLOOR_CREATED", "PROTOCOL_FLOOR_PUBLISHED", "PROTOCOL_RECOMMENDED_CREATED", "PROTOCOL_RECOMMENDED_PUBLISHED"])
      expect(actions).toContain(a);
  });
});
