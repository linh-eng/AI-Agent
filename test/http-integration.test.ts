// =============================================================================
// SEC5 — Test tích hợp mức HTTP (route handler thật của Next) trên PostgreSQL thật.
//
// Chạy trực tiếp các POST/GET/PATCH export của route handler với `Request` thật,
// đi qua toàn bộ tầng xác thực (cookie phiên), RBAC (requirePermission), kiểm
// quyền đối tượng (ownership) và Prisma. Cookie được vận chuyển qua một "jar" mock
// của `next/headers` — đây là lớp vận chuyển duy nhất được mô phỏng; mọi logic ký
// token / verify / phân quyền / DB đều là mã production thật.
//
// Bao phủ: Auth (đúng/sai/khóa/portal/cô lập phiên), Authz (ẩn danh bị chặn, thiếu
// quyền → 403, không finance.read → không lộ cost), Portal IDOR (A không xem được
// của B, id giả không vượt rào, không lộ tồn tại), Media authz (ẩn danh, chéo khách,
// chưa chia sẻ → 404, nhân viên theo RBAC).
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// Jar cookie dùng chung — hoisted để vi.mock tham chiếu an toàn.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const v = jar.get(name);
      return v === undefined ? undefined : { name, value: v };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { PORTAL_COOKIE } from "@/lib/portal-auth";
import { resetDb, uniq } from "./helpers";

// Route handler thật
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as portalLogin } from "@/app/api/portal/login/route";
import { GET as spaProductsGet } from "@/app/api/spa-products/route";
import { GET as mediaGet } from "@/app/api/media/[id]/route";
import { GET as portalProposalGet } from "@/app/api/portal/proposals/[id]/route";
import { GET as portalMediaGet } from "@/app/api/portal/media/[id]/route";
import { GET as portalOverviewGet } from "@/app/api/portal/overview/route";

// --- Tiện ích gọi route ------------------------------------------------------

/** Đặt jar về đúng một cookie phiên (hoặc rỗng nếu ẩn danh). */
function setCookie(name: string | null, value?: string) {
  jar.clear();
  if (name && value) jar.set(name, value);
}

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// --- Fixtures ---------------------------------------------------------------

async function makeStaff(permCodes: string[]) {
  const email = `${uniq("staff")}@thng.com.vn`.toLowerCase();
  const password = "matkhau123";
  const user = await prisma.user.create({
    data: { email, name: "NV Test", passwordHash: await hashPassword(password) },
  });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "Role Test" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of permCodes) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  return { user, email, password };
}

/** Đăng nhập nhân viên qua route thật, trả token phiên (staff). */
async function loginStaff(email: string, password: string, ip = "10.0.0.1") {
  setCookie(null);
  const res = await staffLogin(jsonRequest("http://t/api/auth/login", "POST", { email, password }, { "x-forwarded-for": ip }), {});
  const token = jar.get(SESSION_COOKIE);
  return { res, token };
}

async function makePortalCustomer() {
  const customer = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách Portal" } });
  const email = `${uniq("kh")}@mail.com`.toLowerCase();
  const password = "khach123";
  await prisma.customerPortalAccount.create({
    data: { customerId: customer.id, email, passwordHash: await hashPassword(password) },
  });
  return { customer, email, password };
}

async function loginPortal(email: string, password: string, ip = "10.0.0.2") {
  setCookie(null);
  const res = await portalLogin(jsonRequest("http://t/api/portal/login", "POST", { email, password }, { "x-forwarded-for": ip }), {});
  const token = jar.get(PORTAL_COOKIE);
  return { res, token };
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  await resetDb();
});
beforeEach(() => {
  jar.clear();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("SEC5 · Auth qua HTTP", () => {
  it("đăng nhập nhân viên hợp lệ → 200 + đặt cookie phiên", async () => {
    const s = await makeStaff(["customer.read"]);
    const { res, token } = await loginStaff(s.email, s.password);
    expect(res.status).toBe(200);
    expect(token).toBeTruthy();
    const body = await readJson(res);
    expect(body.data.email).toBe(s.email);
  });

  it("sai mật khẩu → 401 với thông báo CHUNG (không lộ account tồn tại)", async () => {
    const s = await makeStaff(["customer.read"]);
    const bad = await loginStaff(s.email, "sai-mat-khau", "10.9.9.9");
    const noAcct = await loginStaff(`${uniq("khong-ton-tai")}@x.com`, "gi-cung-duoc", "10.9.9.9");
    expect(bad.res.status).toBe(401);
    expect(noAcct.res.status).toBe(401);
    const m1 = (await readJson(bad.res)).error;
    const m2 = (await readJson(noAcct.res)).error;
    // Cùng một thông báo → không phân biệt được account nào tồn tại.
    expect(m1).toBe(m2);
  });

  it("khóa lũy tiến: 5 lần sai (cùng IP) → lần kế tiếp bị 429", async () => {
    const s = await makeStaff(["customer.read"]);
    const ip = "172.16.5.5";
    for (let i = 0; i < 5; i++) {
      const r = await loginStaff(s.email, "sai", ip);
      expect(r.res.status).toBe(401);
    }
    // Đủ ngưỡng 5 → đã đặt lockedUntil; request kế tiếp bị chặn TRƯỚC khi kiểm mật khẩu.
    const blocked = await loginStaff(s.email, s.password, ip);
    expect(blocked.res.status).toBe(429);
    // Ngay cả mật khẩu ĐÚNG cũng bị chặn khi đang khóa → chống brute-force.
  });

  it("đăng nhập cổng khách hợp lệ → 200 + cookie portal riêng", async () => {
    const c = await makePortalCustomer();
    const { res, token } = await loginPortal(c.email, c.password);
    expect(res.status).toBe(200);
    expect(token).toBeTruthy();
    expect(jar.get(SESSION_COOKIE)).toBeUndefined(); // không đặt cookie staff
  });

  it("cô lập phiên: token PORTAL không dùng được cho route nhân viên", async () => {
    const c = await makePortalCustomer();
    const { token: portalToken } = await loginPortal(c.email, c.password);
    // Đặt token portal vào cookie STAFF → route staff phải từ chối (401).
    setCookie(SESSION_COOKIE, portalToken!);
    const res = await spaProductsGet(jsonRequest("http://t/api/spa-products", "GET"), {});
    expect(res.status).toBe(401);
  });

  it("cô lập phiên: token STAFF không dùng được cho route portal", async () => {
    const s = await makeStaff(["customer.read"]);
    const { token: staffToken } = await loginStaff(s.email, s.password, "10.0.0.7");
    // Đặt token staff vào cookie PORTAL → route portal phải từ chối (401).
    setCookie(PORTAL_COOKIE, staffToken!);
    const res = await portalOverviewGet(jsonRequest("http://t/api/portal/overview", "GET"), {});
    expect(res.status).toBe(401);
  });
});

describe("SEC5 · Authz nhân viên qua HTTP", () => {
  it("ẩn danh (không cookie) gọi route bảo vệ → 401", async () => {
    setCookie(null);
    const res = await spaProductsGet(jsonRequest("http://t/api/spa-products", "GET"), {});
    expect(res.status).toBe(401);
  });

  it("thiếu quyền → 403 (không đủ permission)", async () => {
    // User chỉ có customer.read, KHÔNG có library.read → GET /spa-products (library.read) bị 403.
    const s = await makeStaff(["customer.read"]);
    const { token } = await loginStaff(s.email, s.password, "10.0.0.11");
    setCookie(SESSION_COOKIE, token!);
    const res = await spaProductsGet(jsonRequest("http://t/api/spa-products", "GET"), {});
    expect(res.status).toBe(403);
  });

  it("KHÔNG có finance.read → phản hồi KHÔNG lộ cost (bị mask null)", async () => {
    const brand = await prisma.brand.create({ data: { code: uniq("BR"), name: uniq("Brand") } });
    await prisma.spaProduct.create({
      data: { sku: uniq("SP"), name: "SP có giá vốn", brandId: brand.id, cost: 123456, sellingPrice: 500000 },
    });
    // (a) Có library.read nhưng KHÔNG finance.read → cost = null.
    const noFin = await makeStaff(["library.read"]);
    const t1 = await loginStaff(noFin.email, noFin.password, "10.0.0.12");
    setCookie(SESSION_COOKIE, t1.token!);
    const r1 = await spaProductsGet(jsonRequest("http://t/api/spa-products", "GET"), {});
    const b1 = await readJson(r1);
    const p1 = b1.data.find((p: any) => p.name === "SP có giá vốn");
    expect(r1.status).toBe(200);
    expect(p1.cost).toBeNull();

    // (b) Có finance.read → thấy cost thật.
    const fin = await makeStaff(["library.read", "finance.read"]);
    const t2 = await loginStaff(fin.email, fin.password, "10.0.0.13");
    setCookie(SESSION_COOKIE, t2.token!);
    const r2 = await spaProductsGet(jsonRequest("http://t/api/spa-products", "GET"), {});
    const b2 = await readJson(r2);
    const p2 = b2.data.find((p: any) => p.name === "SP có giá vốn");
    expect(Number(p2.cost)).toBe(123456);
  });
});

describe("SEC5 · Portal IDOR qua HTTP", () => {
  it("khách A KHÔNG xem được báo giá của khách B → 404 (không lộ tồn tại)", async () => {
    const A = await makePortalCustomer();
    const B = await makePortalCustomer();
    // Báo giá thuộc B.
    const propB = await prisma.treatmentProposal.create({
      data: { code: uniq("BG"), customerId: B.customer.id, title: "Báo giá của B" },
    });
    const { token: tokenA } = await loginPortal(A.email, A.password, "10.0.1.1");

    // A cố xem báo giá của B bằng id thật → phải 404 (không phải 403 để không lộ tồn tại).
    setCookie(PORTAL_COOKIE, tokenA!);
    const res = await portalProposalGet(jsonRequest(`http://t/api/portal/proposals/${propB.id}`, "GET"), {
      params: { id: propB.id },
    });
    expect(res.status).toBe(404);

    // A xem báo giá của CHÍNH A → 200.
    const propA = await prisma.treatmentProposal.create({
      data: { code: uniq("BG"), customerId: A.customer.id, title: "Báo giá của A" },
    });
    setCookie(PORTAL_COOKIE, tokenA!);
    const okRes = await portalProposalGet(jsonRequest(`http://t/api/portal/proposals/${propA.id}`, "GET"), {
      params: { id: propA.id },
    });
    expect(okRes.status).toBe(200);
  });

  it("id giả / không tồn tại → 404 (cùng phản hồi như không sở hữu)", async () => {
    const A = await makePortalCustomer();
    const { token } = await loginPortal(A.email, A.password, "10.0.1.2");
    setCookie(PORTAL_COOKIE, token!);
    const res = await portalProposalGet(jsonRequest("http://t/api/portal/proposals/khong-co-that", "GET"), {
      params: { id: "khong-co-that" },
    });
    expect(res.status).toBe(404);
  });

  it("báo giá portal KHÔNG lộ trường nội bộ (unitCost) trong item", async () => {
    const A = await makePortalCustomer();
    const prop = await prisma.treatmentProposal.create({
      data: { code: uniq("BG"), customerId: A.customer.id, title: "BG A" },
    });
    const opt = await prisma.treatmentProposalOption.create({
      data: { proposalId: prop.id, kind: "ESSENTIAL", name: "PA1", totalPrice: 100 },
    });
    await prisma.proposalItem.create({
      data: { optionId: opt.id, itemType: "SERVICE", name: "Dịch vụ", quantity: 1, unitPrice: 100, unitCost: 40 },
    });
    const { token } = await loginPortal(A.email, A.password, "10.0.1.3");
    setCookie(PORTAL_COOKIE, token!);
    const res = await portalProposalGet(jsonRequest(`http://t/api/portal/proposals/${prop.id}`, "GET"), {
      params: { id: prop.id },
    });
    const body = await readJson(res);
    const item = body.data.options[0].items[0];
    expect(Number(item.unitPrice)).toBe(100);
    expect("unitCost" in item).toBe(false); // giá vốn nội bộ KHÔNG lộ ra portal
  });
});

describe("SEC5 · Media authz qua HTTP", () => {
  async function makeMedia(customerId: string, shared: boolean) {
    return prisma.mediaAsset.create({
      data: {
        storageKey: `2026/01/${uniq("k")}.png`,
        filename: "anh.png",
        contentType: "image/png",
        size: 10,
        kind: "IMAGE",
        customerId,
        sharedWithCustomer: shared,
      },
    });
  }

  it("ẩn danh gọi /api/media/[id] → 401 (không có URL công khai)", async () => {
    const c = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const asset = await makeMedia(c.id, true);
    setCookie(null);
    const res = await mediaGet(jsonRequest(`http://t/api/media/${asset.id}`, "GET"), { params: { id: asset.id } });
    expect(res.status).toBe(401);
  });

  it("khách A KHÔNG tải được media của khách B qua portal → 404", async () => {
    const A = await makePortalCustomer();
    const B = await makePortalCustomer();
    const assetB = await makeMedia(B.customer.id, true);
    const { token } = await loginPortal(A.email, A.password, "10.0.2.1");
    setCookie(PORTAL_COOKIE, token!);
    const res = await portalMediaGet(jsonRequest(`http://t/api/portal/media/${assetB.id}`, "GET"), {
      params: { id: assetB.id },
    });
    expect(res.status).toBe(404);
  });

  it("khách KHÔNG xem được media của chính mình khi chưa chia sẻ (sharedWithCustomer=false) → 404", async () => {
    const A = await makePortalCustomer();
    const priv = await makeMedia(A.customer.id, false); // riêng tư
    const { token } = await loginPortal(A.email, A.password, "10.0.2.2");
    setCookie(PORTAL_COOKIE, token!);
    const res = await portalMediaGet(jsonRequest(`http://t/api/portal/media/${priv.id}`, "GET"), {
      params: { id: priv.id },
    });
    expect(res.status).toBe(404);
  });

  it("nhân viên có customer.read tải được media (theo RBAC)", async () => {
    const c = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const asset = await makeMedia(c.id, false);
    const s = await makeStaff(["customer.read"]);
    const { token } = await loginStaff(s.email, s.password, "10.0.2.3");
    setCookie(SESSION_COOKIE, token!);
    // storage.get sẽ ném vì chưa có blob thật → route trả 404 "Blob không tồn tại",
    // NHƯNG đã VƯỢT QUA tầng authz (không phải 401/403) → chứng minh RBAC cho phép.
    const res = await mediaGet(jsonRequest(`http://t/api/media/${asset.id}`, "GET"), { params: { id: asset.id } });
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
