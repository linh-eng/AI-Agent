export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { roleFeeCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { resolveRoleFee } from "@/lib/hr";

// Thêm/đổi phí vai trò. Đổi phí = TẠO BẢN MỚI (không sửa lịch sử); đóng bản cũ
// còn hiệu lực (effectiveTo = từ ngày mới). Audit ghi giá trị CŨ → MỚI (mục 20).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_FEE_WRITE);
  const parsed = roleFeeCreateSchema.parse(await req.json());
  const emp = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!emp) return fail(404, "Không tìm thấy nhân sự");

  const from = parsed.effectiveFrom ?? new Date();
  const oldFee = await resolveRoleFee(params.id, parsed.role, from);

  const result = await prisma.$transaction(async (tx) => {
    // Đóng bản đang mở cùng vai trò (nếu chưa có effectiveTo và bắt đầu trước bản mới).
    await tx.employeeRoleFee.updateMany({
      where: { employeeId: params.id, role: parsed.role, isActive: true, effectiveTo: null, effectiveFrom: { lt: from } },
      data: { effectiveTo: from },
    });
    return tx.employeeRoleFee.create({
      data: {
        employeeId: params.id, role: parsed.role, fee: parsed.fee, effectiveFrom: from,
        effectiveTo: parsed.effectiveTo ?? null, note: parsed.note ?? null, createdBy: session.name,
      },
    });
  });

  await auditLog({
    userId: session.userId, action: "STAFF_FEE_CHANGED", entityType: "Employee", entityId: params.id,
    changes: { role: parsed.role, oldFee, newFee: parsed.fee, effectiveFrom: from.toISOString(), by: session.name },
  });
  return created(result);
});

// Ngừng hiệu lực một bản phí (soft) — cần STAFF_FEE_WRITE.
export const DELETE = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_FEE_WRITE);
  const feeId = new URL(req.url).searchParams.get("feeId");
  if (!feeId) return fail(400, "Thiếu feeId");
  const row = await prisma.employeeRoleFee.findFirst({ where: { id: feeId, employeeId: params.id } });
  if (!row) return fail(404, "Không tìm thấy bản phí");
  const updated = await prisma.employeeRoleFee.update({ where: { id: feeId }, data: { isActive: false, effectiveTo: row.effectiveTo ?? new Date() } });
  await auditLog({ userId: session.userId, action: "STAFF_FEE_ENDED", entityType: "Employee", entityId: params.id, changes: { role: row.role, feeId } });
  return ok(updated);
});
