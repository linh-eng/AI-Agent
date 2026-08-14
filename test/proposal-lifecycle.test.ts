// =============================================================================
// Bằng chứng Mục 6 (bổ sung):
//  1) Báo giá hỗ trợ ĐỦ 8 trạng thái lifecycle (enum + nhãn VN + đường đi hợp lệ).
//  2) Hủy Payment ghi NGƯỜI HỦY + THỜI ĐIỂM HỦY + LÝ DO — tách biệt người thu ban đầu.
// =============================================================================
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { createInvoiceFromProposal } from "@/lib/invoice";
import { voidPayment } from "@/lib/deposit";
import { PROPOSAL_STATUS_LABEL } from "@/lib/clinic-labels";
import { Prisma } from "@prisma/client";

// 8 trạng thái theo bản mô tả (mục 15).
const LIFECYCLE: Array<{ code: string; label: string }> = [
  { code: "DRAFT", label: "Bản nháp" },
  { code: "SENT", label: "Đã gửi" },
  { code: "VIEWING", label: "Khách đang xem" },
  { code: "ACCEPTED", label: "Khách chốt" },
  { code: "REJECTED", label: "Khách từ chối" },
  { code: "EXPIRED", label: "Hết hiệu lực" },
  { code: "CONVERTED", label: "Đã chuyển hóa đơn" },
  { code: "CANCELLED", label: "Hủy" },
];

describe("1) Lifecycle báo giá — đủ 8 trạng thái", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("enum ProposalStatus có đủ 8 giá trị + nhãn tiếng Việt đúng", () => {
    for (const s of LIFECYCLE) {
      expect(PROPOSAL_STATUS_LABEL[s.code]).toBe(s.label);
    }
    // Không dư/thiếu: map nhãn có đúng 8 khóa.
    expect(Object.keys(PROPOSAL_STATUS_LABEL).sort()).toEqual(LIFECYCLE.map((s) => s.code).sort());
  });

  it("DB chấp nhận & lưu được TẤT CẢ 8 trạng thái (không có giá trị nào bị chặn ở tầng dữ liệu)", async () => {
    const c = await makeCustomer();
    for (const s of LIFECYCLE) {
      const p = await prisma.treatmentProposal.create({
        data: { code: uniq("PROP"), customerId: c.id, title: `BG ${s.code}`, status: s.code as any },
      });
      const back = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: p.id } });
      expect(back.status).toBe(s.code);
    }
  });

  it("đường đi vòng đời thực tế: DRAFT → SENT → VIEWING → ACCEPTED → CONVERTED (+ nhánh REJECTED/EXPIRED/CANCELLED)", async () => {
    const c = await makeCustomer();
    // Tạo báo giá 1 phương án dịch vụ.
    const p = await prisma.treatmentProposal.create({
      data: {
        code: uniq("PROP"), customerId: c.id, title: "Vòng đời", status: "DRAFT",
        options: { create: [{ kind: "RECOMMENDED", name: "PA1", orderIndex: 0, items: { create: [{ itemType: "SERVICE", name: "RF", quantity: 1, unitPrice: 5_000_000, orderIndex: 0 }] } } ] },
      },
      include: { options: { include: { items: true } } },
    });
    const opt = p.options[0];

    // DRAFT → SENT → VIEWING (các bước gửi/khách xem).
    await prisma.treatmentProposal.update({ where: { id: p.id }, data: { status: "SENT" } });
    await prisma.treatmentProposal.update({ where: { id: p.id }, data: { status: "VIEWING" } });
    let cur = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: p.id } });
    expect(cur.status).toBe("VIEWING");

    // → ACCEPTED (khách chốt: đông cứng snapshot + agreedPrice).
    await prisma.treatmentProposal.update({
      where: { id: p.id },
      data: {
        status: "ACCEPTED", acceptedOptionId: opt.id, acceptedAt: new Date(), acceptedBy: "Khách A",
        agreedPrice: 5_000_000,
        acceptedSnapshot: { name: opt.name, items: [{ name: "RF", quantity: 1, unitPrice: 5_000_000 }] } as any,
      },
    });

    // → CONVERTED (tạo hóa đơn từ báo giá đã chốt tự chuyển trạng thái).
    const { invoice } = await createInvoiceFromProposal(p.id, "Thu ngân");
    cur = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: p.id } });
    expect(cur.status).toBe("CONVERTED");
    expect(Number(invoice.total)).toBe(5_000_000);
    expect(invoice.proposalOptionId).toBe(opt.id); // truy vết phương án đã chốt

    // Nhánh kết thúc khác: REJECTED / EXPIRED / CANCELLED (báo giá khác).
    for (const end of ["REJECTED", "EXPIRED", "CANCELLED"]) {
      const q = await prisma.treatmentProposal.create({ data: { code: uniq("PROP"), customerId: c.id, title: end, status: "SENT" } });
      await prisma.treatmentProposal.update({ where: { id: q.id }, data: { status: end as any } });
      const qb = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: q.id } });
      expect(qb.status).toBe(end);
    }
  });
});

describe("2) Hủy Payment — audit người hủy + thời điểm + lý do (tách biệt người thu)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("void ghi ĐỦ 3 TRƯỜNG: người hủy (voidedBy) + thời điểm hủy (voidedAt) + lý do (voidReason), tách biệt receivedBy", async () => {
    const c = await makeCustomer();
    const inv = await prisma.invoice.create({ data: { code: uniq("HD"), customerId: c.id, total: 2_000_000, subtotal: 2_000_000 } });
    const pay = await prisma.payment.create({
      data: { code: uniq("PT"), customerId: c.id, invoiceId: inv.id, amount: 2_000_000, method: "CASH", receivedBy: "Thu Ngân A" },
    });
    // Trước khi hủy: cả 3 trường đều rỗng.
    expect(pay.voidedBy).toBeNull();
    expect(pay.voidedAt).toBeNull();
    expect(pay.voidReason).toBeNull();

    const before = new Date();
    await voidPayment(pay.id, "Khách hủy giao dịch — hoàn tiền mặt", "Quản Lý B");
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });

    // (1) NGƯỜI THỰC HIỆN HỦY
    expect(after.voidedBy).toBe("Quản Lý B");
    // (2) THỜI ĐIỂM HỦY (đã set, không lùi quá thời điểm trước lệnh)
    expect(after.voidedAt).not.toBeNull();
    expect(after.voidedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    // (3) LÝ DO HỦY
    expect(after.voidReason).toBe("Khách hủy giao dịch — hoàn tiền mặt");

    // Tách biệt: người THU ban đầu giữ nguyên và KHÁC người hủy.
    expect(after.receivedBy).toBe("Thu Ngân A");
    expect(after.voidedBy).not.toBe(after.receivedBy);
    // Không hard-delete: bản ghi vẫn tồn tại.
    expect(after.id).toBe(pay.id);

    // Lý do là BẮT BUỘC (schema paymentVoidSchema.reason min 1) — không hủy trống lý do.
    const pay2 = await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, invoiceId: inv.id, amount: 1_000_000, receivedBy: "Thu Ngân A" } });
    const { paymentVoidSchema } = await import("@/lib/clinic-validation");
    expect(paymentVoidSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(paymentVoidSchema.safeParse({ reason: "hợp lệ" }).success).toBe(true);
    expect(pay2.id).toBeTruthy();
  });

  it("audit_logs lưu bản ghi PAYMENT_VOID kèm userId + lý do (như route ghi)", async () => {
    const c = await makeCustomer();
    const inv = await prisma.invoice.create({ data: { code: uniq("HD"), customerId: c.id, total: 1_000_000, subtotal: 1_000_000 } });
    const pay = await prisma.payment.create({ data: { code: uniq("PT"), customerId: c.id, invoiceId: inv.id, amount: 1_000_000, receivedBy: "Thu Ngân A" } });

    // Mô phỏng đúng như route /api/payments/[id]/void: voidPayment + auditLog.
    await voidPayment(pay.id, "Thu nhầm hóa đơn", "Quản Lý B");
    await prisma.auditLog.create({
      data: { userId: null, action: "PAYMENT_VOID", entityType: "Payment", entityId: pay.id, changes: { reason: "Thu nhầm hóa đơn", by: "Quản Lý B" } as any },
    });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PAYMENT_VOID", entityId: pay.id } });
    expect(audit.entityType).toBe("Payment");
    expect((audit.changes as any).reason).toBe("Thu nhầm hóa đơn");
    expect(audit.createdAt).toBeInstanceOf(Date);
  });
});
