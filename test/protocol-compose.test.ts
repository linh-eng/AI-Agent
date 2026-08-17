// =============================================================================
// Redesign P2 — Protocol compose NHIỀU Service (coexistence với legacy steps).
// Nghiệm thu HTTP thật trên Postgres:
//   A. Legacy protocol (steps Json) vẫn GET/PATCH bình thường, KHÔNG sinh ProtocolService.
//   B. New protocol: 1 Protocol → 3 ProtocolService (đúng sortOrder, mode SERVICES).
//   C. Reorder persistence (DMK→Laser→Recovery → DMK→Recovery→Laser).
//   D. Optional (Recovery isRequired=false).
//   E. Override (durationOverride + recommendedVariants) — KHÔNG clone SOP.
//   F. Service là source-of-truth: sửa SOP Service → protocol tham chiếu, KHÔNG double-source.
//   G. Versioning: đổi composition + bumpVersion → version tăng, audit.
//   H. RBAC: thiếu protocol.write → 403; ẩn danh → 401.
//   I. Persistence HTTP + DB.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

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
import { POST as protoPost } from "@/app/api/brand-protocols/route";
import { GET as protoGet, PATCH as protoPatch } from "@/app/api/brand-protocols/[id]/route";
import { PATCH as svcPatch } from "@/app/api/services/[id]/route";

let ip = 0;
function jreq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) {
    const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  return { email, password: "matkhau123" };
}
async function login(email: string, password: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {} as any);
  return jar.get(SESSION_COOKIE);
}

// Tạo Service kèm SOP tối thiểu (qua Prisma — cô lập test vào phần compose Protocol).
async function makeService(name: string, opts?: { steps?: number; duration?: number; version?: number }) {
  const svc = await prisma.service.create({
    data: {
      code: uniq("DV"), name, status: "ACTIVE", durationMinutes: opts?.duration ?? 30, standardPrice: 1_000_000, version: opts?.version ?? 1,
      steps: { create: Array.from({ length: opts?.steps ?? 2 }, (_, i) => ({ sortOrder: i, name: `${name} · bước ${i + 1}`, durationMinutes: 10, isRequired: true })) },
    },
  });
  return svc;
}

let writer: { email: string; password: string };
let approver: { email: string; password: string };
let reader: { email: string; password: string };
let dmk: any, laser: any, recovery: any;

beforeAll(async () => {
  await resetDb();
  writer = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE, PERMISSIONS.PROTOCOL_APPROVE, PERMISSIONS.SERVICE_READ, PERMISSIONS.SERVICE_WRITE]);
  approver = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE, PERMISSIONS.PROTOCOL_APPROVE]);
  reader = await makeStaff([PERMISSIONS.LIBRARY_READ]); // KHÔNG có protocol.write
  dmk = await makeService("DMK Enzyme Treatment", { steps: 5, duration: 83, version: 2 });
  laser = await makeService("Laser Pico", { steps: 3, duration: 30 });
  recovery = await makeService("Recovery", { steps: 2, duration: 15 });
});
beforeEach(() => { jar.clear(); });

describe("Redesign P2 · Protocol compose nhiều Service (coexistence)", () => {
  it("A · Legacy protocol (steps Json) vẫn hoạt động, KHÔNG sinh ProtocolService", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: "Legacy Glow", kind: "INTERNAL", steps: { items: [{ name: "Làm sạch", durationMinutes: 10 }, { name: "Dưỡng", durationMinutes: 20 }] },
    }), {} as any));
    expect(created.data.id).toBeTruthy();
    const got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${created.data.id}`, "GET"), { params: { id: created.data.id } } as any));
    expect(got.data.compositionMode).toBe("LEGACY_STEPS"); // mặc định
    expect((got.data.steps as any).items).toHaveLength(2); // steps cũ giữ nguyên
    expect(got.data.services).toHaveLength(0); // KHÔNG tự sinh
    // DB xác nhận
    const rows = await prisma.protocolService.count({ where: { protocolId: created.data.id } });
    expect(rows).toBe(0);
  });

  it("B · New protocol: 1 Protocol → 3 Service đúng sortOrder + mode SERVICES + version snapshot", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: "Pigmentation Combination", kind: "INTERNAL", compositionMode: "SERVICES",
      services: [
        { serviceId: dmk.id, isRequired: true },
        { serviceId: laser.id, isRequired: true },
        { serviceId: recovery.id, isRequired: false },
      ],
    }), {} as any));
    const id = created.data.id;
    const got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.compositionMode).toBe("SERVICES");
    expect(got.data.services).toHaveLength(3);
    expect(got.data.services.map((s: any) => s.service.name)).toEqual(["DMK Enzyme Treatment", "Laser Pico", "Recovery"]);
    expect(got.data.services.map((s: any) => s.sortOrder)).toEqual([0, 1, 2]);
    // version snapshot của DMK ghi = 2 (version hiện hành lúc gắn)
    const dmkRow = got.data.services.find((s: any) => s.service.name === "DMK Enzyme Treatment");
    expect(dmkRow.serviceVersionSnapshot).toBe(2);
    // preview SOP đọc được (read-only) — 5 bước của DMK
    expect(dmkRow.service.steps).toHaveLength(5);
    // composeDuration = 83 + 30 + 15
    expect(got.data.composeDuration).toBe(128);
    // DB
    const rows = await prisma.protocolService.findMany({ where: { protocolId: id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.serviceId)).toEqual([dmk.id, laser.id, recovery.id]);
  });

  it("C · Reorder persistence: DMK→Laser→Recovery ⇒ DMK→Recovery→Laser", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: uniq("Reorder"), kind: "INTERNAL", compositionMode: "SERVICES",
      services: [{ serviceId: dmk.id }, { serviceId: laser.id }, { serviceId: recovery.id }],
    }), {} as any));
    const id = created.data.id;
    await protoPatch(jreq(`http://t/api/brand-protocols/${id}`, "PATCH", {
      services: [{ serviceId: dmk.id }, { serviceId: recovery.id }, { serviceId: laser.id }],
    }), { params: { id } } as any);
    const got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    expect(got.data.services.map((s: any) => s.service.name)).toEqual(["DMK Enzyme Treatment", "Recovery", "Laser Pico"]);
    expect(got.data.services.map((s: any) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it("D+E · Optional + override (durationOverride + recommendedVariants) KHÔNG clone SOP", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: uniq("Override"), kind: "INTERNAL", compositionMode: "SERVICES",
      services: [
        { serviceId: dmk.id, isRequired: true, durationOverride: 60, conditionText: "Chọn enzyme theo tình trạng da", recommendedVariants: [{ stepName: "Đắp Enzyme", optionName: "Enzyme #2" }] },
        { serviceId: recovery.id, isRequired: false },
      ],
    }), {} as any));
    const id = created.data.id;
    const got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    const dmkRow = got.data.services.find((s: any) => s.service.name === "DMK Enzyme Treatment");
    const recRow = got.data.services.find((s: any) => s.service.name === "Recovery");
    expect(dmkRow.durationOverride).toBe(60);
    expect(dmkRow.conditionText).toContain("enzyme");
    expect(dmkRow.recommendedVariants[0].optionName).toBe("Enzyme #2");
    expect(recRow.isRequired).toBe(false);
    // composeDuration dùng override: 60 + 15
    expect(got.data.composeDuration).toBe(75);
    // KHÔNG double-source: ProtocolService KHÔNG có cột steps/products riêng (chỉ reference serviceId)
    const raw = await prisma.protocolService.findFirst({ where: { protocolId: id, serviceId: dmk.id } });
    expect(raw).not.toHaveProperty("steps");
    expect(raw!.serviceId).toBe(dmk.id);
  });

  it("F · Service là source-of-truth: sửa SOP Service → protocol phản chiếu, không copy", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: uniq("SourceTruth"), kind: "INTERNAL", compositionMode: "SERVICES", services: [{ serviceId: laser.id }],
    }), {} as any));
    const id = created.data.id;
    // Sửa SOP của Laser (từ 3 bước → 4 bước) qua API service.
    await svcPatch(jreq(`http://t/api/services/${laser.id}`, "PATCH", {
      steps: [1, 2, 3, 4].map((n) => ({ name: `Laser bước ${n}`, durationMinutes: 5, unit: undefined })),
    }), { params: { id: laser.id } } as any);
    // Protocol GET phản chiếu SOP mới (4 bước) — vì reference live, không snapshot copy.
    const got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    const laserRow = got.data.services.find((s: any) => s.service.id === laser.id);
    expect(laserRow.service.steps).toHaveLength(4);
    // Service version đã tăng (bump khi sửa SOP) — nhưng serviceVersionSnapshot ghi lúc gắn = 1.
    expect(laserRow.service.version).toBeGreaterThan(1);
    expect(laserRow.serviceVersionSnapshot).toBe(1);
  });

  it("G · Versioning: đổi composition + bumpVersion → version tăng + audit PROTOCOL_SERVICES_CHANGED", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: uniq("Ver"), kind: "INTERNAL", compositionMode: "SERVICES", services: [{ serviceId: dmk.id }],
    }), {} as any));
    const id = created.data.id;
    const before = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    expect(before.data.version).toBe(1);
    await protoPatch(jreq(`http://t/api/brand-protocols/${id}`, "PATCH", {
      services: [{ serviceId: dmk.id }, { serviceId: laser.id }], bumpVersion: true, changeReason: "Thêm Laser vào phác đồ",
    }), { params: { id } } as any);
    const after = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${id}`, "GET"), { params: { id } } as any));
    expect(after.data.version).toBe(2);
    expect(after.data.services).toHaveLength(2);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "BrandProtocol", entityId: id, action: "PROTOCOL_SERVICES_CHANGED" }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
    expect((audit!.changes as any).after).toHaveLength(2);
  });

  it("H · RBAC: thiếu protocol.write → 403; ẩn danh → 401", async () => {
    // reader (chỉ library.read) không tạo được protocol
    await login(reader.email, reader.password);
    const res403 = await protoPost(jreq("http://t/api/brand-protocols", "POST", { name: "X", compositionMode: "SERVICES", services: [{ serviceId: dmk.id }] }), {} as any);
    expect(res403.status).toBe(403);
    // ẩn danh
    jar.clear();
    const res401 = await protoPost(jreq("http://t/api/brand-protocols", "POST", { name: "Y" }), {} as any);
    expect(res401.status).toBe(401);
  });

  it("I · Validation: serviceId không tồn tại → 422 (không tạo rác)", async () => {
    await login(writer.email, writer.password);
    const created = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", { name: uniq("Bad"), kind: "INTERNAL" }), {} as any));
    const id = created.data.id;
    const res = await protoPatch(jreq(`http://t/api/brand-protocols/${id}`, "PATCH", { compositionMode: "SERVICES", services: [{ serviceId: "khong-ton-tai" }] }), { params: { id } } as any);
    expect(res.status).toBe(422);
    const rows = await prisma.protocolService.count({ where: { protocolId: id } });
    expect(rows).toBe(0);
  });
});
