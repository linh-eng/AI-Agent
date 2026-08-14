// =============================================================================
// Mục 5 — Session / Ghi nhận lần thực hiện: sinh mã, validate hoàn thành, khóa &
// audit sửa sau hoàn thành, không trừ tồn khi tạo Booking, timeline "Đã thực hiện".
// =============================================================================
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

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
import { resetDb, uniq, makeCustomer } from "./helpers";
import { buildCustomerTimeline } from "@/lib/clinic";

import { POST as sessionPostRaw } from "@/app/api/treatment-sessions/route";
import { PATCH as sessionPatchRaw } from "@/app/api/treatment-sessions/[id]/route";
import { POST as bookingPostRaw } from "@/app/api/bookings/route";
const sessionPost = (r: Request) => sessionPostRaw(r, {} as any);
const sessionPatch = (r: Request, id: string) => sessionPatchRaw(r, { params: { id } } as any);
const bookingPost = (r: Request) => bookingPostRaw(r, {} as any);

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.11" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("ss")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Session", passwordHash: await hashPassword("matkhau123") } });
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

async function makePlan(customerId: string) {
  return prisma.treatmentPlan.create({
    data: { code: uniq("TP"), customerId, name: "PĐ", version: 1, status: "ACTIVE", stages: { create: [{ name: "Can thiệp", orderIndex: 0 }] } },
    include: { stages: true },
  });
}
async function makeService() {
  const cat = await prisma.serviceCategory.create({ data: { code: uniq("DM"), name: "Nhóm" } });
  return prisma.service.create({ data: { code: uniq("DV"), name: "RF test", categoryId: cat.id, standardPrice: 1_000_000 } });
}

describe("Mục 5 — Session", () => {
  let writer = ""; // treatment.write (không có editCompleted)
  let editor = ""; // treatment.write + treatment.editCompleted
  beforeEach(async () => {
    await resetDb();
    writer = await login(await makeStaff(["treatment.read", "treatment.write", "booking.read", "booking.write"]));
    editor = await login(await makeStaff(["treatment.read", "treatment.write", "treatment.editCompleted"]));
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("tạo Session sinh MÃ (SS-xxxxxx) và giữ liên kết plan/stage/buổi", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    auth(writer);
    const res = await sessionPost(req("http://t/api/treatment-sessions", "POST", { planId: plan.id, stageId: plan.stages[0].id, sessionNumber: 1 }));
    expect(res.status).toBe(201);
    const s = (await readJson(res)).data;
    expect(s.code).toMatch(/^SS-\d{6}$/);
    expect(s.planId).toBe(plan.id);
    expect(s.stageId).toBe(plan.stages[0].id);
  });

  it("HOÀN THÀNH thiếu dịch vụ thực tế → 422; có dịch vụ → OK + performedAt + versionAtExecution (mục 28)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const svc = await makeService();
    const s = await prisma.treatmentSession.create({ data: { planId: plan.id, stageId: plan.stages[0].id, customerId: c.id, sessionNumber: 1, status: "IN_PROGRESS" } });
    auth(writer);
    // Thiếu dịch vụ thực tế → chặn
    const bad = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { status: "COMPLETED" }), s.id);
    expect(bad.status).toBe(422);
    // Có dịch vụ thực tế → hoàn thành
    auth(writer);
    const ok = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { status: "COMPLETED", serviceId: svc.id }), s.id);
    expect(ok.status).toBe(200);
    const after = await prisma.treatmentSession.findUnique({ where: { id: s.id } });
    expect(after?.status).toBe("COMPLETED");
    expect(after?.performedAt).toBeTruthy();
    expect(after?.versionAtExecution).toBe(1);
  });

  it("KHÓA sau hoàn thành: không quyền → 403; có quyền thiếu lý do → 422; có quyền + lý do → OK + editLog + audit (mục 29)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const svc = await makeService();
    const s = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: c.id, sessionNumber: 1, status: "COMPLETED", performedAt: new Date(), serviceId: svc.id, note: "cũ" } });
    // writer (không có editCompleted) → 403
    auth(writer);
    const forbidden = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { note: "mới" }), s.id);
    expect(forbidden.status).toBe(403);
    // editor thiếu lý do → 422
    auth(editor);
    const noReason = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { note: "mới" }), s.id);
    expect(noReason.status).toBe(422);
    // editor + lý do → OK, ghi editLog
    auth(editor);
    const ok = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { note: "mới", editReason: "Sửa nhầm ghi chú" }), s.id);
    expect(ok.status).toBe(200);
    const after = await prisma.treatmentSession.findUnique({ where: { id: s.id } });
    expect(after?.note).toBe("mới");
    const log = after?.editLog as any[];
    expect(Array.isArray(log)).toBe(true);
    expect(log[0].reason).toBe("Sửa nhầm ghi chú");
    expect(log[0].changes.find((ch: any) => ch.field === "note")).toEqual({ field: "note", before: "cũ", after: "mới" });
    // audit log ghi nhận
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "TreatmentSession", action: "SESSION_EDIT_COMPLETED", entityId: s.id } });
    expect(audit).toBeTruthy();
  });

  it("tạo Booking KHÔNG trừ tồn/không tạo tiêu hao vật tư (mục 17)", async () => {
    const c = await makeCustomer();
    const svc = await makeService();
    auth(writer);
    const res = await bookingPost(req("http://t/api/bookings", "POST", { customerId: c.id, serviceId: svc.id, scheduledAt: "2026-09-10T07:00:00Z", durationMinutes: 60 }));
    expect(res.status).toBe(201);
    // Không có bản ghi tiêu hao vật tư nào được tạo bởi việc đặt lịch
    expect(await prisma.materialUsage.count()).toBe(0);
  });

  it("Timeline khách: buổi hoàn thành hiển thị 'Đã thực hiện [dịch vụ]' (mục 31)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const svc = await makeService();
    await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: c.id, sessionNumber: 1, status: "COMPLETED", performedAt: new Date("2026-09-03"), serviceId: svc.id } });
    const timeline = await buildCustomerTimeline(c.id);
    const ev = timeline.find((e: any) => e.kind === "session");
    expect(ev?.title).toContain("Đã thực hiện");
    expect(ev?.title).toContain("RF test");
  });

  it("Before/After gắn Session + cờ sharedWithCustomer (mục 21-22)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const s = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: c.id, sessionNumber: 1 } });
    await prisma.mediaAsset.createMany({ data: [
      { storageKey: uniq("k"), filename: "b.png", contentType: "image/png", size: 10, kind: "BEFORE_IMAGE", customerId: c.id, sessionId: s.id, sharedWithCustomer: true },
      { storageKey: uniq("k"), filename: "a.png", contentType: "image/png", size: 10, kind: "AFTER_IMAGE", customerId: c.id, sessionId: s.id, sharedWithCustomer: false },
    ] });
    const media = await prisma.mediaAsset.findMany({ where: { sessionId: s.id } });
    expect(media.length).toBe(2);
    expect(media.filter((m) => m.sharedWithCustomer).length).toBe(1); // 1 chia sẻ, 1 nội bộ
  });
});
