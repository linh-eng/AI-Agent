// =============================================================================
// Redesign P4 — Actual Treatment Session: chọn phương án + đông cứng snapshot +
// tiêu hao vật tư thực tế (idempotent + reversal ledger). Nghiệm thu HTTP thật.
//   A legacy read · B walk-in planId null · C 1 Booking/3 item → 1 Session/3 exec
//   D BookingItem không mutate · E actual≠recommended · F snapshot frozen
//   G Service version đổi → snapshot cũ giữ · H product qty std vs actual riêng
//   J deduct actual only · K idempotency chống double-deduct · L reversal ledger
//   M double-reversal blocked · N completion retry no double effect · O completed edit audit
//   P treatment.write 401/403 · Q material.write 403 · R finance mask · S plan session regression.
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
import { POST as sessPost } from "@/app/api/treatment-sessions/route";
import { GET as sessGet, PATCH as sessPatch } from "@/app/api/treatment-sessions/[id]/route";
import { POST as execPost, GET as execGet } from "@/app/api/session-executions/route";
import { PATCH as execPatch } from "@/app/api/session-executions/[id]/route";
import { PATCH as svcPatch } from "@/app/api/services/[id]/route";
import { POST as usagePost } from "@/app/api/material-usages/route";
import { POST as usageReverse } from "@/app/api/material-usages/[id]/reverse/route";

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
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.12.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {} as any);
  return jar.get(SESSION_COOKIE);
}

let full: { email: string; password: string }; // treatment.write + material.write + editCompleted + finance
let noFin: { email: string; password: string }; // treatment.write nhưng KHÔNG finance
let reader: { email: string; password: string }; // chỉ read
let cust: any, dmk: any, laser: any, recovery: any, enzymeStepOptId: string;

beforeAll(async () => {
  await resetDb();
  full = await makeStaff([PERMISSIONS.TREATMENT_READ, PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.TREATMENT_EDIT_COMPLETED, PERMISSIONS.MATERIAL_WRITE, PERMISSIONS.SERVICE_READ, PERMISSIONS.SERVICE_WRITE, PERMISSIONS.CUSTOMER_READ, PERMISSIONS.BOOKING_WRITE, PERMISSIONS.FINANCE_READ]);
  noFin = await makeStaff([PERMISSIONS.TREATMENT_READ, PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.CUSTOMER_READ]);
  reader = await makeStaff([PERMISSIONS.TREATMENT_READ, PERMISSIONS.CUSTOMER_READ]);
  cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách P4" } });
  // DMK với 1 bước có 2 phương án (Enzyme #1 / #2)
  dmk = await prisma.service.create({
    data: {
      code: uniq("DV"), name: "DMK Enzyme Treatment", status: "ACTIVE", durationMinutes: 83, standardPrice: 2_500_000, version: 1,
      steps: { create: [{ sortOrder: 0, name: "Đắp Enzyme", durationMinutes: 40, isRequired: true, options: { create: [
        { sortOrder: 0, name: "Enzyme #1", selectMode: "SINGLE_SELECT", isDefault: false, quantity: 5, unit: "g" },
        { sortOrder: 1, name: "Enzyme #2", selectMode: "SINGLE_SELECT", isDefault: true, quantity: 5, unit: "g" },
      ] } }] },
    },
    include: { steps: { include: { options: true } } },
  });
  enzymeStepOptId = dmk.steps[0].options.find((o: any) => o.name === "Enzyme #1").id;
  laser = await prisma.service.create({ data: { code: uniq("DV"), name: "Laser Pico", status: "ACTIVE", durationMinutes: 30, standardPrice: 2_000_000, version: 1 } });
  recovery = await prisma.service.create({ data: { code: uniq("DV"), name: "Recovery", status: "ACTIVE", durationMinutes: 15, standardPrice: 600_000, version: 1 } });
});
beforeEach(() => { jar.clear(); });

describe("Redesign P4 · Actual Treatment Session (execution + snapshot + inventory)", () => {
  it("A · Legacy session (không execution/snapshot) vẫn đọc được, không giả snapshot", async () => {
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "PĐ" } });
    const legacy = await prisma.treatmentSession.create({ data: { code: uniq("SS"), planId: plan.id, customerId: cust.id, sessionNumber: 1, status: "COMPLETED", serviceId: dmk.id } });
    await login(full.email, full.password);
    const got = await rj(await sessGet(jreq(`http://t/api/treatment-sessions/${legacy.id}`, "GET"), { params: { id: legacy.id } } as any));
    expect(got.data.executionItems).toHaveLength(0);
    expect(got.data.executionFrozenAt).toBeNull(); // KHÔNG fabricate
    expect(got.data.executionSnapshot).toBeNull();
  });

  it("B · Walk-in: Booking không phác đồ → Session planId null (không auto-tạo plan)", async () => {
    await login(full.email, full.password);
    const bk = await prisma.booking.create({ data: { code: uniq("BK"), customerId: cust.id, serviceId: dmk.id, scheduledAt: new Date("2026-09-10T02:00:00Z") } });
    const created = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { bookingId: bk.id, serviceId: dmk.id }), {} as any));
    expect(created.data.id).toBeTruthy();
    expect(created.data.planId).toBeNull();
    expect(created.data.customerId).toBe(cust.id);
    // KHÔNG có plan mới nào được tạo cho khách này ngoài các plan test khác
    const s = await prisma.treatmentSession.findUnique({ where: { id: created.data.id }, select: { planId: true } });
    expect(s!.planId).toBeNull();
  });

  it("C+D · 1 Booking / 3 BookingItems → 1 Session / 3 ExecutionItems; BookingItem KHÔNG mutate", async () => {
    await login(full.email, full.password);
    const bk = await prisma.booking.create({
      data: { code: uniq("BK"), customerId: cust.id, serviceId: dmk.id, scheduledAt: new Date("2026-09-11T02:00:00Z"),
        items: { create: [{ sortOrder: 0, serviceId: dmk.id, durationSnapshot: 83 }, { sortOrder: 1, serviceId: laser.id, durationSnapshot: 30 }, { sortOrder: 2, serviceId: recovery.id, durationSnapshot: 15 }] } },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { bookingId: bk.id }), {} as any));
    const sid = sess.data.id;
    for (const [i, bi] of bk.items.entries()) {
      await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: sid, serviceId: bi.serviceId, bookingItemId: bi.id, selectedOptionSource: "PRACTITIONER_ADHOC" }), {} as any);
    }
    const items = await rj(await execGet(jreq(`http://t/api/session-executions?sessionId=${sid}`, "GET"), {} as any));
    expect(items.data).toHaveLength(3);
    expect(items.data.map((x: any) => x.sortOrder)).toEqual([0, 1, 2]);
    // BookingItem KHÔNG bị đổi (vẫn 3, durationSnapshot giữ nguyên)
    const biAfter = await prisma.bookingItem.findMany({ where: { bookingId: bk.id }, orderBy: { sortOrder: "asc" } });
    expect(biAfter.map((b) => b.durationSnapshot)).toEqual([83, 30, 15]);
  });

  it("E+F+G+H · actual≠recommended + snapshot frozen + version bump không đổi snapshot + qtyStd≠qtyActual", async () => {
    await login(full.email, full.password);
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { customerId: cust.id, serviceId: dmk.id }), {} as any));
    const sid = sess.data.id;
    // Protocol recommend Enzyme #2 nhưng THỰC TẾ chọn Enzyme #1, 4g (std 5g)
    const exec = await rj(await execPost(jreq("http://t/api/session-executions", "POST", {
      sessionId: sid, serviceId: dmk.id, selectedOptionSource: "SERVICE_SOP_OPTION",
      selectedOptionId: enzymeStepOptId, selectedOptionName: "Enzyme #1",
      actualValues: [{ stepName: "Đắp Enzyme", productName: "Enzyme #1", qtyStd: 5, qtyActual: 4, unit: "g" }],
    }), {} as any));
    const execId = exec.data.id;
    const snap = exec.data.executionSnapshot;
    expect(snap.source.version).toBe(1);
    expect(snap.option.name).toBe("Enzyme #1"); // actual selected
    expect(snap.option.classification).toBeNull(); // Decision 2 defer
    expect(snap.actualValues[0].qtyStd).toBe(5);
    expect(snap.actualValues[0].qtyActual).toBe(4); // std ≠ actual, cả 2 giữ
    // Đổi SOP của Service (bump version 1→2, đổi option) SAU khi snapshot đã đông cứng
    await svcPatch(jreq(`http://t/api/services/${dmk.id}`, "PATCH", { steps: [{ name: "Đắp Enzyme v2", durationMinutes: 50, options: [{ name: "Enzyme #3", quantity: 9, unit: "g" }] }] }), { params: { id: dmk.id } } as any);
    const svcAfter = await prisma.service.findUnique({ where: { id: dmk.id }, select: { version: true } });
    expect(svcAfter!.version).toBe(2);
    // Snapshot cũ KHÔNG đổi
    const reread = await prisma.sessionExecutionItem.findUnique({ where: { id: execId } });
    const s2 = reread!.executionSnapshot as any;
    expect(s2.source.version).toBe(1);
    expect(s2.option.name).toBe("Enzyme #1");
    expect(s2.actualValues[0].qtyActual).toBe(4);
    expect(reread!.sourceVersion).toBe(1);
  });

  it("J+K · Inventory trừ theo ACTUAL + idempotency chống double-deduct", async () => {
    await login(full.email, full.password);
    const mat = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name: "Enzyme lọ", unit: "g" } });
    const cont = await prisma.materialContainer.create({ data: { containerNo: uniq("CT"), usageMaterialId: mat.id, initialQty: 100, remainingQty: 100, unit: "g", costSnapshot: 2_000_000 } });
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { customerId: cust.id, serviceId: dmk.id }), {} as any));
    const key = uniq("idem");
    // POST 2 lần cùng idempotencyKey → chỉ trừ 4g một lần
    const r1 = await rj(await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, sessionId: sess.data.id, quantity: 4, idempotencyKey: key }), {} as any));
    const r2 = await rj(await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, sessionId: sess.data.id, quantity: 4, idempotencyKey: key }), {} as any));
    expect(r1.data.id).toBe(r2.data.id); // cùng usage, không tạo mới
    const c = await prisma.materialContainer.findUnique({ where: { id: cont.id } });
    expect(Number(c!.remainingQty)).toBe(96); // chỉ trừ 4 (ACTUAL), không double
    const cnt = await prisma.materialUsage.count({ where: { containerId: cont.id, usageType: "CONSUMPTION" } });
    expect(cnt).toBe(1);
  });

  it("L+M · Reversal ledger (không hard-delete) + chặn hoàn tác 2 lần", async () => {
    await login(full.email, full.password);
    const mat = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name: "Serum", unit: "ml" } });
    const cont = await prisma.materialContainer.create({ data: { containerNo: uniq("CT"), usageMaterialId: mat.id, initialQty: 50, remainingQty: 50, unit: "ml", costSnapshot: 1_000_000 } });
    const usage = await rj(await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, quantity: 4 }), {} as any));
    // reverse
    const rev = await rj(await usageReverse(jreq(`http://t/api/material-usages/${usage.data.id}/reverse`, "POST", { reason: "Ghi nhầm 4ml" }), { params: { id: usage.data.id } } as any));
    expect(rev.data.reversed).toBe(true);
    // Bản GỐC vẫn tồn tại + đánh dấu reversedAt; có 1 record REVERSAL
    const orig = await prisma.materialUsage.findUnique({ where: { id: usage.data.id } });
    expect(orig).not.toBeNull();
    expect(orig!.reversedAt).not.toBeNull();
    const reversal = await prisma.materialUsage.findFirst({ where: { reversalOfUsageId: usage.data.id, usageType: "REVERSAL" } });
    expect(reversal).not.toBeNull();
    // Stock cộng lại
    const c = await prisma.materialContainer.findUnique({ where: { id: cont.id } });
    expect(Number(c!.remainingQty)).toBe(50);
    // Hoàn tác lần 2 → chặn
    const again = await usageReverse(jreq(`http://t/api/material-usages/${usage.data.id}/reverse`, "POST", { reason: "lần 2" }), { params: { id: usage.data.id } } as any);
    expect(again.status).toBe(400);
  });

  it("N · Completion retry không double-effect + freeze snapshot buổi", async () => {
    await login(full.email, full.password);
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { customerId: cust.id, serviceId: laser.id }), {} as any));
    const sid = sess.data.id;
    await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: sid, serviceId: laser.id, selectedOptionSource: "PRACTITIONER_ADHOC" }), {} as any);
    // complete lần 1
    await sessPatch(jreq(`http://t/api/treatment-sessions/${sid}`, "PATCH", { status: "COMPLETED", serviceId: laser.id }), { params: { id: sid } } as any);
    const s1 = await prisma.treatmentSession.findUnique({ where: { id: sid }, select: { executionFrozenAt: true, executionSnapshot: true } });
    expect(s1!.executionFrozenAt).not.toBeNull();
    const frozenAt1 = s1!.executionFrozenAt;
    // "complete lần 2" (retry với editReason) — không đổi frozenAt (idempotent freeze)
    await sessPatch(jreq(`http://t/api/treatment-sessions/${sid}`, "PATCH", { status: "COMPLETED", editReason: "retry" }), { params: { id: sid } } as any);
    const s2 = await prisma.treatmentSession.findUnique({ where: { id: sid }, select: { executionFrozenAt: true } });
    expect(s2!.executionFrozenAt!.getTime()).toBe(frozenAt1!.getTime()); // không re-freeze
  });

  it("O · Sửa completed session (execution item) cần lý do + audit", async () => {
    await login(full.email, full.password);
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { customerId: cust.id, serviceId: laser.id }), {} as any));
    const sid = sess.data.id;
    const exec = await rj(await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: sid, serviceId: laser.id, selectedOptionSource: "PRACTITIONER_ADHOC" }), {} as any));
    await sessPatch(jreq(`http://t/api/treatment-sessions/${sid}`, "PATCH", { status: "COMPLETED", serviceId: laser.id }), { params: { id: sid } } as any);
    // Sửa exec item không lý do → 422
    const noReason = await execPatch(jreq(`http://t/api/session-executions/${exec.data.id}`, "PATCH", { note: "sửa" }), { params: { id: exec.data.id } } as any);
    expect(noReason.status).toBe(422);
    // Có lý do → OK + audit
    const ok = await execPatch(jreq(`http://t/api/session-executions/${exec.data.id}`, "PATCH", { note: "sửa lại giờ", reason: "nhập nhầm" }), { params: { id: exec.data.id } } as any);
    expect(ok.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "SessionExecutionItem", entityId: exec.data.id, action: "SESSION_EXECUTION_CHANGED" }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("P+Q · RBAC: treatment.write thiếu → 403/401; material.write thiếu → 403", async () => {
    // reader (không treatment.write) không tạo execution
    await login(reader.email, reader.password);
    const res403 = await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: "x", serviceId: dmk.id }), {} as any);
    expect(res403.status).toBe(403);
    jar.clear();
    const res401 = await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: "x", serviceId: dmk.id }), {} as any);
    expect(res401.status).toBe(401);
    // noFin có treatment.write nhưng KHÔNG material.write → POST usage 403
    await login(noFin.email, noFin.password);
    const resMat = await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: "x", quantity: 1 }), {} as any);
    expect(resMat.status).toBe(403);
  });

  it("R · Finance mask: non-finance KHÔNG thấy costAllocated của usage; S · plan session regression", async () => {
    // S — session gắn plan vẫn hoạt động
    await login(full.email, full.password);
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "PĐ2" } });
    const created = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { planId: plan.id, serviceId: dmk.id, sessionNumber: 1 }), {} as any));
    expect(created.data.planId).toBe(plan.id);
    // R — finance mask trên material-usages GET
    const { GET: usageList } = await import("@/app/api/material-usages/route");
    const mat = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name: "X", unit: "ml" } });
    const cont = await prisma.materialContainer.create({ data: { containerNo: uniq("CT"), usageMaterialId: mat.id, initialQty: 20, remainingQty: 20, unit: "ml", costSnapshot: 400_000 } });
    await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, sessionId: created.data.id, quantity: 2 }), {} as any);
    await login(noFin.email, noFin.password);
    const listed = await rj(await usageList(jreq(`http://t/api/material-usages?sessionId=${created.data.id}`, "GET"), {} as any));
    expect(listed.data[0].costAllocated).toBeNull(); // masked
    await login(full.email, full.password);
    const listedFin = await rj(await usageList(jreq(`http://t/api/material-usages?sessionId=${created.data.id}`, "GET"), {} as any));
    expect(Number(listedFin.data[0].costAllocated)).toBeGreaterThan(0);
  });
});
