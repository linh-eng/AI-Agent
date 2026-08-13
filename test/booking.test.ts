import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { detectBookingConflicts, suggestAlternativeSlots, DEFAULT_DURATION_MIN } from "@/lib/booking";

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

  it("trùng master / giường / máy đều được phát hiện", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { master: "Master X", bed: "G1", machine: "HIFU 01" });
    const conflicts = await detectBookingConflicts({
      scheduledAt: new Date("2026-09-01T09:30:00Z"), durationMinutes: 60, master: "Master X", bed: "G1", machine: "HIFU 01",
    });
    const fields = conflicts.map((c) => c.field).sort();
    expect(fields).toEqual(["bed", "machine", "master"]);
  });

  it("không nhập thời lượng → dùng mặc định 60′ để xét giao nhau", async () => {
    const c = await makeCustomer();
    await booking(c.id, "2026-09-01T09:00:00Z", { technician: "Ngọc", durationMinutes: null });
    const conflicts = await detectBookingConflicts({ scheduledAt: new Date("2026-09-01T09:59:00Z"), technician: "Ngọc" });
    expect(DEFAULT_DURATION_MIN).toBe(60);
    expect(conflicts.length).toBe(1); // 09:00–10:00 giao 09:59–10:59
  });
});

describe("Lịch hẹn — gợi ý khung giờ thay thế (mục 12, 24)", () => {
  beforeEach(async () => { await resetDb(); });

  it("KTV bận 09:00–10:00 → gợi ý slot trống đầu tiên là 10:00", async () => {
    const c = await makeCustomer();
    const base = new Date(2099, 8, 1, 9, 0, 0); // 09:00 giờ máy chủ
    await prisma.booking.create({ data: { code: uniq("BK"), customerId: c.id, scheduledAt: base, durationMinutes: 60, status: "CONFIRMED", technician: "Ngọc" } });
    const slots = await suggestAlternativeSlots({ scheduledAt: base, durationMinutes: 60, technician: "Ngọc", limit: 3 });
    expect(slots.length).toBeGreaterThan(0);
    expect(new Date(slots[0].scheduledAt).getHours()).toBe(10);
  });

  it("KTV được đánh dấu NGƯNG HOẠT ĐỘNG → không gợi ý slot nào", async () => {
    await prisma.employee.create({ data: { code: uniq("NV"), fullName: "Nghỉ Việc", isActive: false } });
    const base = new Date(2099, 8, 1, 9, 0, 0);
    const slots = await suggestAlternativeSlots({ scheduledAt: base, durationMinutes: 60, technician: "Nghỉ Việc" });
    expect(slots.length).toBe(0);
  });

  it("không chọn tài nguyên → không gợi ý (mọi giờ đều trống, vô nghĩa)", async () => {
    const base = new Date(2099, 8, 1, 9, 0, 0);
    const slots = await suggestAlternativeSlots({ scheduledAt: base, durationMinutes: 60 });
    expect(slots).toEqual([]);
  });
});
