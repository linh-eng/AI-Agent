import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer } from "./helpers";
import { applyFollowUpTemplate, cancelCareInstance, upcomingBirthdays, FollowUpDuplicateError } from "@/lib/followup";

async function template(steps: { dayOffset: number; channel?: string; title: string; script?: string; checklist?: string[] }[], over: Partial<{ name: string; trigger: string; version: number }> = {}) {
  return prisma.followUpTemplate.create({
    data: {
      code: uniq("CS"), name: over.name ?? "Chăm sóc sau dịch vụ", trigger: (over.trigger ?? "AFTER_SERVICE") as any,
      version: over.version ?? 1,
      steps: { create: steps.map((s, i) => ({ orderIndex: i, dayOffset: s.dayOffset, channel: (s.channel ?? "ZALO") as any, title: s.title, script: s.script ?? null, checklist: s.checklist ?? [] })) },
    },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
}

describe("CSKH follow-up (mục 9)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  // --- B: Áp quy trình → instance + task đúng lịch + snapshot version -------
  it("B · áp quy trình 3 bước (+0/+1/+7) ngày 14/08/2026 → 1 lần áp + 3 task đúng hạn + snapshot", async () => {
    const c = await makeCustomer();
    const t = await template([
      { dayOffset: 0, channel: "IN_PERSON", title: "Dặn dò ngay", checklist: ["Nhắc kiêng nắng"] },
      { dayOffset: 1, channel: "ZALO", title: "Hỏi thăm sau 1 ngày", script: "Chào anh/chị..." },
      { dayOffset: 7, channel: "SMS", title: "Gọi tư vấn buổi kế" },
    ]);
    const anchor = new Date("2026-08-14T00:00:00Z");
    const res = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: anchor, assignee: "Lê CSKH", createdBy: "Quản Lý" });

    // 1 instance snapshot version
    expect(res.instance.templateVersion).toBe(1);
    const inst = await prisma.careProcessInstance.findUnique({ where: { id: res.instance.id } });
    expect(inst?.status).toBe("ACTIVE");
    expect(inst?.templateCode).toBe(t.code);

    // 3 task đúng hạn + gắn instance + snapshot bước
    const tasks = await prisma.task.findMany({ where: { careProcessInstanceId: res.instance.id }, orderBy: { dueDate: "asc" } });
    expect(tasks).toHaveLength(3);
    expect(tasks.map((x) => new Date(x.dueDate!).toISOString().slice(0, 10))).toEqual(["2026-08-14", "2026-08-15", "2026-08-21"]);
    expect(tasks[0].channel).toBe("IN_PERSON");
    expect(tasks[0].processVersion).toBe(1);
    expect((tasks[0].stepSnapshot as any).title).toBe("Dặn dò ngay");
    expect((tasks[0].checklist as string[]).length).toBe(1);
    expect(tasks[1].description).toBe("Chào anh/chị..."); // kịch bản

    // Nhật ký CSKH
    const crm = await prisma.crmActivity.findMany({ where: { customerId: c.id, type: "FOLLOW_UP" } });
    expect(crm.length).toBe(1);
  });

  // --- C: Chống trùng -------------------------------------------------------
  it("C · áp lại cùng khách + quy trình + ngày mốc (đang chạy) → chặn; force → tạo lần áp mới", async () => {
    const c = await makeCustomer();
    const t = await template([{ dayOffset: 1, title: "x" }]);
    const anchor = new Date("2026-08-14T00:00:00Z");
    await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: anchor });

    // Áp lại cùng ngày → chặn
    await expect(applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: anchor }))
      .rejects.toBeInstanceOf(FollowUpDuplicateError);

    // force → tạo lần áp thứ 2 (id riêng)
    const forced = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: anchor, force: true });
    const count = await prisma.careProcessInstance.count({ where: { customerId: c.id, templateId: t.id } });
    expect(count).toBe(2);
    expect(forced.instance.id).toBeTruthy();

    // Ngày mốc KHÁC → không coi là trùng (không cần force)
    const other = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: new Date("2026-09-01T00:00:00Z") });
    expect(other.instance.id).toBeTruthy();
  });

  // --- D: Snapshot bất biến -------------------------------------------------
  it("D · sửa mẫu (bump version + đổi bước) KHÔNG đổi task đã áp; áp mới dùng nội dung mới", async () => {
    const c = await makeCustomer();
    const t = await template([{ dayOffset: 1, channel: "ZALO", title: "Kịch bản CŨ", script: "Nội dung cũ", checklist: ["A"] }]);
    const v1 = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: new Date("2026-08-14T00:00:00Z") });
    const oldTask = (await prisma.task.findMany({ where: { careProcessInstanceId: v1.instance.id } }))[0];

    // Sửa mẫu: bump version + thay bước
    await prisma.followUpStep.deleteMany({ where: { templateId: t.id } });
    await prisma.followUpTemplate.update({
      where: { id: t.id },
      data: { version: 2, steps: { create: [{ orderIndex: 0, dayOffset: 2, channel: "SMS" as any, title: "Kịch bản MỚI", script: "Nội dung mới", checklist: ["B", "C"] }] } },
    });

    // Task cũ giữ nguyên snapshot
    const stillOld = await prisma.task.findUnique({ where: { id: oldTask.id } });
    expect((stillOld!.stepSnapshot as any).title).toBe("Kịch bản CŨ");
    expect(stillOld!.processVersion).toBe(1);
    expect(stillOld!.title).toBe("Kịch bản CŨ");

    // Áp mới (ngày khác) → task dùng nội dung v2
    const v2 = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: new Date("2026-09-01T00:00:00Z") });
    expect(v2.instance.templateVersion).toBe(2);
    const newTask = (await prisma.task.findMany({ where: { careProcessInstanceId: v2.instance.id } }))[0];
    expect(newTask.title).toBe("Kịch bản MỚI");
    expect(newTask.processVersion).toBe(2);
  });

  // --- E: Ngưng quy trình ---------------------------------------------------
  it("E · ngưng dùng mẫu → không áp mới được, task/lần áp đã tạo vẫn giữ", async () => {
    const c = await makeCustomer();
    const t = await template([{ dayOffset: 1, title: "x" }]);
    const applied = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: new Date("2026-08-14T00:00:00Z") });

    await prisma.followUpTemplate.update({ where: { id: t.id }, data: { isActive: false } });
    await expect(applyFollowUpTemplate({ templateId: t.id, customerId: c.id })).rejects.toMatchObject({ status: 409 });

    // Lần áp + task cũ vẫn còn
    const inst = await prisma.careProcessInstance.findUnique({ where: { id: applied.instance.id } });
    expect(inst?.status).toBe("ACTIVE");
    const tasks = await prisma.task.count({ where: { careProcessInstanceId: applied.instance.id } });
    expect(tasks).toBe(1);
  });

  // --- Hủy lần áp (khác ngưng mẫu): giữ lịch sử, hủy task tương lai ---------
  it("hủy LẦN ÁP → instance CANCELLED + task chưa xong chuyển CANCELLED (không xóa), task DONE giữ", async () => {
    const c = await makeCustomer();
    const t = await template([{ dayOffset: 1, title: "a" }, { dayOffset: 5, title: "b" }]);
    const res = await applyFollowUpTemplate({ templateId: t.id, customerId: c.id, anchorDate: new Date("2026-08-14T00:00:00Z") });
    const tasks = await prisma.task.findMany({ where: { careProcessInstanceId: res.instance.id }, orderBy: { dueDate: "asc" } });
    // Hoàn thành task đầu
    await prisma.task.update({ where: { id: tasks[0].id }, data: { status: "DONE", completedAt: new Date(), completedBy: "NV" } });

    const cancel = await cancelCareInstance({ instanceId: res.instance.id, reason: "Khách ngưng liệu trình", cancelledBy: "Quản Lý" });
    expect(cancel.cancelledTasks).toBe(1); // chỉ task chưa xong

    const inst = await prisma.careProcessInstance.findUnique({ where: { id: res.instance.id } });
    expect(inst?.status).toBe("CANCELLED");
    expect(inst?.cancelReason).toBe("Khách ngưng liệu trình");
    const after = await prisma.task.findMany({ where: { careProcessInstanceId: res.instance.id } });
    expect(after.find((x) => x.id === tasks[0].id)?.status).toBe("DONE"); // giữ
    expect(after.find((x) => x.id === tasks[1].id)?.status).toBe("CANCELLED"); // hủy, không xóa
    expect(after.length).toBe(2); // KHÔNG hard-delete
  });

  // --- Sinh nhật ------------------------------------------------------------
  it("sinh nhật: lọc trong N ngày, đúng số ngày còn lại + tuổi + phụ trách + prefill date", async () => {
    const today = new Date("2026-09-01T00:00:00Z");
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Sinh nhật gần", dob: new Date("1994-09-05"), assignedTo: "Lê CSKH" } });
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Sinh nhật xa", dob: new Date("1990-12-20") } });
    const list = await upcomingBirthdays(30, today);
    const names = list.map((b) => b.fullName);
    expect(names).toContain("Sinh nhật gần");
    expect(names).not.toContain("Sinh nhật xa");
    const near = list.find((b) => b.fullName === "Sinh nhật gần")!;
    expect(near.inDays).toBe(4);
    expect(near.turningAge).toBe(32);
    expect(near.assignedTo).toBe("Lê CSKH");
    expect(near.nextBirthdayDate).toBe("2026-09-05");
  });

  it("sinh nhật: xử lý wrap cuối năm (hôm nay 20/12, sinh 05/01 → còn ~16 ngày)", async () => {
    const today = new Date("2026-12-20T00:00:00Z");
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Đầu năm sau", dob: new Date("1995-01-05") } });
    const list = await upcomingBirthdays(30, today);
    const hit = list.find((b) => b.fullName === "Đầu năm sau");
    expect(hit).toBeTruthy();
    expect(hit!.inDays).toBe(16); // 20/12 → 05/01 năm sau
    expect(hit!.nextBirthdayDate).toBe("2027-01-05");
  });

  it("sinh nhật: khách không có DOB → loại khỏi tự động", async () => {
    const today = new Date("2026-09-01T00:00:00Z");
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Không DOB" } });
    const list = await upcomingBirthdays(30, today);
    expect(list.map((b) => b.fullName)).not.toContain("Không DOB");
  });
});
