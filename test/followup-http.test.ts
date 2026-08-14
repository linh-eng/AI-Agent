// =============================================================================
// Mục 9 — Test tích hợp HTTP (route handler thật) cho CSKH · Follow-up:
//   * RBAC (H): sửa MẪU quy trình cần followup.write; ÁP quy trình cần
//     followup.apply — thiếu quyền → 403 ở BACKEND (không chỉ ẩn UI).
//   * Chống trùng (C): áp lại cùng ngày → 409 kèm lần áp đang chạy; force → 200.
//   * Vòng đời + audit (G): hoàn thành ghi completedAt/By + audit; mở lại cần lý do.
//   * Quá hạn (F): filter=overdue trả đúng việc chưa xong đã quá hạn.
// Cookie vận chuyển qua jar mock next/headers (như test/http-integration).
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => { const v = jar.get(name); return v === undefined ? undefined : { name, value: v }; },
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";

import { POST as staffLogin } from "@/app/api/auth/login/route";
import { PATCH as templatePatch } from "@/app/api/followup-templates/[id]/route";
import { POST as applyPost } from "@/app/api/followup-templates/[id]/apply/route";
import { GET as tasksGet, POST as tasksPost } from "@/app/api/tasks/route";
import { PATCH as taskPatch } from "@/app/api/tasks/[id]/route";

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }

let ipSeq = 0;
async function makeStaff(permCodes: string[]) {
  const email = `${uniq("staff")}@thng.com.vn`.toLowerCase();
  const password = "matkhau123";
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword(password) } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "Role Test" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of permCodes) {
    const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  return { user, email, password };
}
async function login(email: string, password: string) {
  jar.clear();
  await staffLogin(jsonRequest("http://t/api/auth/login", "POST", { email, password }, { "x-forwarded-for": `10.9.0.${++ipSeq}` }), {});
  return jar.get(SESSION_COOKIE);
}

async function activeTemplate() {
  return prisma.followUpTemplate.create({
    data: { code: uniq("CS"), name: "QT test", trigger: "MANUAL", isActive: true, version: 1, steps: { create: [{ orderIndex: 0, dayOffset: 1, channel: "ZALO", title: "Gọi hỏi thăm", checklist: ["Hỏi phản ứng"] }] } },
  });
}

beforeAll(async () => { await resetDb(); });
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("H · RBAC sửa mẫu / áp quy trình (enforce backend)", () => {
  it("sửa MẪU: có followup.write → 200; thiếu → 403", async () => {
    const t = await activeTemplate();
    // Quản lý (có followup.write)
    const mgr = await makeStaff([PERMISSIONS.FOLLOWUP_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(mgr.email, mgr.password);
    const okRes = await templatePatch(jsonRequest(`http://t/api/followup-templates/${t.id}`, "PATCH", { name: "Đổi tên" }), { params: { id: t.id } });
    expect(okRes.status).toBe(200);

    // Lễ tân / CSKH (không có followup.write, chỉ task.write)
    const recep = await makeStaff([PERMISSIONS.TASK_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(recep.email, recep.password);
    const forbid = await templatePatch(jsonRequest(`http://t/api/followup-templates/${t.id}`, "PATCH", { name: "Sửa trộm" }), { params: { id: t.id } });
    expect(forbid.status).toBe(403);
  });

  it("ÁP quy trình: có followup.apply → 200; chỉ task.write (thiếu apply) → 403", async () => {
    const t = await activeTemplate();
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH áp" } });

    const cskh = await makeStaff([PERMISSIONS.FOLLOWUP_APPLY, PERMISSIONS.CUSTOMER_READ]);
    await login(cskh.email, cskh.password);
    const okRes = await applyPost(jsonRequest(`http://t/api/followup-templates/${t.id}/apply`, "POST", { customerId: cust.id, anchorDate: "2026-08-14" }), { params: { id: t.id } });
    expect(okRes.status).toBe(200);

    const noApply = await makeStaff([PERMISSIONS.TASK_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(noApply.email, noApply.password);
    const forbid = await applyPost(jsonRequest(`http://t/api/followup-templates/${t.id}/apply`, "POST", { customerId: cust.id, anchorDate: "2026-08-14", force: true }), { params: { id: t.id } });
    expect(forbid.status).toBe(403);
  });
});

describe("C · Chống trùng qua HTTP", () => {
  it("áp lại cùng ngày → 409 kèm lần áp đang chạy; force → 200", async () => {
    const t = await activeTemplate();
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH trùng" } });
    const s = await makeStaff([PERMISSIONS.FOLLOWUP_APPLY, PERMISSIONS.CUSTOMER_READ]);
    await login(s.email, s.password);

    const r1 = await applyPost(jsonRequest(`http://t/api/x/apply`, "POST", { customerId: cust.id, anchorDate: "2026-08-14" }), { params: { id: t.id } });
    expect(r1.status).toBe(200);

    const r2 = await applyPost(jsonRequest(`http://t/api/x/apply`, "POST", { customerId: cust.id, anchorDate: "2026-08-14" }), { params: { id: t.id } });
    expect(r2.status).toBe(409);
    const body = await readJson(r2);
    expect(body.details?.existing?.code).toBeTruthy();

    const r3 = await applyPost(jsonRequest(`http://t/api/x/apply`, "POST", { customerId: cust.id, anchorDate: "2026-08-14", force: true }), { params: { id: t.id } });
    expect(r3.status).toBe(200);
  });
});

describe("G · Vòng đời task + audit", () => {
  it("hoàn thành ghi completedAt/By + audit; mở lại cần lý do", async () => {
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH task" } });
    const s = await makeStaff([PERMISSIONS.TASK_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(s.email, s.password);

    // tạo task
    const created = await tasksPost(jsonRequest("http://t/api/tasks", "POST", { title: "Gọi khách", customerId: cust.id }), {});
    const task = (await readJson(created)).data;

    // hoàn thành
    const done = await taskPatch(jsonRequest(`http://t/api/tasks/${task.id}`, "PATCH", { action: "complete", completionNote: "Đã gọi, khách OK", actualChannel: "ZALO" }), { params: { id: task.id } });
    expect(done.status).toBe(200);
    const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(dbTask?.status).toBe("DONE");
    expect(dbTask?.completedBy).toBe(s.user.name);
    expect(dbTask?.completedAt).toBeTruthy();
    expect(dbTask?.completionNote).toBe("Đã gọi, khách OK");
    const auditDone = await prisma.auditLog.findFirst({ where: { action: "TASK_COMPLETED", entityId: task.id } });
    expect(auditDone).toBeTruthy();

    // mở lại thiếu lý do → 422
    const noReason = await taskPatch(jsonRequest(`http://t/api/tasks/${task.id}`, "PATCH", { action: "reopen" }), { params: { id: task.id } });
    expect(noReason.status).toBe(422);

    // mở lại có lý do → 200 + audit
    const reopen = await taskPatch(jsonRequest(`http://t/api/tasks/${task.id}`, "PATCH", { action: "reopen", reason: "Khách chưa phản hồi" }), { params: { id: task.id } });
    expect(reopen.status).toBe(200);
    const reopened = await prisma.task.findUnique({ where: { id: task.id } });
    expect(reopened?.status).toBe("OPEN");
    expect(reopened?.reopenReason).toBe("Khách chưa phản hồi");
    const auditReopen = await prisma.auditLog.findFirst({ where: { action: "TASK_REOPENED", entityId: task.id } });
    expect(auditReopen).toBeTruthy();
  });
});

describe("F · Quá hạn (filter overdue)", () => {
  it("task chưa xong đã quá hạn → có trong filter=overdue, không trong filter=done", async () => {
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH overdue" } });
    const s = await makeStaff([PERMISSIONS.TASK_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(s.email, s.password);
    const past = new Date(Date.now() - 3 * 86_400_000);
    const overdueTask = await prisma.task.create({ data: { title: "Việc quá hạn", customerId: cust.id, dueDate: past, status: "OPEN" } });

    const ov = await readJson(await tasksGet(jsonRequest("http://t/api/tasks?filter=overdue", "GET"), {}));
    expect(ov.data.map((x: any) => x.id)).toContain(overdueTask.id);

    const done = await readJson(await tasksGet(jsonRequest("http://t/api/tasks?filter=done", "GET"), {}));
    expect(done.data.map((x: any) => x.id)).not.toContain(overdueTask.id);
  });
});
