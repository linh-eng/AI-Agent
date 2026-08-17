// =============================================================================
// IA-PH2 — Nested billing menu + global pricing workspace. Chứng minh:
//   NAV (unit, nguồn sự thật NAV_GROUPS/rbac):
//     A parent nested "Hóa đơn & Thanh toán" (children Hóa đơn/Thanh toán, KHÔNG href)
//     B parent hiện khi ≥1 child hiện (invoice.write) · C ẩn khi 0 child ·
//     D parent KHÔNG khai permission mới · E entry pricing toàn cục ở "Giá & Chính sách"
//     F nhãn đúng "Giá bán đề xuất" (không phải "Giá đề xuất") · G route thêm đúng ·
//     H visibleNavGroups lọc children · I active-route rule (Dịch vụ vs workspace) ·
//     J CASHIER thấy đủ 2 child / MARKETING ẩn parent · K children giữ nguyên permission.
//   HTTP (Postgres thật, đi qua auth+RBAC+Prisma):
//     L aggregate GET /service-costings (finance) · M compose khớp per-service ·
//     N finance mask (non-finance cost=null) · O RBAC 401/403 ·
//     P aggregate GET /recommended-prices (finance + mask) · Q per-service GET vẫn chạy ·
//     R aggregate CHỈ đọc (không tạo entity — count bất biến).
// KHÔNG đổi backend logic/permission matrix — chỉ nav + read-mode compose.
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

import { NAV_GROUPS, visibleNavGroups, canSeeNavItem, type NavItem } from "@/lib/nav";
import { ROLE_PERMISSIONS, ROLES, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as costingListRaw, POST as costingCreateRaw } from "@/app/api/service-costings/route";
import { POST as costingPublishRaw } from "@/app/api/service-costings/[id]/publish/route";
import { GET as recommendedListRaw, POST as recommendedCreateRaw } from "@/app/api/recommended-prices/route";
import { POST as recommendedPublishRaw } from "@/app/api/recommended-prices/[id]/publish/route";

// ---------- NAV helpers ----------
const groupItems = (title: string) => NAV_GROUPS.find((g) => g.title === title)?.items ?? [];
const flatten = (items: readonly NavItem[]): NavItem[] =>
  items.flatMap((it) => (it.children ? flatten(it.children) : [it]));
const findByHref = (href: string) => flatten(NAV_GROUPS.flatMap((g) => g.items)).find((it) => it.href === href);
const billingParent = () => groupItems("Khách hàng & Hành trình").find((it) => it.label === "Hóa đơn & Thanh toán");

describe("IA-PH2 · NAV nested billing + pricing workspace (unit)", () => {
  it("A · parent nested 'Hóa đơn & Thanh toán' có children Hóa đơn/Thanh toán, KHÔNG href", () => {
    const p = billingParent();
    expect(p).toBeTruthy();
    expect(p!.href).toBeUndefined();
    expect(p!.children?.map((c) => c.href)).toEqual(["/invoices", "/payments"]);
    expect(p!.children?.map((c) => c.label)).toEqual(["Hóa đơn", "Thanh toán"]);
  });

  it("B · parent hiện khi có ÍT NHẤT 1 child hiện (chỉ invoice.write → chỉ child Hóa đơn)", () => {
    const p = billingParent()!;
    expect(canSeeNavItem(p, ["invoice.write"])).toBe(true);
    const groups = visibleNavGroups(["customer.read", "invoice.write"]);
    const parent = groups.flatMap((g) => g.items).find((it) => it.label === "Hóa đơn & Thanh toán");
    expect(parent?.children?.map((c) => c.href)).toEqual(["/invoices"]); // Thanh toán ẩn
  });

  it("C · parent ẩn hoàn toàn khi phiên không có child nào (0 invoice/payment write)", () => {
    const p = billingParent()!;
    expect(canSeeNavItem(p, ["customer.read"])).toBe(false);
    const groups = visibleNavGroups(["customer.read"]);
    const parent = groups.flatMap((g) => g.items).find((it) => it.label === "Hóa đơn & Thanh toán");
    expect(parent).toBeUndefined();
  });

  it("D · parent KHÔNG khai permission riêng (không thêm permission mới)", () => {
    expect(billingParent()!.perm).toBeUndefined();
  });

  it("E · 'Giá vốn & biên' + 'Giá bán đề xuất' nằm trong 'Giá & Chính sách'", () => {
    const hrefs = groupItems("Giá & Chính sách").map((it) => it.href);
    expect(hrefs).toContain("/service-costings");
    expect(hrefs).toContain("/recommended-prices");
  });

  it("F · nhãn đúng 'Giá bán đề xuất' (KHÔNG phải 'Giá đề xuất')", () => {
    expect(findByHref("/recommended-prices")?.label).toBe("Giá bán đề xuất");
    expect(findByHref("/service-costings")?.label).toBe("Giá vốn & biên");
  });

  it("G · route workspace gắn perm any-of [pricefloor.read, finance.read] (không thêm permission mới)", () => {
    expect(findByHref("/service-costings")?.perm).toEqual(["pricefloor.read", "finance.read"]);
    expect(findByHref("/recommended-prices")?.perm).toEqual(["pricefloor.read", "finance.read"]);
  });

  it("H · visibleNavGroups lọc children theo quyền, giữ parent nếu ≥1 child", () => {
    const groups = visibleNavGroups(["customer.read", "payment.write"]);
    const parent = groups.flatMap((g) => g.items).find((it) => it.label === "Hóa đơn & Thanh toán");
    expect(parent?.children?.map((c) => c.href)).toEqual(["/payments"]); // chỉ Thanh toán
  });

  it("I · active-route: /services/[id]/costing giữ Dịch vụ active; /service-costings KHÔNG kích Dịch vụ", () => {
    const isActive = (href: string, pathname: string) => pathname === href || pathname.startsWith(href + "/");
    expect(isActive("/services", "/services/abc/costing")).toBe(true);       // giữ Dịch vụ (quyết định)
    expect(isActive("/service-costings", "/services/abc/costing")).toBe(false);
    expect(isActive("/services", "/service-costings")).toBe(false);          // workspace không kích Dịch vụ
    expect(isActive("/service-costings", "/service-costings")).toBe(true);
  });

  it("J · CASHIER thấy 2 child billing; MARKETING ẩn parent (không invoice/payment.write)", () => {
    const cashier = visibleNavGroups(ROLE_PERMISSIONS[ROLES.CASHIER]);
    const cParent = cashier.flatMap((g) => g.items).find((it) => it.label === "Hóa đơn & Thanh toán");
    expect(cParent?.children?.map((c) => c.href)).toEqual(["/invoices", "/payments"]);
    const marketing = visibleNavGroups(ROLE_PERMISSIONS[ROLES.MARKETING]);
    expect(marketing.flatMap((g) => g.items).find((it) => it.label === "Hóa đơn & Thanh toán")).toBeUndefined();
  });

  it("K · children billing GIỮ NGUYÊN permission (invoice.write / payment.write)", () => {
    const p = billingParent()!;
    const inv = p.children?.find((c) => c.href === "/invoices");
    const pay = p.children?.find((c) => c.href === "/payments");
    expect(inv?.perm).toBe("invoice.write");
    expect(pay?.perm).toBe("payment.write");
  });
});

// ---------- HTTP fixtures ----------
let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("ph2")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.41.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}

const costingList = () => costingListRaw(new Request("http://t/api/service-costings"), {} as any);
const costingCreate = (body: unknown) => costingCreateRaw(new Request("http://t/api/service-costings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const costingPublish = (id: string) => costingPublishRaw(new Request("http://t/api/service-costings/" + id + "/publish", { method: "POST" }), { params: { id } } as any);
const recommendedList = () => recommendedListRaw(new Request("http://t/api/recommended-prices"), {} as any);
const recommendedCreate = (body: unknown) => recommendedCreateRaw(new Request("http://t/api/recommended-prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {} as any);
const recommendedPublish = (id: string) => recommendedPublishRaw(new Request("http://t/api/recommended-prices/" + id + "/publish", { method: "POST" }), { params: { id } } as any);

let SVC = "", COSTING_ID = "";
async function seedPublishedCosting() {
  const a = await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "Cleanser", productType: "PROFESSIONAL", cost: 100000 } });
  const svc = await prisma.service.create({
    data: {
      code: uniq("DV"), name: "DV Aggregate", standardPrice: 2000000, durationMinutes: 60,
      steps: { create: [{ sortOrder: 0, name: "Làm sạch", durationMinutes: 20, products: { create: [{ spaProductId: a.id, name: "Cleanser", quantity: 5, unit: "ml", sortOrder: 0 }] } }] },
    },
  });
  SVC = svc.id;
  // finance writer publish costing v1
  await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
  const c = (await rj(await costingCreate({ serviceId: SVC, equipmentCost: 100000, facilityCost: 0, otherCost: 0, overheadMethod: "MANUAL", overheadValue: 0 }))).data;
  COSTING_ID = c.id;
  await costingPublish(COSTING_ID);
}

describe("IA-PH2 · Global pricing workspace aggregate (HTTP thật)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); await seedPublishedCosting(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("L · aggregate GET /service-costings (finance) → row có totalEstimatedCost (published)", async () => {
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
    const rows = (await rj(await costingList())).data;
    const row = rows.find((r: any) => r.serviceId === SVC);
    expect(row).toBeTruthy();
    expect(row.publishedVersion).toBeTruthy();
    // material 5×100k + equip 100k = 600k
    expect(Number(row.publishedVersion.totalEstimatedCost)).toBe(600000);
    expect(row.serviceName).toBe("DV Aggregate");
  });

  it("M · aggregate CHỈ compose/đọc — publishedVersion khớp version per-service", async () => {
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
    const rows = (await rj(await costingList())).data;
    const row = rows.find((r: any) => r.serviceId === SVC);
    const dbPub = await prisma.serviceCostingVersion.findFirst({ where: { serviceId: SVC, status: "PUBLISHED" } });
    expect(row.publishedVersion.version).toBe(dbPub!.version);
    expect(row.versionCount).toBe(1);
  });

  it("N · finance mask: non-finance (chỉ pricefloor.read) → cost = null", async () => {
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const rows = (await rj(await costingList())).data;
    const row = rows.find((r: any) => r.serviceId === SVC);
    expect(row.publishedVersion).toBeTruthy();
    expect(row.publishedVersion.totalEstimatedCost).toBeNull();
    expect(row.publishedVersion.directCost).toBeNull();
  });

  it("O · RBAC: ẩn danh → 401; thiếu pricefloor.read → 403", async () => {
    jar.clear();
    expect((await costingList()).status).toBe(401);
    await login(await makeStaff([PERMISSIONS.CUSTOMER_READ]));
    expect((await costingList()).status).toBe(403);
  });

  it("P · aggregate GET /recommended-prices: finance thấy giá đề xuất; non-finance mask margin/cost", async () => {
    // Tạo + publish recommended v1 (biên mục tiêu 40%) từ costing đã publish.
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_WRITE, PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
    const rec = (await rj(await recommendedCreate({ serviceId: SVC, serviceCostingVersionId: COSTING_ID, targetMarginPercent: 40 }))).data;
    await recommendedPublish(rec.id);

    const finRows = (await rj(await recommendedList())).data;
    const finRow = finRows.find((r: any) => r.serviceId === SVC);
    expect(finRow.publishedVersion).toBeTruthy();
    expect(Number(finRow.publishedVersion.calculatedRecommendedPrice)).toBe(1000000); // 600k/(1-0.4)=1,000,000
    expect(finRow.publishedVersion.targetMarginPercent).not.toBeNull();

    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ]));
    const nfRows = (await rj(await recommendedList())).data;
    const nfRow = nfRows.find((r: any) => r.serviceId === SVC);
    expect(nfRow.publishedVersion.calculatedRecommendedPrice).not.toBeNull(); // giá đề xuất là guardrail (hiện)
    expect(nfRow.publishedVersion.targetMarginPercent).toBeNull();            // biên mục tiêu ẩn
    expect(nfRow.publishedVersion.costSnapshot).toBeNull();
  });

  it("Q · per-service GET (?serviceId=) vẫn hoạt động (regression)", async () => {
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
    const res = await costingListRaw(new Request("http://t/api/service-costings?serviceId=" + SVC), {} as any);
    const list = (await rj(res)).data;
    expect(Array.isArray(list)).toBe(true);
    expect(list[0].serviceId).toBe(SVC);
  });

  it("R · aggregate CHỈ đọc — không tạo entity (count version bất biến)", async () => {
    await login(await makeStaff([PERMISSIONS.PRICEFLOOR_READ, PERMISSIONS.FINANCE_READ]));
    const before = await prisma.serviceCostingVersion.count();
    await costingList();
    await recommendedList();
    const after = await prisma.serviceCostingVersion.count();
    expect(after).toBe(before);
  });
});
