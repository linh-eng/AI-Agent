import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { detectBookingConflicts } from "@/lib/booking";

async function booking(customerId: string, at: string, over: any = {}) {
  return prisma.booking.create({
    data: { code: uniq("BK"), customerId, scheduledAt: new Date(at), durationMinutes: 60, status: "CONFIRMED", ...over },
  });
}

describe("Booking — phát hiện trùng lịch tài nguyên (mục 19–21)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("cùng kỹ thuật viên, thời gian giao nhau → trùng", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { technician: "Ngọc" });
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T09:30:00Z"), durationMinutes: 60, technician: "Ngọc",
    });
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].field).toBe("technician");
    expect(conflicts[0].value).toBe("Ngọc");
  });

  it("cùng KTV nhưng thời gian KHÔNG giao (liền kề) → không trùng", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { technician: "Ngọc" }); // 09:00–10:00
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T10:00:00Z"), durationMinutes: 60, technician: "Ngọc", // 10:00–11:00
    });
    expect(conflicts.length).toBe(0);
  });

  it("phòng trùng nhưng KTV khác → vẫn trùng (do trùng phòng)", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { technician: "An", room: "P1" });
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T09:15:00Z"), durationMinutes: 30, technician: "Bình", room: "P1",
    });
    expect(conflicts.map((c) => c.field)).toContain("room");
    expect(conflicts.map((c) => c.field)).not.toContain("technician");
  });

  it("booking đã HỦY không tính là trùng", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { technician: "Ngọc", status: "CANCELLED" });
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T09:30:00Z"), durationMinutes: 60, technician: "Ngọc",
    });
    expect(conflicts.length).toBe(0);
  });

  it("excludeId bỏ qua chính booking đang sửa", async () => {
    const c = await makeCustomer();
    const b = await booking(c.id, "2026-09-01T09:00:00Z", { technician: "Ngọc" });
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T09:00:00Z"), durationMinutes: 60, technician: "Ngọc", excludeId: b.id,
    });
    expect(conflicts.length).toBe(0);
  });

  it("không có tài nguyên nào → không xét trùng", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z");
    const conflicts = await detectBookingConflicts({ scheduledAt: new Date("2026-09-01T09:30:00Z"), durationMinutes: 60 });
    expect(conflicts.length).toBe(0);
  });
});
