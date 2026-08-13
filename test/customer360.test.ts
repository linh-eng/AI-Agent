import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { customerSummary, buildCustomerTimeline } from "@/lib/clinic";
import { computeAge } from "@/lib/utils";

describe("Hồ sơ khách hàng 360°", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("computeAge: tính tuổi tròn từ ngày sinh (tất định theo mốc now)", () => {
    const now = new Date("2026-08-13T00:00:00Z");
    expect(computeAge("1993-08-30", now)).toBe(32); // chưa tới sinh nhật
    expect(computeAge("1993-08-01", now)).toBe(33); // đã qua sinh nhật
    expect(computeAge(null, now)).toBeNull();
    expect(computeAge("không hợp lệ", now)).toBeNull();
  });

  it("customerSummary: tổng buổi, booking tiếp theo, follow-up, phác đồ đang chạy, KTV/dịch vụ gần nhất", async () => {
    const c = await makeCustomer();
    const svc = await prisma.service.create({ data: { code: uniq("SV"), name: "RF nâng cơ", standardPrice: 1_800_000 } });

    // Phác đồ ACTIVE: 1 buổi COMPLETED (quá khứ) + 1 buổi PLANNED (tương lai)
    const plan = await prisma.treatmentPlan.create({ data: { code: uniq("TP"), customerId: c.id, name: "Phác đồ nâng cơ", status: "ACTIVE" } });
    const doneSession = await prisma.treatmentSession.create({
      data: { planId: plan.id, customerId: c.id, serviceId: svc.id, sessionNumber: 1, name: "Buổi 1",
        status: "COMPLETED", performer: "KTV Ngọc", performedAt: new Date("2026-07-25T07:00:00Z") },
    });
    await prisma.sessionStaff.create({ data: { sessionId: doneSession.id, staffName: "KTV Ngọc", role: "PRIMARY", fee: 200_000 } });
    await prisma.treatmentSession.create({
      data: { planId: plan.id, customerId: c.id, sessionNumber: 2, name: "Buổi 2", status: "PLANNED", scheduledAt: new Date("2999-01-01T07:00:00Z") },
    });
    await prisma.sessionReview.create({ data: { sessionId: doneSession.id, customerId: c.id, satisfactionScore: 5, technicianScore: 5, technicianName: "KTV Ngọc" } });

    // Booking sắp tới (tương lai) + booking quá khứ đã hoàn thành
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, serviceId: svc.id, scheduledAt: new Date("2999-01-02T07:00:00Z"), status: "CONFIRMED", technician: "KTV Ngọc" } });
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, serviceId: svc.id, scheduledAt: new Date("2020-01-01T07:00:00Z"), status: "COMPLETED" } });

    // Việc follow-up đang chờ
    await prisma.task.create({ data: { title: "Gọi hỏi thăm", customerId: c.id, assignee: "CSKH", dueDate: new Date("2999-01-01T00:00:00Z"), status: "OPEN" } });

    const s = await customerSummary(c.id);
    expect(s.totalSessions).toBe(1);
    expect(s.totalBookings).toBe(2);
    expect(s.nextBooking?.status).toBe("CONFIRMED"); // chỉ lấy booking tương lai còn hiệu lực
    expect(s.nextFollowUp?.title).toBe("Gọi hỏi thăm");
    expect(s.pendingCareTasks).toBe(1);
    expect(s.activePlan?.name).toBe("Phác đồ nâng cơ");
    expect(s.activePlan?.totalSessions).toBe(2);
    expect(s.activePlan?.doneSessions).toBe(1);
    expect(s.lastTechnician).toBe("KTV Ngọc");
    expect(s.lastService).toBe("RF nâng cơ");
    expect(s.lastReview?.satisfactionScore).toBe(5);
  });

  it("summary rỗng khi khách chưa có dữ liệu (không lỗi, trả null hợp lý)", async () => {
    const c = await makeCustomer();
    const s = await customerSummary(c.id);
    expect(s.totalSessions).toBe(0);
    expect(s.nextBooking).toBeNull();
    expect(s.activePlan).toBeNull();
    expect(s.lastReview).toBeNull();
  });

  it("timeline gộp nhiều loại sự kiện và sắp mới nhất trước", async () => {
    const c = await makeCustomer();
    await prisma.crmActivity.create({ data: { customerId: c.id, type: "CALL", content: "Tư vấn", occurredAt: new Date("2026-01-01T00:00:00Z") } });
    await prisma.payment.create({ data: { customerId: c.id, amount: 1_000_000, method: "CASH", paidAt: new Date("2026-06-01T00:00:00Z") } });
    const tl = await buildCustomerTimeline(c.id);
    expect(tl.length).toBe(2);
    expect(tl[0].at >= tl[1].at).toBe(true); // giảm dần theo thời gian
    expect(tl.map((e) => e.kind).sort()).toEqual(["crm", "payment"]);
  });
});
