// =============================================================================
// Mục 4 — Phác đồ / Giai đoạn / Buổi: test lib thuần + tích hợp HTTP (route thật).
// Bao phủ: tần suất, ngày giai đoạn, tiến độ, derive trạng thái buổi, Kế hoạch vs
// Thực tế (bảo toàn kế hoạch), tạo phiên bản (lý do bắt buộc + đóng băng version),
// tạo lịch hẹn từ buổi (liên kết Booking ↔ Buổi).
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
import {
  frequencyLabel,
  frequencyToDays,
  computeStageSessionDates,
  computePlanProgress,
  deriveSessionStatus,
  deriveStageStatus,
  isSessionDateInStage,
  isSessionDone,
  comparePlannedActual,
} from "@/lib/treatment-plan";

import { POST as versionPostRaw } from "@/app/api/treatment-plans/[id]/version/route";
import { PATCH as sessionPatchRaw } from "@/app/api/treatment-sessions/[id]/route";
import { POST as bookingPostRaw } from "@/app/api/bookings/route";
const versionPost = (r: Request, id: string) => versionPostRaw(r, { params: { id } } as any);
const sessionPatch = (r: Request, id: string) => sessionPatchRaw(r, { params: { id } } as any);
const bookingPost = (r: Request) => bookingPostRaw(r, {} as any);

function req(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("pd")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Phác đồ", passwordHash: await hashPassword("matkhau123") } });
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

// ------------------------- Lib thuần -------------------------
describe("Phác đồ — lib tần suất & ngày (mục 6)", () => {
  it("nhãn tần suất theo đơn vị (không hard-code tuần)", () => {
    expect(frequencyLabel(7, "DAY")).toBe("7 ngày/lần");
    expect(frequencyLabel(2, "WEEK")).toBe("2 tuần/lần");
    expect(frequencyLabel(1, "MONTH")).toBe("1 tháng/lần");
    expect(frequencyLabel(null, "DAY")).toBeNull();
  });
  it("chuẩn hóa tần suất về số ngày", () => {
    expect(frequencyToDays(7, "DAY")).toBe(7);
    expect(frequencyToDays(2, "WEEK")).toBe(14);
    expect(frequencyToDays(1, "MONTH")).toBe(30);
  });
  it("tính chuỗi ngày buổi theo giai đoạn (start + mỗi 7 ngày)", () => {
    const ds = computeStageSessionDates("2026-08-20", 4, 7, "DAY");
    expect(ds.length).toBe(4);
    expect(ds[0].toISOString().slice(0, 10)).toBe("2026-08-20");
    expect(ds[3].toISOString().slice(0, 10)).toBe("2026-09-10"); // +21 ngày
  });
});

describe("Phác đồ — tiến độ (mục 7)", () => {
  const stages = [
    { id: "s1", name: "Chuẩn bị", orderIndex: 0 },
    { id: "s2", name: "Can thiệp", orderIndex: 1 },
  ];
  const sessions = [
    { id: "b1", stageId: "s1", sessionNumber: 1, status: "COMPLETED" },
    { id: "b2", stageId: "s1", sessionNumber: 2, status: "COMPLETED" },
    { id: "b3", stageId: "s2", sessionNumber: 3, status: "COMPLETED" },
    { id: "b4", stageId: "s2", sessionNumber: 4, status: "COMPLETED" },
    { id: "b5", stageId: "s2", sessionNumber: 5, status: "PLANNED", plannedDate: "2026-09-15" },
    { id: "b6", stageId: "s2", sessionNumber: 6, status: "PLANNED", plannedDate: "2026-09-22" },
  ];
  it("tiến độ toàn phác đồ = số buổi hoàn thành / tổng", () => {
    const p = computePlanProgress(stages, sessions);
    expect(p.overallProgress).toEqual({ done: 4, total: 6 });
  });
  it("giai đoạn hiện tại = giai đoạn của buổi chưa hoàn thành đầu tiên; tiến độ giai đoạn tách riêng", () => {
    const p = computePlanProgress(stages, sessions);
    expect(p.currentStage?.name).toBe("Can thiệp");
    expect(p.stageProgress).toEqual({ done: 2, total: 4 }); // KHÔNG dùng "1/2 buổi" làm tên
  });
  it("buổi tiếp theo = buổi chưa thực hiện có ngày sớm nhất", () => {
    const p = computePlanProgress(stages, sessions);
    expect(p.nextSession?.sessionNumber).toBe(5);
  });
});

describe("Phác đồ — derive trạng thái buổi (mục 10)", () => {
  it("chưa có lịch → Chưa lên lịch", () => {
    expect(deriveSessionStatus({ status: "PLANNED" }, null)).toBe("PLANNED");
  });
  it("có booking CONFIRMED → Đã lên lịch", () => {
    expect(deriveSessionStatus({ status: "PLANNED" }, { status: "CONFIRMED" })).toBe("SCHEDULED");
  });
  it("booking ARRIVED → Khách đã đến", () => {
    expect(deriveSessionStatus({ status: "PLANNED" }, { status: "ARRIVED" })).toBe("ARRIVED");
  });
  it("đã ghi nhận (performedAt) → Hoàn thành, bất kể booking", () => {
    expect(deriveSessionStatus({ status: "IN_PROGRESS", performedAt: "2026-09-01" }, { status: "IN_PROGRESS" })).toBe("COMPLETED");
    expect(isSessionDone({ status: "COMPLETED" })).toBe(true);
  });
  it("buổi bỏ qua → Bỏ qua", () => {
    expect(deriveSessionStatus({ status: "SKIPPED" }, null)).toBe("SKIPPED");
  });
});

describe("Phác đồ — trạng thái giai đoạn tự suy (mục 2 chỉnh)", () => {
  it("đủ buổi hoàn thành → COMPLETED", () => {
    expect(deriveStageStatus({ plannedSessions: 2 }, [{ status: "COMPLETED" }, { status: "COMPLETED" }])).toBe("COMPLETED");
  });
  it("có buổi hoàn thành nhưng chưa đủ → IN_PROGRESS", () => {
    expect(deriveStageStatus({ plannedSessions: 2 }, [{ status: "COMPLETED" }, { status: "PLANNED" }])).toBe("IN_PROGRESS");
  });
  it("chưa buổi nào → giữ trạng thái đã lưu (PENDING)", () => {
    expect(deriveStageStatus({ status: "PENDING", plannedSessions: 2 }, [{ status: "PLANNED" }])).toBe("PENDING");
  });
  it("tôn trọng CANCELLED thủ công", () => {
    expect(deriveStageStatus({ status: "CANCELLED", plannedSessions: 2 }, [{ status: "COMPLETED" }, { status: "COMPLETED" }])).toBe("CANCELLED");
  });
});

describe("Phác đồ — ngày buổi trong khoảng giai đoạn (mục 3 chỉnh)", () => {
  const stage = { plannedStartDate: "2026-09-03", plannedEndDate: "2026-09-24" };
  it("trong khoảng → true", () => { expect(isSessionDateInStage("2026-09-10", stage)).toBe(true); });
  it("ngoài khoảng → false", () => { expect(isSessionDateInStage("2026-10-01", stage)).toBe(false); });
  it("biên đầu/cuối tính trong khoảng", () => {
    expect(isSessionDateInStage("2026-09-03", stage)).toBe(true);
    expect(isSessionDateInStage("2026-09-24", stage)).toBe(true);
  });
  it("thiếu dữ liệu ngày giai đoạn → null (không kiểm)", () => {
    expect(isSessionDateInStage("2026-09-10", { plannedStartDate: null, plannedEndDate: null })).toBeNull();
  });
});

describe("Phác đồ — so sánh Kế hoạch vs Thực tế (mục 14–15)", () => {
  it("hiển thị song song + đánh dấu khác biệt khi thực tế lệch kế hoạch", () => {
    const resolve = (kind: string, id?: string | null) => (id ? `${kind}:${id}` : "—");
    const fmt = (d: any) => (d ? String(d) : "—");
    const rows = comparePlannedActual(
      { plannedServiceId: "RF", serviceId: "HIFU", plannedTechnologyId: "tRF", technologyId: "tHIFU", plannedProtocolId: "A", brandProtocolId: "B", plannedMaterials: { text: "5 ml" }, actualMaterials: { text: "7 ml" } },
      resolve as any, fmt,
    );
    const svc = rows.find((r) => r.label === "Dịch vụ")!;
    expect(svc.planned).toBe("service:RF");
    expect(svc.actual).toBe("service:HIFU");
    expect(svc.differs).toBe(true);
    const mat = rows.find((r) => r.label === "Vật tư")!;
    expect(mat.planned).toBe("5 ml");
    expect(mat.actual).toBe("7 ml");
    expect(mat.differs).toBe(true);
  });
});

// ------------------------- Tích hợp HTTP -------------------------
describe("Phác đồ — HTTP: version, kế hoạch-vs-thực tế, liên kết lịch hẹn", () => {
  let token = "";
  beforeEach(async () => {
    await resetDb();
    token = await login(await makeStaff(["treatment.read", "treatment.write", "booking.read", "booking.write"]));
  });
  afterAll(async () => { await prisma.$disconnect(); });

  async function makePlan(customerId: string) {
    return prisma.treatmentPlan.create({
      data: {
        code: uniq("TP"), customerId, name: "Phác đồ test", version: 1, status: "ACTIVE",
        stages: { create: [{ name: "Can thiệp", orderIndex: 0 }] },
      },
      include: { stages: true },
    });
  }

  it("ghi nhận thực tế KHÔNG ghi đè kế hoạch + ghim versionAtExecution khi hoàn thành (mục 13,14,19)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    // plannedServiceId/plannedProtocolId là String (soft ref, không FK) — snapshot kế hoạch.
    const s = await prisma.treatmentSession.create({
      data: {
        planId: plan.id, customerId: c.id, sessionNumber: 1, status: "PLANNED",
        plannedServiceId: "svcRF", plannedProtocolId: "protoA",
        plannedMaterials: { text: "5 ml" }, plannedParams: { text: "RF 42°C" },
      },
    });
    auth(token);
    const res = await sessionPatch(
      req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", {
        status: "COMPLETED", actualMaterials: { text: "7 ml" }, actualParams: { text: "HIFU 4.5mm" }, performer: "KTV A",
      }),
      s.id,
    );
    expect(res.status).toBe(200);
    const after = await prisma.treatmentSession.findUnique({ where: { id: s.id } });
    // Kế hoạch bảo toàn (ghi thực tế KHÔNG ghi đè kế hoạch):
    expect(after?.plannedServiceId).toBe("svcRF");
    expect(after?.plannedProtocolId).toBe("protoA");
    expect((after?.plannedMaterials as any)?.text).toBe("5 ml");
    expect((after?.plannedParams as any)?.text).toBe("RF 42°C");
    // Thực tế cập nhật:
    expect((after?.actualMaterials as any)?.text).toBe("7 ml");
    expect((after?.actualParams as any)?.text).toBe("HIFU 4.5mm");
    // Ghim version + performedAt:
    expect(after?.versionAtExecution).toBe(1);
    expect(after?.performedAt).toBeTruthy();
  });

  it("tạo phiên bản mới: thiếu lý do → 422; có lý do → bump version + đóng băng buổi cũ + ghi lịch sử (mục 16-19)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const done = await prisma.treatmentSession.create({
      data: { planId: plan.id, customerId: c.id, sessionNumber: 1, status: "COMPLETED", performedAt: new Date("2026-08-01") },
    });
    auth(token);
    // Thiếu lý do → 422 (Zod)
    const bad = await versionPost(req(`http://t/api/treatment-plans/${plan.id}/version`, "POST", { reason: "" }), plan.id);
    expect(bad.status).toBe(422);
    // Có lý do → thành công
    auth(token);
    const ok = await versionPost(req(`http://t/api/treatment-plans/${plan.id}/version`, "POST", { reason: "Kéo dài phục hồi", summary: "Thêm 1 buổi" }), plan.id);
    expect(ok.status).toBe(200);
    const planAfter = await prisma.treatmentPlan.findUnique({ where: { id: plan.id }, include: { versions: true } });
    expect(planAfter?.version).toBe(2);
    expect(planAfter?.versions.length).toBe(1);
    expect(planAfter?.versions[0].reason).toBe("Kéo dài phục hồi");
    // Buổi đã hoàn thành được ghim ở V1 (không trôi sang V2) — mục 19
    const doneAfter = await prisma.treatmentSession.findUnique({ where: { id: done.id } });
    expect(doneAfter?.versionAtExecution).toBe(1);
  });

  it("tạo lịch hẹn từ buổi: liên kết Booking ↔ Buổi + soft-ref plan/stage/sessionNumber (mục 11-12)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const s = await prisma.treatmentSession.create({
      data: { planId: plan.id, stageId: plan.stages[0].id, customerId: c.id, sessionNumber: 1, status: "PLANNED" },
    });
    auth(token);
    const res = await bookingPost(req("http://t/api/bookings", "POST", {
      customerId: c.id, scheduledAt: "2026-09-10T07:00:00Z", durationMinutes: 60,
      planId: plan.id, stageId: plan.stages[0].id, sessionNumber: 1, sessionId: s.id,
    }));
    expect(res.status).toBe(201);
    const booking = (await readJson(res)).data; // response bọc { data }
    // Buổi được gắn ngược bookingId
    const sAfter = await prisma.treatmentSession.findUnique({ where: { id: s.id } });
    expect(sAfter?.bookingId).toBe(booking.id);
    // Booking giữ soft-ref phác đồ/giai đoạn/buổi
    expect(booking.planId).toBe(plan.id);
    expect(booking.stageId).toBe(plan.stages[0].id);
    expect(booking.sessionNumber).toBe(1);
  });

  it("Session giữ context Phác đồ → Version → Giai đoạn → Buổi (mục 13)", async () => {
    const c = await makeCustomer();
    const plan = await makePlan(c.id);
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: new Date("2026-09-10T07:00:00Z"), status: "IN_PROGRESS" } });
    const s = await prisma.treatmentSession.create({
      data: { planId: plan.id, stageId: plan.stages[0].id, customerId: c.id, bookingId: bk.id, sessionNumber: 1, status: "IN_PROGRESS" },
    });
    auth(token);
    const res = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { status: "COMPLETED" }), s.id);
    expect(res.status).toBe(200);
    const after = await prisma.treatmentSession.findUnique({ where: { id: s.id } });
    expect(after?.planId).toBe(plan.id);
    expect(after?.stageId).toBe(plan.stages[0].id);
    expect(after?.bookingId).toBe(bk.id);
    expect(after?.sessionNumber).toBe(1);
    expect(after?.versionAtExecution).toBe(1);
  });

  it("hoàn thành đủ buổi → giai đoạn tự chuyển COMPLETED (mục 2 chỉnh)", async () => {
    const c = await makeCustomer();
    const plan = await prisma.treatmentPlan.create({
      data: { code: uniq("TP"), customerId: c.id, name: "PĐ", stages: { create: [{ name: "Chuẩn bị", orderIndex: 0, plannedSessions: 1 }] } },
      include: { stages: true },
    });
    const s = await prisma.treatmentSession.create({
      data: { planId: plan.id, stageId: plan.stages[0].id, customerId: c.id, sessionNumber: 1, status: "PLANNED" },
    });
    // Trước khi ghi nhận: giai đoạn PENDING
    expect((await prisma.treatmentStage.findUnique({ where: { id: plan.stages[0].id } }))?.status).toBe("PENDING");
    auth(token);
    const res = await sessionPatch(req(`http://t/api/treatment-sessions/${s.id}`, "PATCH", { status: "COMPLETED" }), s.id);
    expect(res.status).toBe(200);
    // Sau khi hoàn thành đủ buổi: giai đoạn COMPLETED
    expect((await prisma.treatmentStage.findUnique({ where: { id: plan.stages[0].id } }))?.status).toBe("COMPLETED");
  });
});
