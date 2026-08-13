import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq } from "./helpers";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ROLES, ROLE_PERMISSIONS } from "@/lib/rbac";

async function ensureRole(code: string) {
  return prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
}

describe("Quản trị người dùng", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("tạo user + gán vai trò; mật khẩu băm & verify được; không lưu plaintext", async () => {
    const roleManager = await ensureRole(ROLES.MANAGER);
    const roleReception = await ensureRole(ROLES.RECEPTION);
    const email = `nv_${uniq("u")}@sophia.com.vn`;
    const hash = await hashPassword("matkhau123");
    const user = await prisma.user.create({
      data: { email, name: "Nhân viên A", passwordHash: hash, roles: { create: [{ roleId: roleManager.id }, { roleId: roleReception.id }] } },
      include: { roles: { include: { role: true } } },
    });
    expect(user.roles.map((r) => r.role.code).sort()).toEqual([ROLES.MANAGER, ROLES.RECEPTION].sort());
    expect(user.passwordHash).not.toContain("matkhau123");
    expect(await verifyPassword("matkhau123", user.passwordHash)).toBe(true);
    expect(await verifyPassword("sai", user.passwordHash)).toBe(false);
  });

  it("đổi vai trò = thay toàn bộ user_roles", async () => {
    const r1 = await ensureRole(ROLES.RECEPTION);
    const r2 = await ensureRole(ROLES.CASHIER);
    const u = await prisma.user.create({ data: { email: `u_${uniq("x")}@s.com`, name: "B", passwordHash: await hashPassword("x123456"), roles: { create: [{ roleId: r1.id }] } } });
    // Cập nhật: xóa hết rồi tạo lại (như route PATCH)
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: r2.id } });
    const roles = await prisma.userRole.findMany({ where: { userId: u.id }, include: { role: true } });
    expect(roles.map((r) => r.role.code)).toEqual([ROLES.CASHIER]);
  });

  it("vai trò Admin có quyền user.manage; vai trò khác thì không", () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain("user.manage");
    expect(ROLE_PERMISSIONS.MANAGER).not.toContain("user.manage");
    expect(ROLE_PERMISSIONS.RECEPTION).not.toContain("user.manage");
  });

  it("nguồn quyền theo MÃ NGUỒN: Admin có đủ quyền module mới (hr/pricefloor/followup)", () => {
    // Login lấy quyền từ ROLE_PERMISSIONS (code) nên cập nhật code là có ngay,
    // không phụ thuộc RolePermission cũ trong DB.
    for (const perm of ["hr.write", "pricefloor.write", "pricefloor.override", "followup.write", "user.manage", "finance.read"]) {
      expect(ROLE_PERMISSIONS.ADMIN).toContain(perm);
    }
    expect(ROLE_PERMISSIONS.MANAGER).toContain("hr.write"); // Quản lý cũng thêm được nhân sự
  });

  it("xóa user: cascade user_roles, và audit_logs.userId set null (không chặn FK)", async () => {
    const r = await ensureRole(ROLES.RECEPTION);
    const u = await prisma.user.create({ data: { email: `del_${uniq("d")}@s.com`, name: "Xóa", passwordHash: await hashPassword("x123456"), roles: { create: [{ roleId: r.id }] } } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "LOGIN", entityType: "User", entityId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    expect(await prisma.userRole.count({ where: { userId: u.id } })).toBe(0);
    const logs = await prisma.auditLog.findMany({ where: { entityId: u.id } });
    expect(logs.every((l) => l.userId === null)).toBe(true); // FK set null, không lỗi
  });
});
