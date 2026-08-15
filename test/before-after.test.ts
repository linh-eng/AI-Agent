// =============================================================================
// Mục 10 — Before/After & Đánh giá: test tích hợp (lib + HTTP route thật, PG thật).
//   * Lineage: ảnh Before/After truy ngược đúng session→khách→dịch vụ→KTV.
//   * Filter: khách/dịch vụ/ngày (gallery); KPI dùng CÙNG bộ lọc (không global).
//   * Privacy: ảnh mới mặc định RIÊNG TƯ; bật/tắt "Khách thấy" persist + audit;
//     portal chỉ thấy ảnh của chính khách + đã chia sẻ; chống lộ chéo khách (404).
//   * RBAC: thiếu quyền → 403; ẩn danh → 401.
//   * KPI: số đánh giá / hài lòng TB / KTV TB / theo KTV / tỷ lệ quay lại đúng DB.
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
import { PORTAL_COOKIE } from "@/lib/portal-auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { reviewSummary, beforeAfterGroups } from "@/lib/review";

import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as portalLogin } from "@/app/api/portal/login/route";
import { POST as mediaPost } from "@/app/api/media/route";
import { PATCH as mediaPatch } from "@/app/api/media/[id]/route";
import { GET as portalMediaGet } from "@/app/api/portal/media/[id]/route";
import { GET as portalOverview } from "@/app/api/portal/overview/route";
import { GET as beforeAfterGet } from "@/app/api/before-after/route";
import { GET as summaryGet } from "@/app/api/session-reviews/summary/route";
import { POST as reviewPost } from "@/app/api/session-reviews/route";

// 1x1 PNG hợp lệ (magic bytes để qua validateUploadBytes).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

let ip = 0;
function jreq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
function freq(url: string, fields: Record<string, string>, file?: { name: string; type: string; buf: Buffer }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("file", new File([new Uint8Array(file.buf)], file.name, { type: file.type }), file.name);
  return new Request(url, { method: "POST", body: fd });
}
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }

async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const password = "matkhau123";
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword(password) } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) {
    const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  return { user, email, password };
}
async function loginStaff(email: string, password: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.5.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {});
  return jar.get(SESSION_COOKIE);
}
async function makePortalCustomer(fullName: string) {
  const customer = await prisma.customer.create({ data: { code: uniq("KH"), fullName } });
  const email = `${uniq("kh")}@mail.com`.toLowerCase();
  await prisma.customerPortalAccount.create({ data: { customerId: customer.id, email, passwordHash: await hashPassword("khach123") } });
  return { customer, email };
}
async function loginPortal(email: string) {
  jar.clear();
  await portalLogin(new Request("http://t/api/portal/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.6.0.${++ip}` }, body: JSON.stringify({ email, password: "khach123" }) }), {});
  return jar.get(PORTAL_COOKIE);
}

// Dựng: service + plan/stage/session COMPLETED cho 1 khách.
async function completedSession(customerId: string, opts: { serviceId?: string; performer?: string; performedAt?: Date } = {}) {
  const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId, name: "Phác đồ" } });
  return prisma.treatmentSession.create({
    data: {
      planId: plan.id, customerId, sessionNumber: 1, name: "Buổi 1", status: "COMPLETED",
      serviceId: opts.serviceId ?? null, performer: opts.performer ?? null,
      performedAt: opts.performedAt ?? new Date("2026-08-10T03:00:00Z"),
    },
  });
}
async function makeService(name: string) {
  return prisma.service.create({ data: { code: uniq("DV"), name, durationMinutes: 60, standardPrice: 1_000_000 } });
}
async function uploadImage(kind: string, customerId: string, sessionId: string) {
  const res = await mediaPost(freq("http://t/api/media", { kind, customerId, sessionId }, { name: "x.png", type: "image/png", buf: PNG }), {});
  return rj(res);
}

beforeAll(async () => { await resetDb(); });
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Mục 10 · Lineage + Filter (gallery)", () => {
  it("A · ảnh Before/After truy ngược đúng session→khách→dịch vụ→KTV; ảnh không có session KHÔNG vào gallery", async () => {
    const staff = await makeStaff([PERMISSIONS.CUSTOMER_READ, PERMISSIONS.MEDIA_WRITE, PERMISSIONS.TREATMENT_READ]);
    await loginStaff(staff.email, staff.password);
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách A" } });
    const svc = await makeService("RF nâng cơ");
    const sess = await completedSession(cust.id, { serviceId: svc.id, performer: "KTV Minh" });
    const b = await uploadImage("BEFORE_IMAGE", cust.id, sess.id);
    const a = await uploadImage("AFTER_IMAGE", cust.id, sess.id);
    // ảnh KHÔNG gắn session (chỉ customer) — không được vào gallery
    await mediaPost(freq("http://t/api/media", { kind: "BEFORE_IMAGE", customerId: cust.id }, { name: "y.png", type: "image/png", buf: PNG }), {});

    const groups = await beforeAfterGroups({});
    const g = groups.find((x) => x.sessionId === sess.id);
    expect(g).toBeTruthy();
    expect(g!.customerId).toBe(cust.id);
    expect(g!.customerName).toBe("Khách A");
    expect(g!.serviceName).toBe("RF nâng cơ");
    expect(g!.technicianName).toBe("KTV Minh");
    expect(g!.before.map((m) => m.id)).toContain(b.data.id);
    expect(g!.after.map((m) => m.id)).toContain(a.data.id);
    // đúng lineage trong DB
    const dbB = await prisma.mediaAsset.findUnique({ where: { id: b.data.id } });
    expect(dbB!.sessionId).toBe(sess.id);
    expect(dbB!.customerId).toBe(cust.id);
    // ảnh không session không tạo group mồ côi
    expect(groups.every((x) => x.before.length + x.after.length > 0)).toBe(true);
  });

  it("B · lọc theo khách/dịch vụ/ngày cô lập đúng nhóm", async () => {
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách B" } });
    const svcRF = await makeService("RF");
    const svcHIFU = await makeService("HIFU");
    const sRF = await completedSession(cust.id, { serviceId: svcRF.id, performedAt: new Date("2026-08-01T03:00:00Z") });
    const sHIFU = await completedSession(cust.id, { serviceId: svcHIFU.id, performedAt: new Date("2026-09-01T03:00:00Z") });
    await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "a", contentType: "image/png", size: 1, kind: "BEFORE_IMAGE", customerId: cust.id, sessionId: sRF.id } });
    await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "b", contentType: "image/png", size: 1, kind: "AFTER_IMAGE", customerId: cust.id, sessionId: sHIFU.id } });

    expect((await beforeAfterGroups({ customerId: cust.id, serviceId: svcRF.id })).map((g) => g.sessionId)).toEqual([sRF.id]);
    expect((await beforeAfterGroups({ customerId: cust.id, serviceId: svcHIFU.id })).map((g) => g.sessionId)).toEqual([sHIFU.id]);
    // lọc ngày: chỉ tháng 8
    const aug = await beforeAfterGroups({ customerId: cust.id, from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-08-31T23:59:59Z") });
    expect(aug.map((g) => g.sessionId)).toEqual([sRF.id]);
  });
});

describe("Mục 10 · Privacy / Khách thấy", () => {
  it("D+E+F+G+H · mặc định private; bật share persist+audit; portal chỉ thấy ảnh của mình đã chia sẻ; chống lộ chéo", async () => {
    const staff = await makeStaff([PERMISSIONS.CUSTOMER_READ, PERMISSIONS.MEDIA_WRITE]);
    await loginStaff(staff.email, staff.password);
    const A = await makePortalCustomer("Khách A");
    const B = await makePortalCustomer("Khách B");
    const sA = await completedSession(A.customer.id);
    const img = await uploadImage("AFTER_IMAGE", A.customer.id, sA.id);
    const id = img.data.id;

    // D · mặc định RIÊNG TƯ ở DB (không dựa checkbox UI)
    const db0 = await prisma.mediaAsset.findUnique({ where: { id } });
    expect(db0!.sharedWithCustomer).toBe(false);

    // F · chưa chia sẻ → portal chủ sở hữu cũng KHÔNG tải được (404)
    await loginPortal(A.email);
    expect((await portalMediaGet(jreq(`http://t/api/portal/media/${id}`, "GET"), { params: { id } })).status).toBe(404);

    // E · nhân viên bật "Khách thấy" → DB đổi + audit MEDIA_SHARED
    await loginStaff(staff.email, staff.password);
    const patch = await mediaPatch(jreq(`http://t/api/media/${id}`, "PATCH", { sharedWithCustomer: true }), { params: { id } });
    expect(patch.status).toBe(200);
    expect((await prisma.mediaAsset.findUnique({ where: { id } }))!.sharedWithCustomer).toBe(true);
    expect(await prisma.auditLog.findFirst({ where: { action: "MEDIA_SHARED", entityId: id } })).toBeTruthy();

    // G · chủ sở hữu (đã đăng nhập portal) tải được (200)
    await loginPortal(A.email);
    expect((await portalMediaGet(jreq(`http://t/api/portal/media/${id}`, "GET"), { params: { id } })).status).toBe(200);
    // portal overview liệt kê ảnh đã chia sẻ của chính khách
    const ov = await rj(await portalOverview(jreq("http://t/api/portal/overview", "GET"), {}));
    expect(ov.data.media.map((m: any) => m.id)).toContain(id);

    // H · khách B KHÔNG xem được ảnh của A (dù đã chia sẻ cho A) → 404, không lộ tồn tại
    await loginPortal(B.email);
    expect((await portalMediaGet(jreq(`http://t/api/portal/media/${id}`, "GET"), { params: { id } })).status).toBe(404);
    const ovB = await rj(await portalOverview(jreq("http://t/api/portal/overview", "GET"), {}));
    expect(ovB.data.media.map((m: any) => m.id)).not.toContain(id);

    // C(privacy) · tắt lại → portal chủ sở hữu không còn tải được
    await loginStaff(staff.email, staff.password);
    await mediaPatch(jreq(`http://t/api/media/${id}`, "PATCH", { sharedWithCustomer: false }), { params: { id } });
    expect(await prisma.auditLog.findFirst({ where: { action: "MEDIA_UNSHARED", entityId: id } })).toBeTruthy();
    await loginPortal(A.email);
    expect((await portalMediaGet(jreq(`http://t/api/portal/media/${id}`, "GET"), { params: { id } })).status).toBe(404);
    // nội bộ vẫn còn (không mất lịch sử)
    expect(await prisma.mediaAsset.findUnique({ where: { id } })).toBeTruthy();
  });

  it("RBAC · thiếu quyền → 403; ẩn danh → 401; media PATCH cần media.write", async () => {
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    const s = await completedSession(cust.id);
    const media = await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "a", contentType: "image/png", size: 1, kind: "AFTER_IMAGE", customerId: cust.id, sessionId: s.id } });

    // ẩn danh → 401
    jar.clear();
    expect((await beforeAfterGet(jreq("http://t/api/before-after", "GET"), {})).status).toBe(401);

    // staff CÓ customer.read → gallery 200
    const reader = await makeStaff([PERMISSIONS.CUSTOMER_READ, PERMISSIONS.TREATMENT_READ]);
    await loginStaff(reader.email, reader.password);
    expect((await beforeAfterGet(jreq("http://t/api/before-after", "GET"), {})).status).toBe(200);
    // nhưng KHÔNG có media.write → PATCH media 403
    expect((await mediaPatch(jreq(`http://t/api/media/${media.id}`, "PATCH", { sharedWithCustomer: true }), { params: { id: media.id } })).status).toBe(403);
  });
});

describe("Mục 10 · KPI đúng DB + filter consistency", () => {
  it("I/J/K/L · số đánh giá / hài lòng TB / KTV TB / theo KTV / tỷ lệ quay lại + KPI theo bộ lọc", async () => {
    const staff = await makeStaff([PERMISSIONS.TREATMENT_READ, PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await loginStaff(staff.email, staff.password);
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH KPI" } });
    const svcRF = await makeService("RF");
    const svcHIFU = await makeService("HIFU");
    const s1 = await completedSession(cust.id, { serviceId: svcRF.id, performer: "KTV A" });
    const s2 = await completedSession(cust.id, { serviceId: svcRF.id, performer: "KTV B" });
    const s3 = await completedSession(cust.id, { serviceId: svcHIFU.id, performer: "KTV A" });
    // 3 đánh giá thật qua API: (5,5,ret)(4,4,noret) KTV A×2? -> để 2 KTV: s1=KTV A 5/5 ret, s2=KTV B 4/4 noret, s3=KTV A 5/5 ret
    await reviewPost(jreq("http://t/api/session-reviews", "POST", { sessionId: s1.id, satisfactionScore: 5, technicianScore: 5, technicianName: "KTV A", wouldReturn: true }), {});
    await reviewPost(jreq("http://t/api/session-reviews", "POST", { sessionId: s2.id, satisfactionScore: 4, technicianScore: 4, technicianName: "KTV B", wouldReturn: false }), {});
    await reviewPost(jreq("http://t/api/session-reviews", "POST", { sessionId: s3.id, satisfactionScore: 5, technicianScore: 5, technicianName: "KTV A", wouldReturn: true }), {});

    // Global
    const all = await reviewSummary();
    expect(all.totalReviews).toBe(3);
    expect(all.avgSatisfaction).toBe(Math.round(((5 + 4 + 5) / 3) * 100) / 100); // 4.67
    expect(all.avgTechnician).toBe(4.67);
    expect(all.wouldReturnRate).toBe(67); // 2/3
    const tA = all.technicians.find((t) => t.technicianName === "KTV A")!;
    const tB = all.technicians.find((t) => t.technicianName === "KTV B")!;
    expect(tA.count).toBe(2); expect(tA.avgTechnicianScore).toBe(5); // KTV A không nhận điểm của B
    expect(tB.count).toBe(1); expect(tB.avgTechnicianScore).toBe(4);

    // Filter theo dịch vụ RF (2 review) — KPI đổi theo bộ lọc, KHÔNG global
    const rf = await reviewSummary({ serviceId: svcRF.id });
    expect(rf.totalReviews).toBe(2);
    expect(rf.avgSatisfaction).toBe(4.5);
    // Filter HIFU (1 review)
    const hifu = await reviewSummary({ serviceId: svcHIFU.id });
    expect(hifu.totalReviews).toBe(1);
    expect(hifu.avgSatisfaction).toBe(5);

    // API summary cũng nhận filter (khớp gallery)
    const apiRf = await rj(await summaryGet(new Request(`http://t/api/session-reviews/summary?serviceId=${svcRF.id}`, { method: "GET" }), {}));
    expect(apiRf.data.totalReviews).toBe(2);
  });
});
