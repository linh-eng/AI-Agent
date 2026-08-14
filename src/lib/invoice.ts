// =============================================================================
// Lõi tài chính hợp nhất (mục 14–18): Báo giá → Khách chốt → HÓA ĐƠN → Thanh toán
// → Công nợ. Công nợ được tính từ HÓA ĐƠN (không phải báo giá).
//
// Nguyên tắc:
//  - Hóa đơn có thể tạo từ một báo giá ĐÃ CHỐT (dùng acceptedSnapshot bất biến),
//    hoặc lập thủ công theo hạng mục.
//  - Một hóa đơn nhận NHIỀU lần thanh toán (append-only). Trạng thái hóa đơn được
//    suy ra từ tổng đã trả: UNPAID / PARTIAL / PAID. CANCELLED không tính công nợ.
//  - Tổng hạng mục (subtotal) và tổng phải thu (total) là snapshot tại thời điểm lập.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface InvoiceItemInput {
  name: string;
  quantity?: number;
  unitPrice?: number;
  note?: string | null;
}

/** Sinh mã hóa đơn kế tiếp: HĐ-000123. Dùng ký tự Latin để tương thích in ấn. */
export async function nextInvoiceCode(): Promise<string> {
  return sequentialCode("HD", await prisma.invoice.count());
}

/**
 * Dựng danh sách hạng mục hóa đơn từ snapshot của một phương án báo giá đã chốt.
 * Gộp theo (tên) không cần thiết — giữ nguyên từng dòng để đối chiếu báo giá.
 */
export function itemsFromAcceptedSnapshot(snapshot: any): InvoiceItemInput[] {
  const items: any[] = Array.isArray(snapshot?.items) ? snapshot.items : [];
  return items.map((it) => ({
    name: it.name,
    quantity: it.quantity ?? 1,
    unitPrice: num(it.unitPrice),
    note: it.isHomeCare ? "Sản phẩm tại nhà" : null,
  }));
}

export function computeInvoiceTotals(
  items: InvoiceItemInput[],
  discount = 0
): { subtotal: number; discount: number; total: number; lines: Array<InvoiceItemInput & { amount: number }> } {
  const lines = items.map((it) => ({
    ...it,
    quantity: it.quantity ?? 1,
    unitPrice: num(it.unitPrice),
    amount: num(it.unitPrice) * (it.quantity ?? 1),
  }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(0, subtotal - num(discount));
  return { subtotal, discount: num(discount), total, lines };
}

/**
 * Tổng đã trả cho một hóa đơn = thanh toán CHƯA HỦY (voidedAt null) + tiền cọc
 * đã PHÂN BỔ vào chính hóa đơn này (status ALLOCATED). KHÔNG đếm trùng: cọc chỉ
 * được cộng khi đã phân bổ (allocate) đúng một lần vào hóa đơn, và phiếu thu bị
 * hủy không còn tính.
 */
export async function invoicePaidAmount(
  invoiceId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<number> {
  const [payAgg, depAgg] = await Promise.all([
    tx.payment.aggregate({ where: { invoiceId, voidedAt: null }, _sum: { amount: true } }),
    tx.deposit.aggregate({ where: { invoiceId, status: "ALLOCATED" }, _sum: { amount: true } }),
  ]);
  return num(payAgg._sum.amount) + num(depAgg._sum.amount);
}

/**
 * Suy trạng thái hóa đơn theo tổng đã trả so với tổng phải thu, rồi lưu lại.
 * Không đụng tới hóa đơn đã CANCELLED.
 */
export async function recomputeInvoiceStatus(
  invoiceId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<{ status: string; paid: number; total: number; outstanding: number } | null> {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return null;
  const total = num(inv.total);
  const paid = await invoicePaidAmount(invoiceId, tx);
  let status = inv.status;
  if (inv.status !== "CANCELLED") {
    status = paid <= 0 ? "UNPAID" : paid + 1e-6 >= total ? "PAID" : "PARTIAL";
    if (status !== inv.status) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: status as any } });
    }
  }
  const outstanding = inv.status === "CANCELLED" ? 0 : Math.max(0, total - paid);
  return { status, paid, total, outstanding };
}

/**
 * Tạo hóa đơn từ báo giá đã chốt. Idempotent nhẹ: nếu đã tồn tại hóa đơn (chưa hủy)
 * cho báo giá này thì trả về hóa đơn đó thay vì tạo trùng.
 */
export async function createInvoiceFromProposal(
  proposalId: string,
  createdBy?: string
): Promise<{ invoice: any; reused: boolean }> {
  const proposal = await prisma.treatmentProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw Object.assign(new Error("Không tìm thấy báo giá"), { status: 404 });
  // ACCEPTED = vừa chốt; CONVERTED = đã có hóa đơn (trả lại bản đã tạo — idempotent).
  if (proposal.status !== "ACCEPTED" && proposal.status !== "CONVERTED")
    throw Object.assign(new Error("Chỉ tạo hóa đơn từ báo giá đã được khách chốt"), { status: 409 });

  const existing = await prisma.invoice.findFirst({
    where: { proposalId, status: { not: "CANCELLED" } },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  if (existing) return { invoice: existing, reused: true };

  const items = itemsFromAcceptedSnapshot(proposal.acceptedSnapshot);
  // agreedPrice là giá thống nhất (đã gồm chiết khấu) — dùng làm tổng phải thu.
  const { subtotal, lines } = computeInvoiceTotals(items, 0);
  const total = num(proposal.agreedPrice) || subtotal;
  const discount = Math.max(0, subtotal - total);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        code: await nextInvoiceCode(),
        customerId: proposal.customerId,
        proposalId: proposal.id,
        proposalOptionId: proposal.acceptedOptionId,
        planId: proposal.planId,
        status: "UNPAID",
        subtotal,
        discount,
        total,
        createdBy: createdBy ?? null,
        items: {
          create: lines.map((l, i) => ({
            name: l.name,
            quantity: l.quantity ?? 1,
            unitPrice: num(l.unitPrice),
            amount: l.amount,
            note: l.note ?? null,
            orderIndex: i,
          })),
        },
      },
      include: { items: { orderBy: { orderIndex: "asc" } } },
    });
    // Báo giá đã chốt → chuyển sang "Đã chuyển hóa đơn" (giữ acceptedSnapshot bất biến).
    await tx.treatmentProposal.update({ where: { id: proposal.id }, data: { status: "CONVERTED" } });
    return inv;
  });
  return { invoice, reused: false };
}

/**
 * Công nợ khách hàng tính TỪ HÓA ĐƠN (mục 18).
 *  - billed = tổng total của hóa đơn chưa hủy.
 *  - paid   = tổng thanh toán gắn hóa đơn chưa hủy.
 *  - debt   = billed − paid (>= 0).
 * Trả kèm invoiceCount để phía gọi biết có nên fallback (khách chưa có hóa đơn).
 */
export async function customerInvoiceFinancials(customerId: string): Promise<{
  totalBilled: number;
  totalPaid: number;
  debt: number;
  invoiceCount: number;
}> {
  const invoices = await prisma.invoice.findMany({
    where: { customerId, status: { not: "CANCELLED" } },
    select: { id: true, total: true },
  });
  const totalBilled = invoices.reduce((s, i) => s + num(i.total), 0);
  const ids = invoices.map((i) => i.id);
  const [paidAgg, depAgg] = ids.length
    ? await Promise.all([
        prisma.payment.aggregate({ where: { invoiceId: { in: ids }, voidedAt: null }, _sum: { amount: true } }),
        prisma.deposit.aggregate({ where: { invoiceId: { in: ids }, status: "ALLOCATED" }, _sum: { amount: true } }),
      ])
    : [{ _sum: { amount: null } }, { _sum: { amount: null } }];
  const totalPaid = num(paidAgg._sum.amount) + num(depAgg._sum.amount);
  return {
    totalBilled,
    totalPaid,
    debt: Math.max(0, totalBilled - totalPaid),
    invoiceCount: invoices.length,
  };
}
