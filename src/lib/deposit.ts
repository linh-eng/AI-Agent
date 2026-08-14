// =============================================================================
// TIỀN CỌC (mục 17) — thu trước khi có hóa đơn, phân bổ vào hóa đơn ĐÚNG MỘT LẦN.
//
// Nguyên tắc (chống đếm trùng / phân bổ trùng):
//  - Cọc là MỘT bản ghi tiền thật (Deposit). Khi thu: status = ACTIVE (đang giữ).
//  - Phân bổ (allocate) cọc vào 1 hóa đơn: chỉ khi ACTIVE → chuyển ALLOCATED, gắn
//    invoiceId. Cọc ALLOCATED KHÔNG phân bổ lại được (một lần).
//  - Số tiền đã trả của hóa đơn = payment (chưa hủy) + cọc ALLOCATED vào chính hóa
//    đơn đó (xem invoice.ts::invoicePaidAmount). Không cộng cọc như một payment nữa.
//  - Khóa dòng cọc bằng SELECT … FOR UPDATE trong transaction (chống phân bổ đồng thời).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";
import { invoicePaidAmount, recomputeInvoiceStatus } from "./invoice";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

/** Lỗi nghiệp vụ cọc/thanh toán — mang mã HTTP để route trả đúng status. */
export class FinanceError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

export async function nextDepositCode(): Promise<string> {
  return sequentialCode("DC", await prisma.deposit.count());
}

export async function nextPaymentCode(): Promise<string> {
  return sequentialCode("PT", await prisma.payment.count());
}

/** Thu cọc (thường từ Booking). Trạng thái ACTIVE — chưa trừ công nợ hóa đơn nào. */
export async function createDeposit(input: {
  customerId: string;
  bookingId?: string | null;
  amount: number;
  method?: string;
  txnRef?: string | null;
  receivedBy?: string | null;
  note?: string | null;
}) {
  if (input.amount <= 0) throw new FinanceError("Số tiền cọc phải lớn hơn 0", 422);
  return prisma.deposit.create({
    data: {
      code: await nextDepositCode(),
      customerId: input.customerId,
      bookingId: input.bookingId ?? null,
      amount: input.amount,
      method: (input.method as any) ?? "CASH",
      txnRef: input.txnRef ?? null,
      status: "ACTIVE",
      receivedBy: input.receivedBy ?? null,
      note: input.note ?? null,
    },
  });
}

/**
 * Phân bổ cọc ACTIVE vào một hóa đơn — đúng một lần. Chặn:
 *  - cọc không ở trạng thái ACTIVE (đã phân bổ / hủy / hoàn) → 409.
 *  - hóa đơn đã hủy → 409.
 *  - cọc khác khách với hóa đơn → 400.
 *  - số cọc vượt công nợ còn lại của hóa đơn → 422 (tránh trả dư qua cọc).
 * Khóa dòng cọc FOR UPDATE để hai lần phân bổ đồng thời không cùng thành công.
 */
export async function allocateDeposit(
  depositId: string,
  invoiceId: string,
  allocatedBy?: string | null
) {
  return prisma.$transaction(async (tx) => {
    // Khóa dòng cọc (chống phân bổ trùng khi đồng thời).
    const locked = await tx.$queryRaw<Array<{ id: string; status: string; customerId: string; amount: Prisma.Decimal }>>(
      Prisma.sql`SELECT id, status, "customerId", amount FROM deposits WHERE id = ${depositId} FOR UPDATE`
    );
    const dep = locked[0];
    if (!dep) throw new FinanceError("Không tìm thấy phiếu cọc", 404);
    if (dep.status !== "ACTIVE")
      throw new FinanceError("Phiếu cọc không còn khả dụng để phân bổ (đã phân bổ/hoàn/hủy)", 409);

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new FinanceError("Không tìm thấy hóa đơn", 404);
    if (invoice.status === "CANCELLED") throw new FinanceError("Hóa đơn đã hủy — không thể phân bổ cọc", 409);
    if (invoice.customerId !== dep.customerId)
      throw new FinanceError("Phiếu cọc không thuộc khách của hóa đơn này", 400);

    const paid = await invoicePaidAmount(invoiceId, tx);
    const outstanding = Math.max(0, num(invoice.total) - paid);
    if (num(dep.amount) - outstanding > 1e-6)
      throw new FinanceError(
        `Cọc vượt công nợ còn lại của hóa đơn (còn ${outstanding.toLocaleString("vi-VN")} ₫)`,
        422
      );

    const updated = await tx.deposit.update({
      where: { id: depositId },
      data: { status: "ALLOCATED", invoiceId, allocatedAt: new Date(), allocatedBy: allocatedBy ?? null },
    });
    const invStatus = await recomputeInvoiceStatus(invoiceId, tx);
    return { deposit: updated, invoice: invStatus };
  });
}

/** Hủy phiếu cọc chưa phân bổ (giữ vết). Cọc đã ALLOCATED phải gỡ phân bổ trước. */
export async function voidDeposit(depositId: string, reason: string, voidedBy?: string | null) {
  const dep = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!dep) throw new FinanceError("Không tìm thấy phiếu cọc", 404);
  if (dep.status === "VOID") throw new FinanceError("Phiếu cọc đã hủy trước đó", 409);
  if (dep.status === "ALLOCATED")
    throw new FinanceError("Cọc đã phân bổ vào hóa đơn — không thể hủy trực tiếp", 409);
  return prisma.deposit.update({
    where: { id: depositId },
    data: { status: "VOID", voidedAt: new Date(), voidReason: reason, voidedBy: voidedBy ?? null },
  });
}

/**
 * Hủy phiếu thu (mục 16) — KHÔNG hard-delete, ghi vết voidedAt/voidReason/voidedBy.
 * Sau khi hủy, tính lại trạng thái hóa đơn (số đã trả giảm → có thể về PARTIAL/UNPAID).
 */
export async function voidPayment(paymentId: string, reason: string, voidedBy?: string | null) {
  return prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new FinanceError("Không tìm thấy phiếu thu", 404);
    if (pay.voidedAt) throw new FinanceError("Phiếu thu đã hủy trước đó", 409);
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidReason: reason, voidedBy: voidedBy ?? null },
    });
    let invoice = null;
    if (pay.invoiceId) invoice = await recomputeInvoiceStatus(pay.invoiceId, tx);
    return { payment: updated, invoice };
  });
}
