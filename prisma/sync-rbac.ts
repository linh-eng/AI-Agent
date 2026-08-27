// =============================================================================
// Đồng bộ RBAC (quyền + gán quyền cho vai trò) từ src/lib/rbac.ts vào database.
// AN TOÀN: chỉ chạm bảng permissions + role_permissions + roles. KHÔNG đụng tới
// người dùng, mật khẩu, sản phẩm, phiếu, tồn kho hay bất kỳ dữ liệu nghiệp vụ nào.
//
// Dùng khi vừa cập nhật code có thêm quyền mới (vd inbound.manage / outbound.manage)
// mà chưa muốn chạy lại toàn bộ seed. Chạy:  npm run db:sync-rbac
// Sau khi chạy xong, ĐĂNG XUẤT rồi ĐĂNG NHẬP lại để phiên nhận quyền mới.
// =============================================================================
import { PrismaClient } from "@prisma/client";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type RoleCode,
} from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Đồng bộ quyền (RBAC) vào database…");

  // 1) Bảo đảm mọi quyền trong code đều có trong DB (thêm quyền mới nếu thiếu).
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name: PERMISSION_LABELS[code] },
      create: { code, name: PERMISSION_LABELS[code] },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permByCode = new Map(permissions.map((p) => [p.code, p]));

  // 2) Gán lại quyền cho từng vai trò đúng theo ROLE_PERMISSIONS.
  for (const roleCode of Object.values(ROLES) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: ROLE_LABELS[roleCode] },
      create: { code: roleCode, name: ROLE_LABELS[roleCode] },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[roleCode].map((code) => ({
        roleId: role.id,
        permissionId: permByCode.get(code)!.id,
      })),
      skipDuplicates: true,
    });
    console.log(`   ✓ ${roleCode}: ${ROLE_PERMISSIONS[roleCode].length} quyền`);
  }

  console.log("✔ Xong. Hãy ĐĂNG XUẤT và ĐĂNG NHẬP lại để nhận quyền mới.");
}

main()
  .catch((e) => {
    console.error("✗ Lỗi đồng bộ quyền:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
