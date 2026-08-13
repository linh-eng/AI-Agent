import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import {
  createInvoiceFromProposal,
  recomputeInvoiceStatus,
  invoicePaidAmount,
  customerInvoiceFinancials,
  computeInvoiceTotals,
} from "@/lib/invoice";
import { customerFinancials } from "@/lib/clinic";

// Dựng một báo giá ĐÃ CHỐT với snapshot + agreedPrice cho trước.
async function acceptedProposal(customerId: string, agreedPrice: number) {
  const proposal = await prisma.treatmentProposal.create({
    data: {
      code: uniq("PROP"),
      customerId,
      title: "Báo giá test",
      status: "ACCEPTED",
      agreedPrice,
      acceptedAt: new Date(),
      acceptedBy: "Tester",
      acceptedSnapshot: {
        name: "Phương án thiết yếu",
        items: [
          { name: "Liệu trình nâng cơ", quantity: 1, unitPrice: agreedPrice - 500_000, isHomeCare: false },
          { name: "Kem chống nắng", quantity: 1, unitPrice: 500_000, isHomeCare: true },
        ],
      } as any,
    },
  });
  return proposal;
}

describe("Lõi tài chính — Hóa đơn & công nợ (mục 14–18)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("computeInvoiceTotals cộng đúng subtotal/total và áp chiết khấu", () => {
    const r = computeInvoiceTotals(
      [{ name: "A", quantity: 2, unitPrice: 100 }, { name: "B", quantity: 1, unitPrice: 300 }],
      50
    );
    expect(r.subtotal).toBe(500);
    expect(r.total).toBe(450);
    expect(r.lines[0].amount).toBe(200);
  });

  it("tạo hóa đơn từ báo giá đã chốt: tổng = agreedPrice, hạng mục từ snapshot", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 5_000_000);
    const { invoice, reused } = await createInvoiceFromProposal(p.id, "Thu ngân");
    expect(reused).toBe(false);
    expect(Number(invoice.total)).toBe(5_000_000);
    expect(invoice.items.length).toBe(2);
    expect(invoice.status).toBe("UNPAID");
    expect(invoice.proposalId).toBe(p.id);
  });

  it("không tạo trùng hóa đơn cho cùng báo giá (idempotent)", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 3_000_000);
    const first = await createInvoiceFromProposal(p.id);
    const second = await createInvoiceFromProposal(p.id);
    expect(second.reused).toBe(true);
    expect(second.invoice.id).toBe(first.invoice.id);
    const count = await prisma.invoice.count({ where: { proposalId: p.id } });
    expect(count).toBe(1);
  });

  it("chỉ tạo hóa đơn từ báo giá ĐÃ CHỐT", async () => {
    const c = await makeCustomer();
    const draft = await prisma.treatmentProposal.create({
      data: { code: uniq("PROP"), customerId: c.id, title: "Nháp", status: "DRAFT" },
    });
    await expect(createInvoiceFromProposal(draft.id)).rejects.toMatchObject({ status: 409 });
  });

  it("nhiều lần thanh toán → trạng thái UNPAID→PARTIAL→PAID", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 4_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);

    await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 1_000_000 } });
    let s = await recomputeInvoiceStatus(invoice.id);
    expect(s?.status).toBe("PARTIAL");
    expect(s?.outstanding).toBe(3_000_000);

    await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 3_000_000 } });
    s = await recomputeInvoiceStatus(invoice.id);
    expect(s?.status).toBe("PAID");
    expect(s?.outstanding).toBe(0);
    expect(await invoicePaidAmount(invoice.id)).toBe(4_000_000);
  });

  it("công nợ khách tính TỪ HÓA ĐƠN (không phải báo giá)", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 6_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    await prisma.payment.create({ data: { customerId: c.id, invoiceId: invoice.id, amount: 2_000_000 } });

    const f = await customerInvoiceFinancials(c.id);
    expect(f.totalBilled).toBe(6_000_000);
    expect(f.totalPaid).toBe(2_000_000);
    expect(f.debt).toBe(4_000_000);
    expect(f.invoiceCount).toBe(1);

    // customerFinancials (dùng ở API/hồ sơ) cũng phản ánh công nợ theo hóa đơn.
    const cf = await customerFinancials(c.id);
    expect(cf.totalBilled).toBe(6_000_000);
    expect(cf.debt).toBe(4_000_000);
  });

  it("hóa đơn đã hủy KHÔNG tính vào công nợ", async () => {
    const c = await makeCustomer();
    const p = await acceptedProposal(c.id, 2_000_000);
    const { invoice } = await createInvoiceFromProposal(p.id);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    const f = await customerInvoiceFinancials(c.id);
    expect(f.totalBilled).toBe(0);
    expect(f.debt).toBe(0);
  });
});
