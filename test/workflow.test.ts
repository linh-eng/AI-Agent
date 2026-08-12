import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildCustomerTimeline, customerFinancials, proposalOptionTotal } from "@/lib/clinic";
import { resetDb, uniq, makeCustomer } from "./helpers";

describe("Hành trình khách end-to-end (Postgres thật)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("customer → assessment → plan → session → form instance → care → booking → media → timeline", async () => {
    const cust = await makeCustomer({ code: uniq("KH"), fullName: "Nguyễn Test" });

    // Đánh giá
    await prisma.assessment.create({ data: { customerId: cust.id, name: "Nám má", severity: "Vừa" } });

    // Phác đồ + buổi
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: cust.id, name: "Phác đồ nám" } });
    const session = await prisma.treatmentSession.create({
      data: { planId: plan.id, customerId: cust.id, sessionNumber: 1, name: "Buổi 1", status: "COMPLETED", performedAt: new Date() },
    });

    // Form template + instance (snapshot schema)
    const tpl = await prisma.formTemplate.create({
      data: { code: uniq("FORM"), name: "Phiếu da", status: "ACTIVE", schema: { sections: [], logic: [] } as any },
    });
    const inst = await prisma.formInstance.create({
      data: { templateId: tpl.id, templateVersion: tpl.version, schemaSnapshot: tpl.schema as any, customerId: cust.id, sessionId: session.id, data: { note: "ok" } as any },
    });
    // Sửa template sau -> instance snapshot KHÔNG đổi
    await prisma.formTemplate.update({ where: { id: tpl.id }, data: { schema: { sections: [{ id: "x" }], logic: [] } as any, version: 2 } });
    const instAfter = await prisma.formInstance.findUnique({ where: { id: inst.id } });
    expect((instAfter!.schemaSnapshot as any).sections.length).toBe(0);
    expect(instAfter!.templateVersion).toBe(1);

    // Care snapshot (sửa mẫu sau không đổi bản đã gửi)
    const care = await prisma.careInstruction.create({ data: { code: uniq("CARE"), title: "Sau laser", content: "Tránh nắng", status: "ACTIVE" } });
    const careInst = await prisma.careInstructionInstance.create({
      data: { templateId: care.id, templateVersion: care.version, title: care.title, content: care.content, customerId: cust.id, deliveredAt: new Date() },
    });
    await prisma.careInstruction.update({ where: { id: care.id }, data: { content: "NỘI DUNG MỚI", version: 2 } });
    const careAfter = await prisma.careInstructionInstance.findUnique({ where: { id: careInst.id } });
    expect(careAfter!.content).toBe("Tránh nắng"); // snapshot bất biến

    // Booking (giá snapshot)
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: cust.id, scheduledAt: new Date(), status: "COMPLETED", price: 2000000 } });

    // Media before/after gắn buổi
    await prisma.mediaAsset.create({ data: { storageKey: uniq("k") + ".png", filename: "before.png", contentType: "image/png", size: 10, kind: "BEFORE_IMAGE", customerId: cust.id, sessionId: session.id } });

    // Thanh toán
    await prisma.payment.create({ data: { customerId: cust.id, amount: 1000000, method: "CASH" } });

    // Timeline gộp mọi loại sự kiện
    const timeline = await buildCustomerTimeline(cust.id);
    const kinds = new Set(timeline.map((e) => e.kind));
    expect(kinds.has("assessment")).toBe(true);
    expect(kinds.has("plan")).toBe(true);
    expect(kinds.has("session")).toBe(true);
    expect(kinds.has("booking")).toBe(true);
    expect(kinds.has("care")).toBe(true);
    expect(kinds.has("payment")).toBe(true);

    // Công nợ: plan chưa có giá -> booking lẻ 2tr, đã trả 1tr
    const fin = await customerFinancials(cust.id);
    expect(fin.totalPaid).toBe(1000000);
  });

  it("proposal: chốt phương án -> acceptedSnapshot bất biến khi đổi catalog", async () => {
    const cust = await makeCustomer({ code: uniq("KH") });
    const service = await prisma.service.create({ data: { code: uniq("DV"), name: "Laser", standardPrice: 2500000 } });
    const proposal = await prisma.treatmentProposal.create({
      data: {
        code: uniq("PROP"), customerId: cust.id, title: "BG nám",
        options: { create: [{ kind: "PREMIUM", name: "Cao cấp", items: { create: [{ itemType: "SERVICE", refId: service.id, name: "Laser", quantity: 6, unitPrice: 2500000 }] } }] },
      },
      include: { options: { include: { items: true } } },
    });
    const opt = proposal.options[0];
    const total = proposalOptionTotal(opt.items, opt.discount);
    expect(total).toBe(15000000);

    // Chốt: đông cứng snapshot
    const snapshot = { optionId: opt.id, name: opt.name, computedTotal: total, items: opt.items.map((i) => ({ name: i.name, unitPrice: i.unitPrice, quantity: i.quantity })) };
    await prisma.treatmentProposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED", acceptedOptionId: opt.id, acceptedAt: new Date(), agreedPrice: total, acceptedSnapshot: snapshot as any },
    });

    // Đổi giá dịch vụ sau khi chốt
    await prisma.service.update({ where: { id: service.id }, data: { standardPrice: 9999999 } });

    const after = await prisma.treatmentProposal.findUnique({ where: { id: proposal.id } });
    expect(Number((after!.acceptedSnapshot as any).computedTotal)).toBe(15000000); // bất biến
    expect(Number(after!.agreedPrice)).toBe(15000000);
  });
});
