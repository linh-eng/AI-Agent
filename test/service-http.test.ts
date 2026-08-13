// =============================================================================
// Mục 3 — Dịch vụ: test tích hợp mức HTTP (route handler thật) trên Postgres thật.
// Bao phủ: tạo nhanh nhóm (auto mã), tạo dịch vụ cấu hình đầy đủ (công nghệ/protocol/
// nhân sự/tài nguyên/vật tư định mức), status→isActive, chi tiết giải tên + giá sàn,
// cập nhật thay vật tư, mask giá vốn theo finance.read.
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

import { POST as catPostRaw } from "@/app/api/service-categories/route";
import { POST as svcPostRaw } from "@/app/api/services/route";
import { GET as svcListRaw } from "@/app/api/services/route";
import { GET as svcGetRaw, PATCH as svcPatchRaw } from "@/app/api/services/[id]/route";
const catPost = (r: Request) => catPostRaw(r, {} as any);
const svcPost = (r: Request) => svcPostRaw(r, {} as any);
const svcList = (r: Request) => svcListRaw(r, {} as any);

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.7" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("svc")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV DV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) { const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  const { POST: staffLogin } = await import("@/app/api/auth/login/route");
  await staffLogin(req("http://t/api/auth/login", "POST", { email, password: "matkhau123" }), {} as any);
  return jar.get(SESSION_COOKIE)!;
}
function auth(t: string) { jar.clear(); jar.set(SESSION_COOKIE, t); }

let writerFin = ""; let writerNoFin = "";
let techId = ""; let protoId = "";

beforeAll(async () => {
  await resetDb();
  writerFin = await login(await makeStaff(["service.read", "service.write", "finance.read"]));
  writerNoFin = await login(await makeStaff(["service.read", "service.write"]));
  techId = (await prisma.technology.create({ data: { code: uniq("TECH"), name: "RF" } })).id;
  protoId = (await prisma.brandProtocol.create({ data: { code: uniq("PRO"), name: "Protocol Dưỡng sáng", status: "ACTIVE" } })).id;
});
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

async function createService(over: any = {}) {
  auth(writerFin);
  const res = await svcPost(req("http://t/api/services", "POST", {
    name: "RF nâng cơ", categoryId: null, status: "ACTIVE", durationMinutes: 45, machineMinutes: 45,
    standardPrice: 1_800_000, expectedCost: 500_000,
    technologyIds: [techId], defaultTechnologyId: techId, protocolIds: [protoId],
    staffRequirements: [{ role: "Kỹ thuật viên", quantity: 1, required: true }],
    resourceRequirements: { room: { required: true, default: "Phòng 2" }, machine: { required: true, default: "Máy RF #1" } },
    materials: [{ name: "Gel dẫn RF", quantity: 1, unit: "lần", required: true }],
    ...over,
  }));
  return res;
}

describe("Dịch vụ · Tạo nhanh nhóm", () => {
  it("POST nhóm không mã → tự sinh mã; có mô tả + trạng thái", async () => {
    auth(writerFin);
    const res = await catPost(req("http://t/api/service-categories", "POST", { name: `Nhóm ${uniq("N")}`, description: "Nhóm test" }));
    expect(res.status).toBe(201);
    const c = (await readJson(res)).data;
    expect(c.code).toMatch(/^NDV-/);
    expect(c.isActive).toBe(true);
  });
});

describe("Dịch vụ · Tạo cấu hình đầy đủ + chi tiết", () => {
  it("tạo dịch vụ với công nghệ/protocol/nhân sự/tài nguyên/vật tư; status ACTIVE→isActive true; auto mã DV-", async () => {
    const res = await createService();
    expect(res.status).toBe(201);
    const s = (await readJson(res)).data;
    expect(s.code).toMatch(/^DV-/);
    expect(s.isActive).toBe(true);
    expect(s.technologyIds).toContain(techId);
    // vật tư định mức được tạo lồng
    const mats = await prisma.serviceMaterialStandard.findMany({ where: { serviceId: s.id } });
    expect(mats.length).toBe(1);
    expect(mats[0].name).toBe("Gel dẫn RF");
  });

  it("GET chi tiết giải TÊN công nghệ/protocol + vật tư; có finance.read thấy giá vốn", async () => {
    const s = (await readJson(await createService())).data;
    auth(writerFin);
    const res = await svcGetRaw(req(`http://t/api/services/${s.id}`, "GET"), { params: { id: s.id } });
    const d = (await readJson(res)).data;
    expect(d.technologies.map((t: any) => t.name)).toContain("RF");
    expect(d.protocols.map((p: any) => p.name)).toContain("Protocol Dưỡng sáng");
    expect(d.materialStandards.length).toBe(1);
    expect(Number(d.expectedCost)).toBe(500_000);
  });

  it("status PAUSED → isActive false", async () => {
    const s = (await readJson(await createService({ status: "PAUSED" }))).data;
    expect(s.status).toBe("PAUSED");
    expect(s.isActive).toBe(false);
  });

  it("không finance.read → giá vốn bị ẩn (null)", async () => {
    const s = (await readJson(await createService())).data;
    auth(writerNoFin);
    const res = await svcGetRaw(req(`http://t/api/services/${s.id}`, "GET"), { params: { id: s.id } });
    const d = (await readJson(res)).data;
    expect(d.expectedCost).toBeNull();
  });
});

describe("Dịch vụ · Cập nhật thay vật tư + giá sàn", () => {
  it("PATCH gửi materials mới → thay toàn bộ vật tư định mức", async () => {
    const s = (await readJson(await createService())).data;
    auth(writerFin);
    await svcPatchRaw(req(`http://t/api/services/${s.id}`, "PATCH", { materials: [{ name: "Serum mới", quantity: 2, unit: "ml", required: false }, { name: "Mặt nạ", quantity: 1, unit: "lần" }] }), { params: { id: s.id } });
    const mats = await prisma.serviceMaterialStandard.findMany({ where: { serviceId: s.id }, orderBy: { orderIndex: "asc" } });
    expect(mats.length).toBe(2);
    expect(mats[0].name).toBe("Serum mới");
  });

  it("có giá sàn → chi tiết trả tổng chi phí + giá sàn; danh sách có floorPrice", async () => {
    const s = (await readJson(await createService())).data;
    await prisma.servicePriceFloor.create({ data: { serviceId: s.id, laborCost: 700_000, operationCost: 150_000, depreciationCost: 200_000, materialCost: 250_000, roomCost: 100_000, otherCost: 0, minMarginPercent: 15 } });
    auth(writerFin);
    const d = (await readJson(await svcGetRaw(req(`http://t/api/services/${s.id}`, "GET"), { params: { id: s.id } }))).data;
    expect(d.floorSummary.hasFloor).toBe(true);
    expect(d.floorSummary.totalCost).toBe(1_400_000);
    expect(d.floorSummary.floorPrice).toBe(1_610_000); // 1.4tr × 1.15
    // list có floorPrice
    const list = (await readJson(await svcList(req(`http://t/api/services?q=RF`, "GET")))).data;
    const row = list.find((x: any) => x.id === s.id);
    expect(row.floorPrice).toBe(1_610_000);
  });
});
