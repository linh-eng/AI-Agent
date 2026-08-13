import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { applyFollowUpTemplate, upcomingBirthdays } from "@/lib/followup";

async function template(steps: { dayOffset: number; channel?: string; title: string; checklist?: string[] }[]) {
  return prisma.followUpTemplate.create({
    data: {
      code: uniq("CS"), name: "Chăm sóc sau dịch vụ", trigger: "AFTER_SERVICE",
      steps: { create: steps.map((s, i) => ({ orderIndex: i, dayOffset: s.dayOffset, channel: (s.channel ?? "ZALO") as any, title: s.title, checklist: s.checklist ?? [] })) },
    },
  });
}

describe("CSKH follow-up (mục 31–35)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("áp quy trình → sinh Task theo lịch (dueDate = mốc + dayOffset), kèm kênh/checklist", async () => {
    const c = await makeCustomer();
    const t = await template([
      { dayOffset: 1, channel: "ZALO", title: "Hỏi thăm sau 1 ngày", checklist: ["Hỏi phản ứng da", "Nhắc kiêng nắng"] },
      { dayOffset: 7, channel: "SMS", title: "Gọi tư vấn buổi kế" },
    ]);
    const anchor = new Date("2026-09-01T00:00:00Z");
    const tasks = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: anchor, assignee: "Lê CSKH" });
    expect(tasks).toHaveLength(2);
    const step1 = tasks[0];
    expect(step1.channel).toBe("ZALO");
    expect(new Date(step1.dueDate!).toISOString().slice(0, 10)).toBe("2026-09-02");
    expect((step1.checklist as string[]).length).toBe(2);
    expect(step1.followUpTemplateId).toBe(t.id);
    expect(new Date(tasks[1].dueDate!).toISOString().slice(0, 10)).toBe("2026-09-08");

    // Có ghi nhật ký CSKH.
    const crm = await prisma.crmActivity.findMany({ where: { customerId: c.id, type: "FOLLOW_UP" } });
    expect(crm.length).toBe(1);
  });

  it("quy trình đã ngưng → không áp được", async () => {
    const c = await makeCustomer();
    const t = await template([{ dayOffset: 1, title: "x" }]);
    await prisma.followUpTemplate.update({ where: { id: t.id }, data: { isActive: false } });
    await expect(applyFollowUpTemplate({ templateId: t.id, customerId: c.id })).rejects.toMatchObject({ status: 409 });
  });

  it("sinh nhật sắp tới: lọc trong N ngày, tính đúng số ngày còn lại", async () => {
    // today cố định để test tất định
    const today = new Date("2026-09-01T00:00:00Z");
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Sinh nhật gần", dob: new Date("1994-09-05") } });
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Sinh nhật xa", dob: new Date("1990-12-20") } });
    const list = await upcomingBirthdays(30, today);
    const names = list.map((b) => b.fullName);
    expect(names).toContain("Sinh nhật gần");
    expect(names).not.toContain("Sinh nhật xa");
    const near = list.find((b) => b.fullName === "Sinh nhật gần")!;
    expect(near.inDays).toBe(4); // 01/09 → 05/09
    expect(near.turningAge).toBe(32);
  });
});
