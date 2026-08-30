// =============================================================================
// Mục 14 — Quản trị người dùng / tài khoản đăng nhập: nghiệm thu tích hợp HTTP thật
// trên PostgreSQL thật (list/create/edit-role/reset-pw/lock/unlock/delete + bất
// biến self-delete & Admin-cuối cả 2 đường + RBAC 401/403 + audit + login effect).
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
import { PERMISSIONS, ROLES } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as usersGet, POST as usersPost } from "@/app/api/users/route";
import { GET as userGet, PATCH as userPatch, DELETE as userDelete } from "@/app/api/users/[id]/route";

let ip = 0;
function jr(url: string, method: string, body?: unknown) { return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
// GET/POST /api/users nhận (req, ctx) qua wrapper handle — ctx rỗng cho collection route.
const listUsers = () => usersGet(jr("http://t/api/users", "GET"), {} as any);
const createUser = (body: unknown) => usersPost(jr("http://t/api/users", "POST", body), {} as any);
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function role(code: string) { return prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } }); }
async function makeUser(roleCodes: string[], opts: { active?: boolean; password?: string } = {}) {
  const email = `${uniq("u")}@sophia.com.vn`.toLowerCase();
  const roles = await Promise.all(roleCodes.map(role));
  const user = await prisma.user.create({
    data: { email, name: uniq("NV"), passwordHash: await hashPassword(opts.password ?? "matkhau123"), isActive: opts.active ?? true, roles: { create: roles.map((r) => ({ roleId: r.id })) } },
  });
  return { user, email, password: opts.password ?? "matkhau123" };
}
async function loginRes(email: string, password: string) {
  jar.clear();
  const res = await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.14.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {});
  return { status: res.status, token: jar.get(SESSION_COOKIE) };
}
async function asAdmin() { const a = await makeUser([ROLES.ADMIN]); await loginRes(a.email, a.password); return a; }
// Actor có quyền user.manage nhưng KHÔNG phải vai trò ADMIN — để thao tác lên "admin cuối"
// mà không vướng self-guard (chứng minh bất biến last-admin độc lập với self-guard).
async function makeSuperActor() {
  const perm = await prisma.permission.upsert({ where: { code: PERMISSIONS.USER_MANAGE }, update: {}, create: { code: PERMISSIONS.USER_MANAGE } });
  const superRole = await prisma.role.create({ data: { code: uniq("SUPER"), name: "Super" } });
  await prisma.rolePermission.create({ data: { roleId: superRole.id, permissionId: perm.id } });
  const email = `${uniq("actor")}@sophia.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "Actor", passwordHash: await hashPassword("matkhau123"), roles: { create: [{ roleId: superRole.id }] } } });
  return { user, email, password: "matkhau123" };
}

beforeAll(async () => { await resetDb(); });
beforeEach(async () => { await resetDb(); jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Mục 14 · Quản trị người dùng", () => {
  it("A · GET danh sách: id/email/roles/isActive + KHÔNG lộ passwordHash", async () => {
    await asAdmin();
    await makeUser([ROLES.MANAGER]);
    const res = await listUsers();
    expect(res.status).toBe(200);
    const list = (await rj(res)).data;
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const u of list) {
      expect(u).toHaveProperty("email");
      expect(u).toHaveProperty("isActive");
      expect(Array.isArray(u.roles)).toBe(true);
      expect(u).not.toHaveProperty("passwordHash"); // không lộ hash
    }
  });

  it("B/L · RBAC: ẩn danh→401; Manager (không user.manage)→403; Admin→200", async () => {
    // ẩn danh
    jar.clear();
    expect((await listUsers()).status).toBe(401);
    // Manager không có user.manage
    const mgr = await makeUser([ROLES.MANAGER]);
    await loginRes(mgr.email, mgr.password);
    expect((await listUsers()).status).toBe(403);
    expect((await createUser({ email: "x@y.com", name: "X", password: "123456", roleCodes: [] })).status).toBe(403);
    const victim = await makeUser([ROLES.RECEPTION]);
    expect((await userPatch(jr(`http://t/api/users/${victim.user.id}`, "PATCH", { name: "Y" }), { params: { id: victim.user.id } })).status).toBe(403);
    expect((await userDelete(jr(`http://t/api/users/${victim.user.id}`, "DELETE"), { params: { id: victim.user.id } })).status).toBe(403);
    // Admin
    await asAdmin();
    expect((await listUsers()).status).toBe(200);
  });

  it("C · tạo tài khoản: POST→201, DB có record, hash bcrypt (không plaintext), email trùng→409", async () => {
    await asAdmin();
    await role(ROLES.MANAGER);
    const email = `${uniq("new")}@sophia.com.vn`.toLowerCase();
    const res = await createUser({ email, name: "Người Mới", password: "matkhau123", roleCodes: [ROLES.MANAGER] });
    expect(res.status).toBe(201);
    const db = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
    expect(db).toBeTruthy();
    expect(db!.passwordHash).not.toContain("matkhau123");
    expect(db!.passwordHash.startsWith("$2")).toBe(true); // bcrypt
    expect(db!.roles.map((r) => r.role.code)).toEqual([ROLES.MANAGER]);
    // trùng email → 409
    const dup = await createUser({ email, name: "Trùng", password: "matkhau123", roleCodes: [] });
    expect(dup.status).toBe(409);
  });

  it("D · gán NHIỀU vai trò; GET lại đủ; role không tồn tại bị loại", async () => {
    await asAdmin();
    await role(ROLES.MANAGER); await role(ROLES.CASHIER);
    const email = `${uniq("multi")}@sophia.com.vn`.toLowerCase();
    await createUser({ email, name: "Đa vai trò", password: "matkhau123", roleCodes: [ROLES.MANAGER, ROLES.CASHIER, "ROLE_KHONG_TON_TAI"] });
    const db = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
    expect(db!.roles.map((r) => r.role.code).sort()).toEqual([ROLES.CASHIER, ROLES.MANAGER].sort()); // role rác bị loại
  });

  it("E · sửa vai trò: PATCH thay role; GET mới phản ánh + quyền hiệu lực đổi (login lại)", async () => {
    await asAdmin();
    await role(ROLES.RECEPTION); await role(ROLES.MANAGER);
    const u = await makeUser([ROLES.RECEPTION]);
    await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { roleCodes: [ROLES.MANAGER] }), { params: { id: u.user.id } });
    const after = (await rj(await userGet(jr(`http://t/api/users/${u.user.id}`, "GET"), { params: { id: u.user.id } }))).data;
    expect(after.roles.map((r: any) => r.code)).toEqual([ROLES.MANAGER]);
    // quyền hiệu lực: login lại → session có quyền của MANAGER (vd customer.write), KHÔNG có user.manage
    await loginRes(u.email, u.password);
    const { getSession } = await import("@/lib/session");
    const s = await getSession();
    expect(s!.permissions).toContain(PERMISSIONS.CUSTOMER_WRITE);
    expect(s!.permissions).not.toContain(PERMISSIONS.USER_MANAGE);
  });

  it("F · reset mật khẩu: hash đổi; mật khẩu cũ KHÔNG login; mật khẩu mới login; không trả hash", async () => {
    await asAdmin();
    const u = await makeUser([ROLES.RECEPTION], { password: "matkhaucu1" });
    const res = await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { password: "matkhaumoi1" }), { params: { id: u.user.id } });
    expect(res.status).toBe(200);
    const body = await rj(res);
    expect(JSON.stringify(body)).not.toContain("passwordHash"); // không lộ hash
    // cũ fail, mới ok
    expect((await loginRes(u.email, "matkhaucu1")).status).not.toBe(200);
    expect((await loginRes(u.email, "matkhaumoi1")).status).toBe(200);
  });

  it("G/H · khóa → không login; mở khóa → login lại được (DB isActive)", async () => {
    await asAdmin();
    const u = await makeUser([ROLES.RECEPTION]);
    // khóa
    await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { isActive: false }), { params: { id: u.user.id } });
    expect((await prisma.user.findUnique({ where: { id: u.user.id } }))!.isActive).toBe(false);
    expect((await loginRes(u.email, u.password)).status).not.toBe(200); // bị từ chối
    // mở khóa
    await asAdmin();
    await userPatch(jr(`http://t/api/users/${u.user.id}`, "PATCH", { isActive: true }), { params: { id: u.user.id } });
    expect((await loginRes(u.email, u.password)).status).toBe(200); // login lại được
  });

  it("I · xóa tài khoản: DELETE→200, DB không còn (hard delete); audit_logs không orphan", async () => {
    const admin = await asAdmin();
    const u = await makeUser([ROLES.RECEPTION]);
    // gắn 1 audit log vào user để kiểm tra referential khi xóa
    await prisma.auditLog.create({ data: { userId: u.user.id, action: "LOGIN", entityType: "User", entityId: u.user.id } });
    const res = await userDelete(jr(`http://t/api/users/${u.user.id}`, "DELETE"), { params: { id: u.user.id } });
    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: u.user.id } })).toBeNull(); // hard delete
    // audit cũ không mồ côi: userId set null, record vẫn còn
    const orphan = await prisma.auditLog.findFirst({ where: { entityId: u.user.id, action: "LOGIN" } });
    expect(orphan).toBeTruthy();
    expect(orphan!.userId).toBeNull();
    expect(admin.user.id).toBeTruthy();
  });

  it("J · KHÔNG được xóa/khóa chính mình (backend chặn)", async () => {
    const admin = await asAdmin();
    // cần ≥2 admin để loại trừ yếu tố 'admin cuối', kiểm THUẦN self-guard
    await makeUser([ROLES.ADMIN]);
    await loginRes(admin.email, admin.password);
    const del = await userDelete(jr(`http://t/api/users/${admin.user.id}`, "DELETE"), { params: { id: admin.user.id } });
    expect(del.status).toBe(409);
    expect((await rj(del)).error).toMatch(/chính/);
    const deact = await userPatch(jr(`http://t/api/users/${admin.user.id}`, "PATCH", { isActive: false }), { params: { id: admin.user.id } });
    expect(deact.status).toBe(409);
    expect(await prisma.user.findUnique({ where: { id: admin.user.id } })).toBeTruthy(); // vẫn còn
  });

  it("K · KHÔNG được xóa Admin cuối (đường DELETE)", async () => {
    // Actor có user.manage nhưng KHÔNG phải ADMIN → thao tác lên admin cuối mà không vướng self-guard.
    const actor = await makeSuperActor();
    const soleAdmin = await makeUser([ROLES.ADMIN]); // ADMIN active DUY NHẤT
    await loginRes(actor.email, actor.password);
    const del = await userDelete(jr(`http://t/api/users/${soleAdmin.user.id}`, "DELETE"), { params: { id: soleAdmin.user.id } });
    expect(del.status).toBe(409);
    expect((await rj(del)).error).toMatch(/Admin cuối/);
    // Bất biến: vẫn còn đúng 1 admin active.
    expect(await prisma.user.count({ where: { isActive: true, roles: { some: { role: { code: ROLES.ADMIN } } } } })).toBe(1);
  });

  it("K2 · KHÔNG bypass Admin cuối qua PATCH (gỡ role ADMIN hoặc khóa); 2 admin thì cho phép", async () => {
    const actor = await makeSuperActor();
    await role(ROLES.MANAGER);
    const soleAdmin = await makeUser([ROLES.ADMIN]);
    await loginRes(actor.email, actor.password);

    // (a) gỡ ADMIN khỏi admin cuối → 409
    const removeRole = await userPatch(jr(`http://t/api/users/${soleAdmin.user.id}`, "PATCH", { roleCodes: [ROLES.MANAGER] }), { params: { id: soleAdmin.user.id } });
    expect(removeRole.status).toBe(409);
    // (b) khóa admin cuối → 409
    const lock = await userPatch(jr(`http://t/api/users/${soleAdmin.user.id}`, "PATCH", { isActive: false }), { params: { id: soleAdmin.user.id } });
    expect(lock.status).toBe(409);
    // vẫn còn đúng 1 admin active
    expect(await prisma.user.count({ where: { isActive: true, roles: { some: { role: { code: ROLES.ADMIN } } } } })).toBe(1);

    // Có admin thứ 2 → giờ gỡ ADMIN khỏi 1 admin ĐƯỢC phép
    await makeUser([ROLES.ADMIN]);
    await loginRes(actor.email, "matkhau123");
    const okRemove = await userPatch(jr(`http://t/api/users/${soleAdmin.user.id}`, "PATCH", { roleCodes: [ROLES.MANAGER] }), { params: { id: soleAdmin.user.id } });
    expect(okRemove.status).toBe(200);
  });

  it("M · audit USER_CREATED / USER_UPDATED(before-after) / USER_DELETED; không log mật khẩu", async () => {
    const admin = await asAdmin();
    await role(ROLES.MANAGER); await role(ROLES.RECEPTION);
    // create
    const email = `${uniq("aud")}@sophia.com.vn`.toLowerCase();
    await createUser({ email, name: "Audit", password: "matkhau123", roleCodes: [ROLES.RECEPTION] });
    const created = await prisma.user.findUnique({ where: { email } });
    const aCreate = await prisma.auditLog.findFirst({ where: { action: "USER_CREATED", entityId: created!.id } });
    expect(aCreate).toBeTruthy();
    expect(aCreate!.userId).toBe(admin.user.id);
    // update role + reset pw
    await userPatch(jr(`http://t/api/users/${created!.id}`, "PATCH", { roleCodes: [ROLES.MANAGER], password: "matkhaumoi1" }), { params: { id: created!.id } });
    const aUpd = await prisma.auditLog.findFirst({ where: { action: "USER_UPDATED", entityId: created!.id }, orderBy: { createdAt: "desc" } });
    const ch: any = aUpd!.changes;
    expect(ch.roles).toMatchObject({ before: [ROLES.RECEPTION], after: [ROLES.MANAGER] });
    expect(ch.resetPassword).toBe(true);
    expect(JSON.stringify(ch)).not.toContain("matkhaumoi1"); // KHÔNG log mật khẩu
    expect(JSON.stringify(ch)).not.toContain("$2"); // KHÔNG log hash
    // delete
    await userDelete(jr(`http://t/api/users/${created!.id}`, "DELETE"), { params: { id: created!.id } });
    expect(await prisma.auditLog.findFirst({ where: { action: "USER_DELETED", entityId: created!.id } })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Quyền BỔ SUNG cấp riêng cho tài khoản (extraPermissions) — ngoài vai trò.
// ---------------------------------------------------------------------------
import { verifySession } from "@/lib/auth";

describe("Quyền bổ sung theo tài khoản (extraPermissions)", () => {
  it("EX1 · tạo user + quyền bổ sung → đăng nhập có quyền đó (ngoài vai trò)", async () => {
    await asAdmin();
    const email = `${uniq("nv")}@sophia.com.vn`.toLowerCase();
    const res = await createUser({ email, name: "KTV+", password: "matkhau123", roleCodes: [ROLES.SPECIALIST], extraPermissions: [PERMISSIONS.PAYMENT_VOID] });
    expect(res.status).toBe(201);
    // DB lưu đúng quyền bổ sung.
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u!.extraPermissions).toContain(PERMISSIONS.PAYMENT_VOID);
    // Đăng nhập → token có payment.void (dù vai trò SPECIALIST không có).
    const lr = await loginRes(email, "matkhau123");
    expect(lr.status).toBe(200);
    const payload = await verifySession(lr.token!);
    expect(payload!.permissions).toContain(PERMISSIONS.PAYMENT_VOID);
    expect(payload!.extraPermissions).toContain(PERMISSIONS.PAYMENT_VOID);
  });

  it("EX2 · KHÔNG cấp được user.manage qua quyền bổ sung (lọc ở server)", async () => {
    await asAdmin();
    const email = `${uniq("nv")}@sophia.com.vn`.toLowerCase();
    await createUser({ email, name: "X", password: "matkhau123", roleCodes: [ROLES.RECEPTION], extraPermissions: [PERMISSIONS.USER_MANAGE, "quyen.la.khong.ton.tai", PERMISSIONS.INVOICE_WRITE] });
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u!.extraPermissions).not.toContain(PERMISSIONS.USER_MANAGE); // trục an ninh giữ cho Admin
    expect(u!.extraPermissions).not.toContain("quyen.la.khong.ton.tai"); // quyền lạ bị loại
    expect(u!.extraPermissions).toContain(PERMISSIONS.INVOICE_WRITE); // quyền hợp lệ giữ lại
  });

  it("EX3 · PATCH thêm/bớt quyền bổ sung + audit before/after", async () => {
    await asAdmin();
    const t = await makeUser([ROLES.SPECIALIST]);
    await userPatch(jr(`http://t/api/users/${t.user.id}`, "PATCH", { extraPermissions: [PERMISSIONS.PRICE_WRITE] }), { params: { id: t.user.id } });
    let u = await prisma.user.findUnique({ where: { id: t.user.id } });
    expect(u!.extraPermissions).toEqual([PERMISSIONS.PRICE_WRITE]);
    // Bớt về rỗng.
    await userPatch(jr(`http://t/api/users/${t.user.id}`, "PATCH", { extraPermissions: [] }), { params: { id: t.user.id } });
    u = await prisma.user.findUnique({ where: { id: t.user.id } });
    expect(u!.extraPermissions).toEqual([]);
    const audit = await prisma.auditLog.findFirst({ where: { action: "USER_UPDATED", entityId: t.user.id }, orderBy: { createdAt: "desc" } });
    expect((audit!.changes as any).extraPermissions).toBeTruthy();
  });
});
