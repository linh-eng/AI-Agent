// =============================================================================
// Mục 6 — Tiền cọc + Hủy phiếu thu (không đếm trùng / không phân bổ trùng).
//   * Cọc ACTIVE phân bổ vào hóa đơn 1 lần → cộng vào "đã trả"; không phân bổ lại.
//   * Cọc vượt công nợ còn lại bị chặn.
//   * Hủy phiếu thu (void) → không tính vào "đã trả", trạng thái hóa đơn tính lại.
//   * Công nợ khách = hóa đơn − (phiếu thu hợp lệ + cọc đã phân bổ).
// =============================================================================
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { createInvoiceFromProposal, invoicePaidAmount, recomputeInvoiceStatus } from "@/lib/invoice";
import { createDeposit, allocateDeposit, voidPayment, voidDeposit, FinanceError } from "@/lib/deposit";
import { customerFinancials } from "@/lib/clinic";

async function acceptedProposal(customerId: string, agreedPrice: number) {
  return prisma.treatmentProposal.create({
    data: {
      code: uniq("PROP"), customerId, title: "Báo giá test", status: "ACCEPTED", agreedPrice,
      acceptedAt: new Date(), acceptedBy: "Tester",
      acceptedSnapshot: { name: "PA", items: [{ name: "Liệu trình", quantity: 1, unitPrice: agreedPrice, isHomeCare: false }] } as any,
    },
  });
}

describe("Mục 6 — Tiền cọc & hủy phiếu thu", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("cọc phân bổ vào hóa đơn 1 lần → cộng vào đã trả, không đếm trùng, không phân bổ lại", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 10_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 4_000_000 } });

    const dep = await createDeposit({ customerId: c.id, amount: 1_000_000, method: "TRANSFER" });
    expect(dep.status).toBe("ACTIVE");
    // Trước khi phân bổ: đã trả = 4M (cọc chưa tính).
    expect(await invoicePaidAmount(invoice.id)).toBe(4_000_000);

    await allocateDeposit(dep.id, invoice.id, "Thu ngân");
    // Sau phân bổ: đã trả = 4M + 1M = 5M (cọc cộng ĐÚNG một lần).
    expect(await invoicePaidAmount(invoice.id)).toBe(5_000_000);
    const after = await prisma.deposit.findUniqueOrThrow({ where: { id: dep.id } });
    expect(after.status).toBe("ALLOCATED");
    expect(after.invoiceId).toBe(invoice.id);

    // Phân bổ lại cùng cọc → chặn (không cộng trùng).
    await expect(allocateDeposit(dep.id, invoice.id, "Thu ngân")).rejects.toBeInstanceOf(FinanceError);
    expect(await invoicePaidAmount(invoice.id)).toBe(5_000_000);
  });

  it("cọc vượt công nợ còn lại của hóa đơn bị chặn", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 1_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 800_000 } });
    const dep = await createDeposit({ customerId: c.id, amount: 500_000 }); // > còn 200k
    await expect(allocateDeposit(dep.id, invoice.id)).rejects.toMatchObject({ status: 422 });
  });

  it("cọc của khách khác không phân bổ được vào hóa đơn", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    const p = await acceptedProposal(a.id, 5_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    const depB = await createDeposit({ customerId: b.id, amount: 1_000_000 });
    await expect(allocateDeposit(depB.id, invoice.id)).rejects.toMatchObject({ status: 400 });
  });

  it("hủy phiếu thu → không tính vào đã trả, hóa đơn về PARTIAL/UNPAID", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 6_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    const pay = await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 6_000_000 } });
    let s = await recomputeInvoiceStatus(invoice.id);
    expect(s?.status).toBe("PAID");

    await voidPayment(pay.id, "Thu nhầm", "Quản lý");
    expect(await invoicePaidAmount(invoice.id)).toBe(0);
    s = await recomputeInvoiceStatus(invoice.id);
    expect(s?.status).toBe("UNPAID");
    const voided = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidReason).toBe("Thu nhầm");
    // Hủy lần 2 → chặn.
    await expect(voidPayment(pay.id, "lại", "QL")).rejects.toMatchObject({ status: 409 });
  });

  it("công nợ khách = hóa đơn − (phiếu thu hợp lệ + cọc đã phân bổ)", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 10_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    const pay = await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 5_000_000 } });
    const voided = await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 500_000 } });
    await voidPayment(voided.id, "nhầm", "QL");
    const dep = await createDeposit({ customerId: c.id, amount: 1_000_000 });
    await allocateDeposit(dep.id, invoice.id);

    const cf = await customerFinancials(c.id);
    expect(cf.totalBilled).toBe(10_000_000);
    // đã trả = 5M (hợp lệ) + 1M (cọc) ; phiếu 500k đã hủy KHÔNG tính.
    expect(cf.totalPaid).toBe(6_000_000);
    expect(cf.debt).toBe(4_000_000);
    expect(pay.id).toBeTruthy();
  });

  it("cọc đã phân bổ không thể hủy trực tiếp; cọc ACTIVE hủy được", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 3_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    const dep = await createDeposit({ customerId: c.id, amount: 1_000_000 });
    await allocateDeposit(dep.id, invoice.id);
    await expect(voidDeposit(dep.id, "thử hủy", "QL")).rejects.toMatchObject({ status: 409 });

    const dep2 = await createDeposit({ customerId: c.id, amount: 500_000 });
    const v = await voidDeposit(dep2.id, "khách đổi ý", "QL");
    expect(v.status).toBe("VOID");
  });
});
