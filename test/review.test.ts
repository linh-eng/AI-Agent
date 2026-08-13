import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer, makePlanWithSession } from "./helpers";
import { reviewSummary, beforeAfterGroups } from "@/lib/review";

describe("Đánh giá & Before/After (mục 36–37, 8)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("upsert đánh giá: 1 đánh giá / buổi (không nhân đôi)", async () => {
    const c = await makeCustomer();
    const { session } = await makePlanWithSession(c.id);
    await prisma.sessionReview.upsert({
      where: { sessionId: session.id },
      create: { sessionId: session.id, customerId: c.id, satisfactionScore: 4, technicianScore: 5, technicianName: "Ngọc" },
      update: {},
    });
    await prisma.sessionReview.upsert({
      where: { sessionId: session.id },
      create: { sessionId: session.id, customerId: c.id, satisfactionScore: 3 },
      update: { satisfactionScore: 5 },
    });
    const rows = await prisma.sessionReview.findMany({ where: { sessionId: session.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].satisfactionScore).toBe(5);
  });

  it("tổng hợp đánh giá: điểm TB + tỷ lệ quay lại + theo KTV", async () => {
    const c = await makeCustomer();
    const { session: s1 } = await makePlanWithSession(c.id);
    const { session: s2 } = await makePlanWithSession(c.id);
    await prisma.sessionReview.create({ data: { sessionId: s1.id, customerId: c.id, satisfactionScore: 4, technicianScore: 4, technicianName: "Ngọc", wouldReturn: true } });
    await prisma.sessionReview.create({ data: { sessionId: s2.id, customerId: c.id, satisfactionScore: 5, technicianScore: 5, technicianName: "Ngọc", wouldReturn: false } });

    const sum = await reviewSummary();
    expect(sum.totalReviews).toBe(2);
    expect(sum.avgSatisfaction).toBe(4.5);
    expect(sum.avgTechnician).toBe(4.5);
    expect(sum.wouldReturnRate).toBe(50);
    expect(sum.technicians[0].technicianName).toBe("Ngọc");
    expect(sum.technicians[0].count).toBe(2);
    expect(sum.technicians[0].avgTechnicianScore).toBe(4.5);
  });

  it("Before/After gom theo buổi + lọc theo khách", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    const { session: sa } = await makePlanWithSession(a.id);
    const { session: sb } = await makePlanWithSession(b.id);
    async function media(kind: string, sessionId: string, customerId: string) {
      return prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "img.png", contentType: "image/png", size: 10, kind: kind as any, sessionId, customerId } });
    }
    await media("BEFORE_IMAGE", sa.id, a.id);
    await media("AFTER_IMAGE", sa.id, a.id);
    await media("BEFORE_IMAGE", sb.id, b.id);

    const all = await beforeAfterGroups({});
    expect(all.length).toBe(2);
    const forA = await beforeAfterGroups({ customerId: a.id });
    expect(forA.length).toBe(1);
    expect(forA[0].before.length).toBe(1);
    expect(forA[0].after.length).toBe(1);
    expect(forA[0].customerName).toBe(a.fullName);
  });
});
