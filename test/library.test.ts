// =============================================================================
// Mục 11 — Dịch vụ & Thư viện Spa (master data): nghiệm thu tích hợp trên PG thật.
//   * RBAC backend từng thư viện (thiếu quyền → 403; ẩn danh → 401).
//   * Soft-delete = giữ toàn vẹn tham chiếu (không hard-delete; lịch sử còn).
//   * Bất biến: FormInstance schemaSnapshot+version; CareInstance content snapshot;
//     Protocol bumpVersion append-only (changeLog) — session cũ không bị rewrite.
//   * Active-only: dropdown master chỉ trả bản đang dùng.
//   * Quan hệ: Brand→Product (productType phân loại, không theo tên); Technology
//     dùng xuyên Service/Employee-competence/Session.
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
import { GET as techGet, POST as techPost } from "@/app/api/technologies/route";
import { PATCH as techPatch, DELETE as techDelete } from "@/app/api/technologies/[id]/route";
import { POST as brandPost } from "@/app/api/brands/route";
import { POST as productPost } from "@/app/api/spa-products/route";
import { POST as protocolPost } from "@/app/api/brand-protocols/route";
import { PATCH as protocolPatch } from "@/app/api/brand-protocols/[id]/route";
import { POST as formTplPost } from "@/app/api/form-templates/route";
import { GET as careInstrGet } from "@/app/api/care-instructions/route";

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
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.8.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {});
  return jar.get(SESSION_COOKIE);
}

beforeAll(async () => { await resetDb(); });
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Mục 11 · RBAC backend từng thư viện", () => {
  it("L · thiếu quyền → 403; ẩn danh → 401; đúng quyền → 200/201", async () => {
    // ẩn danh
    expect((await techGet(jreq("http://t/api/technologies", "GET"), {})).status).toBe(401);

    // reader (library.read) đọc được, KHÔNG ghi được technology
    const reader = await makeStaff([PERMISSIONS.LIBRARY_READ]);
    await login(reader.email, reader.password);
    expect((await techGet(jreq("http://t/api/technologies", "GET"), {})).status).toBe(200);
    expect((await techPost(jreq("http://t/api/technologies", "POST", { name: "X" }), {})).status).toBe(403);
    // reader không có brand.write / catalog.write / protocol.write / form.write
    expect((await brandPost(jreq("http://t/api/brands", "POST", { name: "B" }), {})).status).toBe(403);
    expect((await productPost(jreq("http://t/api/spa-products", "POST", { name: "P" }), {})).status).toBe(403);
    expect((await protocolPost(jreq("http://t/api/brand-protocols", "POST", { name: "PR" }), {})).status).toBe(403);
    expect((await formTplPost(jreq("http://t/api/form-templates", "POST", { name: "F", schema: {} }), {})).status).toBe(403);

    // người có technology.write ghi được
    const techWriter = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.TECHNOLOGY_WRITE]);
    await login(techWriter.email, techWriter.password);
    const created = await techPost(jreq("http://t/api/technologies", "POST", { name: "RF nâng cơ" }), {});
    expect(created.status).toBe(201);
  });
});

describe("Mục 11 · Soft-delete = toàn vẹn tham chiếu (K/M)", () => {
  it("xóa Technology đang được Session tham chiếu → inactive (không hard-delete); session giữ link", async () => {
    const admin = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.TECHNOLOGY_WRITE]);
    await login(admin.email, admin.password);
    const tech = await prisma.technology.create({ data: { code: uniq("CN"), name: "HIFU nâng cơ", isActive: true } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const sess = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, status: "COMPLETED", technologyId: tech.id } });

    const del = await techDelete(jreq(`http://t/api/technologies/${tech.id}`, "DELETE"), { params: { id: tech.id } });
    expect(del.status).toBe(200);
    // KHÔNG hard-delete: record vẫn còn, chỉ inactive
    const still = await prisma.technology.findUnique({ where: { id: tech.id } });
    expect(still).toBeTruthy();
    expect(still!.isActive).toBe(false);
    // session cũ vẫn giữ link (không orphan)
    const s = await prisma.treatmentSession.findUnique({ where: { id: sess.id } });
    expect(s!.technologyId).toBe(tech.id);
  });

  it("active-only: GET /technologies chỉ trả bản đang dùng (inactive ẩn khỏi dropdown)", async () => {
    const admin = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.TECHNOLOGY_WRITE]);
    await login(admin.email, admin.password);
    const active = await prisma.technology.create({ data: { code: uniq("CN"), name: "Laser Pico", isActive: true } });
    const inactive = await prisma.technology.create({ data: { code: uniq("CN"), name: "CN cũ ngưng", isActive: false } });
    const list = (await rj(await techGet(jreq("http://t/api/technologies", "GET"), {}))).data as any[];
    const ids = list.map((t) => t.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
  });
});

describe("Mục 11 · Bất biến lịch sử (D/H/J)", () => {
  it("H · FormInstance giữ schemaSnapshot + templateVersion; sửa template KHÔNG đổi instance cũ", async () => {
    const staff = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.FORM_WRITE, PERMISSIONS.TREATMENT_WRITE]);
    await login(staff.email, staff.password);
    const tpl = await prisma.formTemplate.create({ data: { code: uniq("FORM"), name: "Đánh giá da", version: 1, status: "ACTIVE", schema: { fields: [{ id: "f1", label: "CŨ" }] } as any } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    // áp template → instance (route form-instances POST snapshot)
    const { POST: formInstPost } = await import("@/app/api/form-instances/route");
    const inst1 = (await rj(await formInstPost(jreq("http://t/api/form-instances", "POST", { templateId: tpl.id, customerId: cust.id }), {}))).data;
    expect(inst1.templateVersion).toBe(1);

    // sửa template lên v2 + schema mới
    await prisma.formTemplate.update({ where: { id: tpl.id }, data: { version: 2, schema: { fields: [{ id: "f1", label: "MỚI" }] } as any } });

    // instance cũ giữ nguyên snapshot v1
    const still = await prisma.formInstance.findUnique({ where: { id: inst1.id } });
    expect(still!.templateVersion).toBe(1);
    expect((still!.schemaSnapshot as any).fields[0].label).toBe("CŨ");

    // áp mới → instance dùng v2
    const inst2 = (await rj(await formInstPost(jreq("http://t/api/form-instances", "POST", { templateId: tpl.id, customerId: cust.id }), {}))).data;
    expect(inst2.templateVersion).toBe(2);
    const inst2db = await prisma.formInstance.findUnique({ where: { id: inst2.id } });
    expect((inst2db!.schemaSnapshot as any).fields[0].label).toBe("MỚI");
  });

  it("J · CareInstance snapshot nội dung; sửa template sau KHÔNG đổi bản đã gửi", async () => {
    const staff = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.CARE_WRITE, PERMISSIONS.CUSTOMER_READ]);
    await login(staff.email, staff.password);
    const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "RF", standardPrice: 1 } });
    const tpl = await prisma.careInstruction.create({ data: { code: uniq("HD"), title: "Sau RF", kind: "POST_CARE", content: "Nội dung CŨ", version: 1, status: "ACTIVE", serviceId: svc.id } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    // matching theo dịch vụ
    const matched = (await rj(await careInstrGet(jreq(`http://t/api/care-instructions?serviceId=${svc.id}`, "GET"), {}))).data as any[];
    expect(matched.map((m) => m.id)).toContain(tpl.id);
    // gửi cho khách (snapshot)
    const { POST: careInstPost } = await import("@/app/api/care-instances/route");
    const sent = (await rj(await careInstPost(jreq("http://t/api/care-instances", "POST", { customerId: cust.id, templateId: tpl.id, kind: "POST_CARE", title: tpl.title, content: tpl.content }), {}))).data;
    expect(sent.content).toBe("Nội dung CŨ");
    // sửa template
    await prisma.careInstruction.update({ where: { id: tpl.id }, data: { version: 2, content: "Nội dung MỚI" } });
    const stillSent = await prisma.careInstructionInstance.findUnique({ where: { id: sent.id } });
    expect(stillSent!.content).toBe("Nội dung CŨ"); // bản đã gửi bất biến
  });

  it("D · Protocol bumpVersion append-only (changeLog); session giữ brandProtocolId", async () => {
    const staff = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE]);
    await login(staff.email, staff.password);
    const proto = await prisma.brandProtocol.create({ data: { code: uniq("PROTO"), name: "GLOW", version: 1, status: "ACTIVE" } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const sess = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, status: "COMPLETED", brandProtocolId: proto.id } });

    const patched = await protocolPatch(jreq(`http://t/api/brand-protocols/${proto.id}`, "PATCH", { bumpVersion: true, changeReason: "Đổi bước" }), { params: { id: proto.id } });
    expect(patched.status).toBe(200);
    const after = await prisma.brandProtocol.findUnique({ where: { id: proto.id } });
    expect(after!.version).toBe(2); // append-only version tăng
    expect(JSON.stringify(after!.changeLog)).toContain("fromVersion"); // lịch sử giữ
    // session cũ vẫn trỏ đúng protocol (không rewrite)
    const s = await prisma.treatmentSession.findUnique({ where: { id: sess.id } });
    expect(s!.brandProtocolId).toBe(proto.id);
  });
});

describe("Mục 11 · Quan hệ master (C/E/F)", () => {
  it("E/F · Brand→Product; productType phân loại (không theo tên); inactive Brand giữ product", async () => {
    const staff = await makeStaff([PERMISSIONS.LIBRARY_READ, PERMISSIONS.BRAND_WRITE, PERMISSIONS.CATALOG_WRITE]);
    await login(staff.email, staff.password);
    const brand = (await rj(await brandPost(jreq("http://t/api/brands", "POST", { name: "DMK" }), {}))).data;
    const pro = (await rj(await productPost(jreq("http://t/api/spa-products", "POST", { name: "Enzyme (chuyên môn)", brandId: brand.id, productType: "PROFESSIONAL" }), {}))).data;
    const home = (await rj(await productPost(jreq("http://t/api/spa-products", "POST", { name: "Serum (home care)", brandId: brand.id, productType: "HOME_CARE" }), {}))).data;
    // cùng brand, phân loại bằng FIELD productType (không phải tên)
    const dbPro = await prisma.spaProduct.findUnique({ where: { id: pro.id } });
    const dbHome = await prisma.spaProduct.findUnique({ where: { id: home.id } });
    expect(dbPro!.brandId).toBe(brand.id);
    expect(dbPro!.productType).toBe("PROFESSIONAL");
    expect(dbHome!.productType).toBe("HOME_CARE");
    // inactive brand không xóa product (lịch sử giữ)
    const { DELETE: brandDelete } = await import("@/app/api/brands/[id]/route");
    await brandDelete(jreq(`http://t/api/brands/${brand.id}`, "DELETE"), { params: { id: brand.id } });
    expect((await prisma.brand.findUnique({ where: { id: brand.id } }))!.isActive).toBe(false);
    expect(await prisma.spaProduct.findUnique({ where: { id: pro.id } })).toBeTruthy();
  });

  it("C · Technology dùng xuyên Service + Employee-competence + Session (một master)", async () => {
    const tech = await prisma.technology.create({ data: { code: uniq("CN"), name: "RF", isActive: true } });
    const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "RF nâng cơ", standardPrice: 1, technologyIds: [tech.id] } });
    const emp = await prisma.employee.create({ data: { code: uniq("NV"), fullName: "KTV" } });
    await prisma.employeeCompetence.create({ data: { employeeId: emp.id, kind: "TECHNOLOGY", name: "RF", refId: tech.id } });
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "K" } });
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "P" } });
    const sess = await prisma.treatmentSession.create({ data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, technologyId: tech.id } });

    // cùng một technologyId tham chiếu ở 3 nơi
    expect((await prisma.service.findUnique({ where: { id: svc.id } }))!.technologyIds).toContain(tech.id);
    expect((await prisma.employeeCompetence.findFirst({ where: { refId: tech.id, kind: "TECHNOLOGY" } }))).toBeTruthy();
    expect((await prisma.treatmentSession.findUnique({ where: { id: sess.id } }))!.technologyId).toBe(tech.id);
  });
});
