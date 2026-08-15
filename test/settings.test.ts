// =============================================================================
// Mục 13 — Cài đặt & Thương hiệu: nghiệm thu tích hợp (route thật + DB thật).
//   * GET/PUT brand (persistence DB AppSetting), RBAC (401/403/200), validation
//     màu + logo, audit before/after, version single-source (package.json).
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import pkg from "../package.json";

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
import { APP_VERSION } from "@/lib/version";
import { getBrand } from "@/lib/settings";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as brandGet, PUT as brandPut } from "@/app/api/settings/brand/route";

let ip = 0;
function jr(url: string, body?: unknown) { return new Request(url, { method: "PUT", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) { jar.clear(); await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.13.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {}); return jar.get(SESSION_COOKIE); }

beforeAll(async () => { await resetDb(); });
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Mục 13 · Cài đặt & Thương hiệu", () => {
  it("A/H · GET trả cấu hình; ẩn danh → 401; người đăng nhập đọc được", async () => {
    // ẩn danh → 401
    expect((await brandGet(new Request("http://t/api/settings/brand"), {})).status).toBe(401);
    const reader = await makeStaff([PERMISSIONS.CUSTOMER_READ]); // không có setting.write
    await login(reader.email);
    const res = await brandGet(new Request("http://t/api/settings/brand"), {});
    expect(res.status).toBe(200);
    const b = (await rj(res)).data;
    expect(b.name).toBeTruthy(); // mặc định "Sophia Care"
    expect(b.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("I · PUT cần setting.write: thiếu quyền → 403; có quyền → 200 (không chỉ ẩn menu)", async () => {
    const reader = await makeStaff([PERMISSIONS.CUSTOMER_READ]);
    await login(reader.email);
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "Hack" }), {})).status).toBe(403);

    const mgr = await makeStaff([PERMISSIONS.SETTING_WRITE]);
    await login(mgr.email);
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "OK" }), {})).status).toBe(200);
  });

  it("B/C/K · đổi tên + khẩu hiệu persist DB; GET request MỚI trả dữ liệu mới", async () => {
    const mgr = await makeStaff([PERMISSIONS.SETTING_WRITE]);
    await login(mgr.email);
    await brandPut(jr("http://t/api/settings/brand", { name: "Spa Của Tôi", tagline: "Đẹp mỗi ngày" }), {});
    // GET request mới (không dùng state FE)
    const b = (await rj(await brandGet(new Request("http://t/api/settings/brand"), {}))).data;
    expect(b.name).toBe("Spa Của Tôi");
    expect(b.tagline).toBe("Đẹp mỗi ngày");
    // đọc thẳng DB
    const row = await prisma.appSetting.findUnique({ where: { key: "brand" } });
    expect((row!.value as any).name).toBe("Spa Của Tôi");
  });

  it("D · màu nhấn: giá trị hợp lệ lưu; SAI định dạng → 422 (validate)", async () => {
    const mgr = await makeStaff([PERMISSIONS.SETTING_WRITE]);
    await login(mgr.email);
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "X", primaryColor: "#1a2b3c" }), {})).status).toBe(200);
    expect((await getBrand()).primaryColor).toBe("#1a2b3c");
    // sai định dạng
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "X", primaryColor: "blue" }), {})).status).toBe(422);
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "X", primaryColor: "#12" }), {})).status).toBe(422);
  });

  it("E · logo persist trong DB (data URL); logo KHÔNG phải ảnh → 422", async () => {
    const mgr = await makeStaff([PERMISSIONS.SETTING_WRITE]);
    await login(mgr.email);
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "X", logoDataUrl: dataUrl }), {})).status).toBe(200);
    const row = await prisma.appSetting.findUnique({ where: { key: "brand" } });
    expect((row!.value as any).logoDataUrl).toBe(dataUrl); // persistence THẬT trong DB
    // logo không phải ảnh
    expect((await brandPut(jr("http://t/api/settings/brand", { name: "X", logoDataUrl: "http://evil/x.js" }), {})).status).toBe(422);
  });

  it("G · version SINGLE-SOURCE = package.json (không hard-code hai giá trị)", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("J · audit SETTING_UPDATED có before/after diff + người sửa", async () => {
    const mgr = await makeStaff([PERMISSIONS.SETTING_WRITE]);
    await login(mgr.email);
    await brandPut(jr("http://t/api/settings/brand", { name: "Tên A", primaryColor: "#111111" }), {});
    await brandPut(jr("http://t/api/settings/brand", { name: "Tên B", primaryColor: "#222222" }), {});
    const audit = await prisma.auditLog.findFirst({ where: { action: "SETTING_UPDATED", entityType: "AppSetting", entityId: "brand" }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
    expect(audit!.userId).toBe(mgr.userId); // người sửa
    const ch: any = audit!.changes;
    expect(ch.diff.name).toMatchObject({ before: "Tên A", after: "Tên B" });
    expect(ch.diff.primaryColor).toMatchObject({ before: "#111111", after: "#222222" });
  });
});
