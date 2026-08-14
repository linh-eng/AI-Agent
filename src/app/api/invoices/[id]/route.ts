export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { invoiceUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { recomputeInvoiceStatus, invoicePaidAmount } from "@/lib/invoice";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.INVOICE_READ);
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, code: true, fullName: true, phone: true } },
      proposal: { select: { id: true, code: true, title: true } },
      items: { orderBy: { orderIndex: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      deposits: { orderBy: { receivedAt: "desc" } },
    },
  });
  if (!invoice) return fail(404, "Không tìm thấy hóa đơn");
  // Đã trả = phiếu thu CHƯA HỦY + cọc đã PHÂN BỔ (không đếm trùng).
  const paidAmount = await invoicePaidAmount(params.id);
  const outstanding = invoice.status === "CANCELLED" ? 0 : Math.max(0, Number(invoice.total) - paidAmount);
  return ok({ ...invoice, paidAmount, outstanding });
});

// PATCH: hủy hóa đơn (status=CANCELLED) hoặc sửa hạn/ghi chú. Không sửa hạng mục
// (giữ snapshot). Không cho hủy nếu đã có thanh toán.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.INVOICE_WRITE);
  const parsed = invoiceUpdateSchema.parse(await req.json());
  const current = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: {
          payments: { where: { voidedAt: null } },
          deposits: { where: { status: "ALLOCATED" } },
        },
      },
    },
  });
  if (!current) return fail(404, "Không tìm thấy hóa đơn");

  const data: Record<string, unknown> = {};
  if (parsed.dueDate !== undefined) data.dueDate = parsed.dueDate;
  if (parsed.note !== undefined) data.note = parsed.note;

  if (parsed.status === "CANCELLED") {
    if (current.status === "CANCELLED") return fail(409, "Hóa đơn đã hủy trước đó");
    if (current._count.payments > 0 || current._count.deposits > 0)
      return fail(409, "Hóa đơn đã có thanh toán/cọc — không thể hủy (hủy phiếu thu / gỡ cọc trước nếu cần)");
    data.status = "CANCELLED";
  }

  const invoice = await prisma.invoice.update({ where: { id: params.id }, data });
  // Nếu chỉ sửa hạn/ghi chú, cập nhật lại trạng thái theo thanh toán hiện có.
  if (parsed.status !== "CANCELLED") await recomputeInvoiceStatus(params.id);
  await auditLog({
    userId: session.userId,
    action: parsed.status === "CANCELLED" ? "INVOICE_CANCELLED" : "INVOICE_UPDATED",
    entityType: "Invoice",
    entityId: invoice.id,
    changes: { status: invoice.status },
  });
  return ok(invoice);
});
