export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { branchCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";

// GET /api/branches?active=1  → danh mục chi nhánh. Đọc = staff.read (dùng chung).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.STAFF_READ);
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "1";
  const branches = await prisma.branch.findMany({
    where: { ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });
  return ok(branches.map((b) => ({
    id: b.id, code: b.code, name: b.name, timezone: b.timezone, address: b.address,
    isActive: b.isActive, note: b.note, employeeCount: b._count.employees,
  })));
});

// POST /api/branches  → tạo chi nhánh. Ghi = staff.write (tái dùng, không thêm branch.manage).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.STAFF_WRITE);
  const parsed = branchCreateSchema.parse(await req.json());
  const code = parsed.code?.trim() || sequentialCode("CN", await prisma.branch.count());
  const branch = await prisma.branch.create({
    data: {
      code, name: parsed.name, timezone: parsed.timezone ?? null, address: parsed.address ?? null,
      note: parsed.note ?? null, isActive: parsed.isActive ?? true,
    },
  });
  await auditLog({ userId: session.userId, action: "BRANCH_CREATED", entityType: "Branch", entityId: branch.id, changes: { code, name: branch.name } });
  return created(branch);
});
