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
});
