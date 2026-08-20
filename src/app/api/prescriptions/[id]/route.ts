export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { prescriptionUpdateSchema } from "@/lib/clinic-validation";
import { buildPrescriptionItems, prescriptionInclude } from "@/lib/prescription";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const row = await prisma.prescription.findUnique({ where: { id: params.id }, include: prescriptionInclude });
  if (!row) return fail(404, "Không tìm thấy toa");
  return ok(row);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = prescriptionUpdateSchema.parse(await req.json());
  const cur = await prisma.prescription.findUnique({ where: { id: params.id }, select: { id: true, status: true, code: true, customerId: true } });
  if (!cur) return fail(404, "Không tìm thấy toa");

  // Kê toa (issue): khóa nội dung + ghi timeline khách (lưu hồ sơ).
  if (parsed.action === "issue") {
    if (cur.status !== "DRAFT") return fail(409, "Chỉ kê được toa đang ở trạng thái Nháp");
    const row = await prisma.prescription.update({
      where: { id: params.id },
      data: { status: "ISSUED", issuedAt: new Date(), issuedBy: parsed.issuedBy || session.name },
      include: prescriptionInclude,
    });
    await prisma.crmActivity.create({
      data: {
        customerId: cur.customerId, type: "AFTERCARE",
        content: `Kê toa sau thực hiện ${row.code}: ${row.items.map((i) => i.name).join(", ") || "(không có sản phẩm)"}`,
        performedBy: row.issuedBy ?? session.name, occurredAt: new Date(),
      },
    });
    await auditLog({ userId: session.userId, action: "PRESCRIPTION_ISSUED", entityType: "Prescription", entityId: row.id, changes: { code: row.code } });
    return ok(row);
  }

  // Hủy toa.
  if (parsed.action === "cancel") {
    if (!parsed.cancelReason?.trim()) return fail(422, "Nhập lý do hủy toa");
    if (cur.status === "CANCELLED") return fail(409, "Toa đã hủy");
    const row = await prisma.prescription.update({
      where: { id: params.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.cancelReason.trim() },
      include: prescriptionInclude,
    });
    await auditLog({ userId: session.userId, action: "PRESCRIPTION_CANCELLED", entityType: "Prescription", entityId: row.id, changes: { code: row.code, reason: parsed.cancelReason } });
    return ok(row);
  }

  // Sửa nội dung — chỉ khi còn NHÁP (toa đã kê là bất biến).
  if (cur.status !== "DRAFT") return fail(409, "Toa đã kê/đã hủy — không sửa được");
  const row = await prisma.$transaction(async (tx) => {
    if (parsed.items !== undefined) await tx.prescriptionItem.deleteMany({ where: { prescriptionId: params.id } });
    return tx.prescription.update({
      where: { id: params.id },
      data: {
        diagnosis: parsed.diagnosis ?? undefined,
        advice: parsed.advice ?? undefined,
        followUpDate: parsed.followUpDate,
        issuedBy: parsed.issuedBy ?? undefined,
        ...(parsed.items !== undefined ? { items: { create: buildPrescriptionItems(parsed.items) } } : {}),
      },
      include: prescriptionInclude,
    });
  });
  return ok(row);
});
