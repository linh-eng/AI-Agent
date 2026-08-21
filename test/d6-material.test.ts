// =============================================================================
// D6 (Batch 2) — Tự động GỢI Ý tiêu hao vật tư theo SOP + Bỏ qua có lý do.
// Nguyên tắc kiểm chứng:
//   * SOP chỉ PREFILL Suggested/Planned — KHÔNG tự trừ kho (Planned ≠ Actual).
//   * Trừ kho CHỈ khi Confirmed Actual Usage qua engine tiêu hao HIỆN CÓ
//     (consumeFromContainer) — KHÔNG parallel engine.
//   * origin trace qua AUDIT (D6-C), KHÔNG cột DB mới.
//   * Bỏ qua SOP → LÝ DO BẮT BUỘC (D6-B), audit SOP_MATERIAL_SKIPPED.
//   * Hoàn thành buổi KHÔNG auto-post vật tư (D6-A OFF).
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
import { resetDb, uniq, makeCustomer } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as suggestedRaw } from "@/app/api/session-suggested-materials/route";
import { POST as skipRaw } from "@/app/api/session-material-skip/route";
import { POST as usageRaw } from "@/app/api/material-usages/route";
import { PATCH as sessionPatchRaw } from "@/app/api/treatment-sessions/[id]/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const data = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("d6")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id, name: user.name };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.72.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const suggested = (sid: string) => suggestedRaw(new Request("http://t/api/session-suggested-materials?sessionId=" + sid), {} as any);
const skip = (b: unknown) => skipRaw(new Request("http://t/api/session-material-skip", J(b)), {} as any);
const usage = (b: unknown) => usageRaw(new Request("http://t/api/material-usages", J(b)), {} as any);
const sessionPatch = (id: string, b: unknown) => sessionPatchRaw(new Request("http://t/api/treatment-sessions/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);

// Dịch vụ có SOP: 2 bước, mỗi bước 1 vật tư (Gel 5ml bắt buộc + Mặt nạ 1cái).
async function makeServiceWithSop() {
  return prisma.service.create({
    data: {
      code: uniq("DV"), name: "DV SOP " + uniq("s"), standardPrice: 500_000,
      steps: { create: [
        { sortOrder: 0, name: "Bước 1", products: { create: [{ sortOrder: 0, name: "Gel dẫn", quantity: 5, unit: "ml", isRequired: true }] } },
        { sortOrder: 1, name: "Bước 2", products: { create: [{ sortOrder: 0, name: "Mặt nạ", quantity: 1, unit: "cái", isRequired: false }] } },
      ] },
    },
  });
}
async function makeContainer(name: string, qty: number) {
  const m = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name, unit: "ml", expectedPerSession: 5 } });
  return prisma.materialContainer.create({ data: { usageMaterialId: m.id, containerNo: uniq("C"), initialQty: qty, remainingQty: qty, unit: "ml", costSnapshot: 1_000_000, status: "IN_USE" } });
}

describe("D6 — SOP suggested usage + skip-with-reason (reuse engine, no auto-deduct)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A · GET suggested: gom vật tư từ SOP; KHÔNG tạo MaterialUsage, KHÔNG trừ kho", async () => {
    const u = await makeUser([PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const svc = await makeServiceWithSop();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, serviceId: svc.id, sessionNumber: 1 } });
    await login(u.email);
    const r = await data(await suggested(sess.id));
    expect(r.suggested.map((x: any) => x.name).sort()).toEqual(["Gel dẫn", "Mặt nạ"]);
    const gel = r.suggested.find((x: any) => x.name === "Gel dẫn");
    expect(gel.quantity).toBe(5); expect(gel.unit).toBe("ml"); expect(gel.isRequired).toBe(true);
    // KHÔNG trừ kho / không tạo usage
    expect(await prisma.materialUsage.count({ where: { sessionId: sess.id } })).toBe(0);
  });

  it("B · buổi không có serviceId → suggested rỗng (không bịa)", async () => {
    const u = await makeUser([PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, sessionNumber: 1 } });
    await login(u.email);
    const r = await data(await suggested(sess.id));
    expect(r.suggested).toEqual([]);
  });

  it("C+G · Ghi nhận từ SOP (origin=SOP) → TRỪ KHO qua engine hiện có + audit origin=SOP", async () => {
    const u = await makeUser([PERMISSIONS.MATERIAL_WRITE, PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const svc = await makeServiceWithSop();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, serviceId: svc.id, sessionNumber: 1 } });
    const cont = await makeContainer("Gel dẫn", 100);
    await login(u.email);
    // Nhân viên sửa 5→4 (Actual) rồi Ghi nhận từ gợi ý SOP.
    const uz = await data(await usage({ source: "SHARED_STOCK", containerId: cont.id, sessionId: sess.id, quantity: 4, origin: "SOP", idempotencyKey: uniq("k") }));
    expect(uz.id).toBeTruthy();
    // TRỪ KHO thật qua engine hiện có: 100 → 96
    const after = await prisma.materialContainer.findUniqueOrThrow({ where: { id: cont.id } });
    expect(Number(after.remainingQty)).toBe(96);
    // origin trace qua audit (không cột DB)
    const a = await prisma.auditLog.findFirst({ where: { action: "MATERIAL_USAGE_POSTED", entityId: uz.id } });
    expect((a?.changes as any)?.origin).toBe("SOP");
  });

  it("D · Bỏ qua SOP: thiếu lý do → 422; có lý do → audit SOP_MATERIAL_SKIPPED + hiện ở suggested.skipped", async () => {
    const u = await makeUser([PERMISSIONS.MATERIAL_WRITE, PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const svc = await makeServiceWithSop();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, serviceId: svc.id, sessionNumber: 1 } });
    await login(u.email);
    // Thiếu lý do (rỗng) → 422
    const bad = await skip({ sessionId: sess.id, materialName: "Mặt nạ" });
    expect(bad.status).toBe(422);
    // Có lý do → OK + audit
    const good = await skip({ sessionId: sess.id, materialName: "Mặt nạ", plannedQty: 1, unit: "cái", reason: "Khách không dùng bước này" });
    expect(good.status).toBe(201);
    const a = await prisma.auditLog.findFirst({ where: { action: "SOP_MATERIAL_SKIPPED", entityId: sess.id } });
    expect((a?.changes as any)?.reason).toBe("Khách không dùng bước này");
    // suggested trả về skipped
    const r = await data(await suggested(sess.id));
    expect(r.skipped.map((x: any) => x.materialName)).toContain("Mặt nạ");
    // KHÔNG tạo usage / trừ kho khi bỏ qua
    expect(await prisma.materialUsage.count({ where: { sessionId: sess.id } })).toBe(0);
  });

  it("E · Hoàn thành buổi KHÔNG auto-post vật tư (D6-A OFF)", async () => {
    const u = await makeUser([PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const svc = await makeServiceWithSop();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, serviceId: svc.id, sessionNumber: 1, status: "IN_PROGRESS" } });
    await makeContainer("Gel dẫn", 100);
    await login(u.email);
    await sessionPatch(sess.id, { status: "COMPLETED", serviceId: svc.id });
    // Hoàn thành KHÔNG tạo MaterialUsage tự động
    expect(await prisma.materialUsage.count({ where: { sessionId: sess.id } })).toBe(0);
  });

  it("F · RBAC: skip cần MATERIAL_WRITE (customer.read → 403); suggested ẩn danh → 401", async () => {
    const ro = await makeUser([PERMISSIONS.CUSTOMER_READ]);
    const c = await makeCustomer();
    const svc = await makeServiceWithSop();
    const sess = await prisma.treatmentSession.create({ data: { customerId: c.id, serviceId: svc.id, sessionNumber: 1 } });
    await login(ro.email);
    const forbidden = await skip({ sessionId: sess.id, materialName: "Gel dẫn", reason: "thử" });
    expect(forbidden.status).toBe(403);
    // ẩn danh
    jar.clear();
    const anon = await suggested(sess.id);
    expect(anon.status).toBe(401);
  });
});
