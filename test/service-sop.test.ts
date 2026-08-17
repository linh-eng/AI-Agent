// =============================================================================
// Redesign P1 — Service SOP chuẩn hóa: test tích hợp HTTP thật trên Postgres.
// §25 (Service DMK 5 bước, Enzyme 3 option) + §9 (version/snapshot bất biến).
// Bao phủ: create/read/edit/reorder · product+quantity · variant · technology ·
// warnings/chống chỉ định · version bump · snapshot immutability · finance mask · RBAC.
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
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as svcPostRaw } from "@/app/api/services/route";
import { GET as svcGetRaw, PATCH as svcPatchRaw } from "@/app/api/services/[id]/route";

const svcPost = (r: Request) => svcPostRaw(r, {} as any);
const svcGet = (id: string) => svcGetRaw(new Request("http://t/api/services/" + id), { params: { id } } as any);
const svcPatch = (id: string, body: unknown) => svcPatchRaw(new Request("http://t/api/services/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: { id } } as any);

let ip = 0;
function req(url: string, method: string, body?: unknown) { return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("svc")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.30.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}

// Fixtures dùng chung
let PROD_CLEANSER = "", PROD_ENZ1 = "", PROD_ENZ2 = "", TECH_LASER = "";
async function seedRefs() {
  const c = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Cleanser X", productType: "PROFESSIONAL", cost: 100000 } });
  const e1 = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Enzyme #1", productType: "PROFESSIONAL", cost: 200000 } });
  const e2 = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Enzyme #2", productType: "PROFESSIONAL", cost: 250000 } });
  const t = await prisma.technology.create({ data: { code: uniq("TECH"), name: "Laser Pico" } });
  PROD_CLEANSER = c.id; PROD_ENZ1 = e1.id; PROD_ENZ2 = e2.id; TECH_LASER = t.id;
}

// SOP DMK: 5 bước; bước Enzyme có 3 phương án
function dmkPayload() {
  return {
    name: "DMK Enzyme Treatment",
    status: "ACTIVE",
    standardPrice: 1500000,
    expectedCost: 600000,
    steps: [
      { name: "Làm sạch", durationMinutes: 5, technique: "Massage nhẹ", products: [{ spaProductId: PROD_CLEANSER, name: "Cleanser X", quantity: 2, unit: "ml", isRequired: true }] },
      { name: "Detox", durationMinutes: 10, products: [{ name: "Detox serum", quantity: 3, unit: "ml" }], technologies: [{ technologyId: TECH_LASER, suggestedParameters: { power: "low" } }] },
      { name: "Build", durationMinutes: 8 },
      { name: "Enzyme", durationMinutes: 45, warnings: "Da đang kích ứng nặng: không thực hiện", conditionText: "Chọn Enzyme theo tình trạng da", options: [
        { name: "Enzyme #1", selectMode: "SINGLE_SELECT", isDefault: false, spaProductId: PROD_ENZ1, quantity: 4, unit: "g", conditionText: "Da thường" },
        { name: "Enzyme #2", selectMode: "SINGLE_SELECT", isDefault: true, spaProductId: PROD_ENZ2, quantity: 5, unit: "g", conditionText: "Da nám" },
        { name: "Enzyme #3", selectMode: "SINGLE_SELECT", isDefault: false, quantity: 6, unit: "g", conditionText: "Da dày sừng" },
      ] },
      { name: "Recovery", durationMinutes: 15 },
    ],
  };
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); await seedRefs(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Redesign P1 · Service SOP (bước · sản phẩm · biến thể · version)", () => {
  it("§25 create: 5 bước + sản phẩm/định mức + option + công nghệ → persist DB đúng", async () => {
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const res = await svcPost(req("http://t/api/services", "POST", dmkPayload()));
    expect(res.status).toBe(201);
    const id = (await rj(res)).data.id;
    // Đọc thẳng DB
    const db = await prisma.service.findUnique({ where: { id }, include: { steps: { orderBy: { sortOrder: "asc" }, include: { products: true, options: true, technologies: true } } } });
    expect(db!.version).toBe(1);
    expect(db!.steps.map((s) => s.name)).toEqual(["Làm sạch", "Detox", "Build", "Enzyme", "Recovery"]);
    // sortOrder liên tục 0..4
    expect(db!.steps.map((s) => s.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    // Bước 1 có product link catalog + quantity/unit
    const s0 = db!.steps[0];
    expect(s0.products[0].spaProductId).toBe(PROD_CLEANSER);
    expect(Number(s0.products[0].quantity)).toBe(2);
    expect(s0.products[0].unit).toBe("ml");
    // Bước Detox có technology
    expect(db!.steps[1].technologies[0].technologyId).toBe(TECH_LASER);
    // Bước Enzyme: 3 option, 1 default, warnings
    const enz = db!.steps[3];
    expect(enz.options.length).toBe(3);
    expect(enz.options.filter((o) => o.isDefault).length).toBe(1);
    expect(enz.options.find((o) => o.isDefault)!.name).toBe("Enzyme #2");
    expect(enz.warnings).toMatch(/kích ứng/);
  });

  it("§25 read: GET trả steps theo thứ tự + sopDuration = tổng thời lượng", async () => {
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const id = (await rj(await svcPost(req("http://t/api/services", "POST", dmkPayload())))).data.id;
    const d = (await rj(await svcGet(id))).data;
    expect(d.steps.map((s: any) => s.name)).toEqual(["Làm sạch", "Detox", "Build", "Enzyme", "Recovery"]);
    expect(d.sopDuration).toBe(5 + 10 + 8 + 45 + 15); // 83
    expect(d.steps[3].options.length).toBe(3);
  });

  it("§25 edit + reorder: đảo thứ tự bước + sửa → version TĂNG (v1→v2), sortOrder mới đúng", async () => {
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const id = (await rj(await svcPost(req("http://t/api/services", "POST", dmkPayload())))).data.id;
    // Đảo: Recovery lên đầu, bỏ Build
    const patch = { steps: [
      { name: "Recovery", durationMinutes: 15 },
      { name: "Làm sạch", durationMinutes: 5 },
      { name: "Enzyme", durationMinutes: 45, options: [{ name: "Enzyme #2", isDefault: true, quantity: 5, unit: "g" }] },
    ] };
    const res = await svcPatch(id, patch);
    expect(res.status).toBe(200);
    const d = (await rj(await svcGet(id))).data;
    expect(d.version).toBe(2); // bump
    expect(d.steps.map((s: any) => s.name)).toEqual(["Recovery", "Làm sạch", "Enzyme"]);
    expect(d.steps.map((s: any) => s.sortOrder)).toEqual([0, 1, 2]);
    // audit SOP change có before/after
    const aud = await prisma.auditLog.findFirst({ where: { action: "SERVICE_SOP_CHANGED", entityId: id }, orderBy: { createdAt: "desc" } });
    expect((aud!.changes as any).version).toMatchObject({ before: 1, after: 2 });
  });

  it("§9 snapshot bất biến: chụp SOP v1 → sửa thành v2 → snapshot v1 KHÔNG đổi", async () => {
    const { sopSnapshot } = await import("@/lib/service-sop");
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const id = (await rj(await svcPost(req("http://t/api/services", "POST", dmkPayload())))).data.id;
    // Chụp snapshot v1 (như Actual Session sẽ làm ở P4)
    const v1 = await prisma.service.findUnique({ where: { id }, include: { steps: { orderBy: { sortOrder: "asc" }, include: { products: true, options: true, technologies: { include: { technology: true } } } } } });
    const snap1 = sopSnapshot(v1);
    expect(snap1.version).toBe(1);
    const enzDefaultV1 = snap1.steps[3].options.find((o: any) => o.isDefault);
    expect(enzDefaultV1.quantity).toBe(5); // Enzyme #2 = 5g

    // Sửa Service: Enzyme default đổi số lượng 5→8, bỏ 1 bước → v2
    await svcPatch(id, { steps: [
      { name: "Enzyme", durationMinutes: 45, options: [{ name: "Enzyme #2", isDefault: true, quantity: 8, unit: "g" }] },
    ] });
    const now = (await rj(await svcGet(id))).data;
    expect(now.version).toBe(2);
    expect(Number(now.steps[0].options[0].quantity)).toBe(8); // trạng thái mới = 8g

    // Snapshot v1 vẫn 5g và vẫn 5 bước → BẤT BIẾN
    expect(snap1.version).toBe(1);
    expect(snap1.steps.length).toBe(5);
    expect(snap1.steps[3].options.find((o: any) => o.isDefault).quantity).toBe(5);
  });

  it("validation: quantity phải > 0 (0/âm → 422); unit bắt buộc", async () => {
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE]));
    const bad = { name: "X", steps: [{ name: "B", products: [{ name: "P", quantity: 0, unit: "ml" }] }] };
    expect((await svcPost(req("http://t/api/services", "POST", bad))).status).toBe(422);
    const bad2 = { name: "X", steps: [{ name: "B", products: [{ name: "P", quantity: 2 }] }] }; // thiếu unit
    expect((await svcPost(req("http://t/api/services", "POST", bad2))).status).toBe(422);
  });

  it("§19 finance: sopMaterialCost null với non-finance, có giá trị với finance.read", async () => {
    // tạo bằng người có write
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const id = (await rj(await svcPost(req("http://t/api/services", "POST", dmkPayload())))).data.id;
    // non-finance đọc
    await login(await makeStaff([PERMISSIONS.SERVICE_READ]));
    const nf = (await rj(await svcGet(id))).data;
    expect(nf.sopMaterialCost).toBeNull();
    expect(nf.expectedCost).toBeNull(); // giá vốn cũng mask
    // finance đọc
    await login(await makeStaff([PERMISSIONS.SERVICE_READ, PERMISSIONS.FINANCE_READ]));
    const f = (await rj(await svcGet(id))).data;
    // = cleanser 2×100k + Enzyme step products (chỉ product trực tiếp, option không cộng) = 200k (Làm sạch)
    expect(f.sopMaterialCost).not.toBeNull();
    expect(f.sopMaterialCost).toBeGreaterThan(0);
    expect(f.expectedCost).not.toBeNull();
  });

  it("RBAC: tạo SOP cần service.write (thiếu → 403); đọc cần service.read (thiếu → 403)", async () => {
    await login(await makeStaff([PERMISSIONS.SERVICE_READ])); // không write
    expect((await svcPost(req("http://t/api/services", "POST", dmkPayload()))).status).toBe(403);
    // tạo bằng writer
    await login(await makeStaff([PERMISSIONS.SERVICE_WRITE, PERMISSIONS.SERVICE_READ]));
    const id = (await rj(await svcPost(req("http://t/api/services", "POST", dmkPayload())))).data.id;
    // đọc bằng người KHÔNG có service.read
    await login(await makeStaff([PERMISSIONS.CUSTOMER_READ]));
    expect((await svcGet(id)).status).toBe(403);
  });
});
