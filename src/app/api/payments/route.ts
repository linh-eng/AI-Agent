export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { paymentCreateSchema } from "@/lib/clinic-validation";
import { customerFinancials, auditLog } from "@/lib/clinic";
import { recomputeInvoiceStatus, invoicePaidAmount } from "@/lib/invoice";
import { nextPaymentCode } from "@/lib/deposit";
import { fail } from "@/lib/api";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PAYMENT_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const invoiceId = url.searchParams.get("invoiceId") ?? undefined;
  const payments = await prisma.payment.findMany({
    where: { ...(customerId ? { customerId } : {}), ...(invoiceId ? { invoiceId } : {}) },
    include: {
      customer: { select: { code: true, fullName: true } },
      invoice: { select: { code: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 300,
  });
  return ok(payments);
});

// Một hóa đơn có thể thanh toán nhiều lần — append-only (mục 18, 21).
// Nếu gắn hóa đơn: kiểm tra thuộc đúng khách, chặn trả vượt số còn phải thu,
// rồi cập nhật lại trạng thái hóa đơn (UNPAID/PARTIAL/PAID).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PAYMENT_WRITE);
  const parsed = paymentCreateSchema.parse(await req.json());

  if (parsed.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: parsed.invoiceId } });
    if (!invoice) return fail(404, "Không tìm thấy hóa đơn");
    if (invoice.customerId !== parsed.customerId)
      return fail(400, "Hóa đơn không thuộc khách hàng này");
    if (invoice.status === "CANCELLED") return fail(409, "Hóa đơn đã hủy — không thể thu tiền");
    const paid = await invoicePaidAmount(parsed.invoiceId);
    const outstanding = Math.max(0, Number(invoice.total) - paid);
    if (parsed.amount - outstanding > 1e-6)
      return fail(422, `Số tiền vượt công nợ còn lại của hóa đơn (còn ${outstanding.toLocaleString("vi-VN")} ₫)`);
  }

  const payment = await prisma.payment.create({
    data: {
      ...parsed,
      code: await nextPaymentCode(),
      paidAt: parsed.paidAt ?? new Date(),
      receivedBy: parsed.receivedBy ?? session.name,
    },
  });
  if (parsed.invoiceId) await recomputeInvoiceStatus(parsed.invoiceId);
  await auditLog({
    userId: session.userId,
    action: "PAYMENT",
    entityType: "Payment",
    entityId: payment.id,
    changes: { customerId: parsed.customerId, invoiceId: parsed.invoiceId, amount: parsed.amount, method: parsed.method },
  });
  const financials = await customerFinancials(parsed.customerId);
  return created({ ...payment, financials });
});
