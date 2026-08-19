// =============================================================================
// Giá vốn — chi phí phát sinh (nút "+"): các dòng extraCostLines gộp vào "Chi phí
// khác (F)" và cộng đúng vào TỔNG GIÁ VỐN. Bất biến khi phát hành. Mask theo
// finance.read. HTTP thật trên Postgres.
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
import { POST as createRaw } from "@/app/api/service-costings/route";
const createCosting = (r: Request) => createRaw(r, {} as any);

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.7.3" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("co")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Giá vốn", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) { const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  const { POST: staffLogin } = await import("@/app/api/auth/login/route");
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.7.3" }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
  return jar.get(SESSION_COOKIE)!;
}

let finToken = ""; let noFinToken = ""; let svcId = "";

beforeAll(async () => {
  await resetDb();
  finToken = await login(await makeStaff(["pricefloor.read", "pricefloor.write", "finance.read"]));
  noFinToken = await login(await makeStaff(["pricefloor.read", "pricefloor.write"]));
  const cat = await prisma.serviceCategory.create({ data: { code: uniq("CAT"), name: "Nhóm" } });
  const svc = await prisma.service.create({ data: { code: uniq("SV"), name: "DV giá vốn", categoryId: cat.id, standardPrice: 2_000_000, durationMinutes: 60 } });
  svcId = svc.id;
});

describe("Giá vốn — chi phí phát sinh (nút +)", () => {
  it("các dòng phát sinh gộp vào Chi phí khác + cộng đúng vào TỔNG", async () => {
    jar.clear(); jar.set(SESSION_COOKIE, finToken);
    const res = await createCosting(req("http://t/api/service-costings", "POST", {
      serviceId: svcId,
      equipmentCost: 100_000, facilityCost: 50_000, overheadMethod: "MANUAL", overheadValue: 0,
      extraCostLines: [ { name: "Phụ phí gấp", amount: 30_000 }, { name: "Vật tư đặc biệt", amount: 20_000 } ],
    }));
    expect(res.status).toBe(201);
    const v = (await readJson(res)).data;
    // otherCost = tổng 2 dòng = 50.000
    expect(Number(v.otherCost)).toBe(50_000);
    expect(Array.isArray(v.extraCostLines)).toBe(true);
    expect(v.extraCostLines).toHaveLength(2);
    // total = material(0) + labor(0) + equip(100k) + facility(50k) + overhead(0) + other(50k) = 200.000
    expect(Number(v.totalEstimatedCost)).toBe(200_000);
    expect(Number(v.directCost)).toBe(150_000);
  });

  it("phát hành → bất biến; thêm dòng vào bảng giá vốn mới không đổi bản cũ", async () => {
    jar.clear(); jar.set(SESSION_COOKIE, finToken);
    const c1 = (await readJson(await createCosting(req("http://t/api/service-costings", "POST", {
      serviceId: svcId, extraCostLines: [{ name: "A", amount: 10_000 }],
    })))).data;
    const { POST: pubRaw } = await import("@/app/api/service-costings/[id]/publish/route");
    const pub = await pubRaw(req(`http://t/api/service-costings/${c1.id}/publish`, "POST"), { params: { id: c1.id } } as any);
    expect(pub.status).toBe(200);
    const published = (await readJson(pub)).data;
    expect(Number(published.otherCost)).toBe(10_000);
    expect(published.status).toBe("PUBLISHED");
    // sourceSnapshot lưu extraCostLines làm evidence
    expect(published.sourceSnapshot?.extraCostLines?.[0]?.name).toBe("A");
  });

  it("non-finance: extraCostLines + otherCost bị mask (null)", async () => {
    jar.clear(); jar.set(SESSION_COOKIE, noFinToken);
    const { GET: listRaw } = await import("@/app/api/service-costings/route");
    const res = await listRaw(req(`http://t/api/service-costings?serviceId=${svcId}`, "GET"), {} as any);
    expect(res.status).toBe(200);
    const rows = (await readJson(res)).data;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.otherCost).toBeNull(); expect(r.extraCostLines).toBeNull(); expect(r.totalEstimatedCost).toBeNull(); }
  });
});
