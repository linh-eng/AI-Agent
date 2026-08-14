// =============================================================================
// CSKH follow-up (mục 9 / 31–35) — áp QUY TRÌNH follow-up cho khách → tạo một
// LẦN ÁP (CareProcessInstance) + sinh Task theo lịch (mốc + số ngày), mỗi Task
// SNAPSHOT nội dung bước (bất biến) kèm kênh/kịch bản/checklist; ghi nhật ký CSKH.
// Và tính danh sách SINH NHẬT sắp tới (chương trình CSKH, tách khỏi Marketing).
//
// Nguyên tắc cứng (mục 9):
//   * Snapshot: sửa mẫu về sau KHÔNG đổi task/instance đã áp (task giữ
//     stepSnapshot + processVersion tại thời điểm áp).
//   * Chống trùng: cùng khách + quy trình + ngày mốc đã có instance ACTIVE →
//     chặn (mặc định), chỉ tạo mới khi `force` + lý do (audit).
//   * Không hard-delete lịch sử: hủy instance = đổi trạng thái + hủy task tương lai.
// =============================================================================
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";
import { vnClock } from "./timezone";
import type { Prisma } from "@prisma/client";

/** Sinh mã quy trình CSKH kế tiếp: CS-000123. */
export async function nextTemplateCode(): Promise<string> {
  return sequentialCode("CS", await prisma.followUpTemplate.count());
}

/** Sinh mã lần áp quy trình kế tiếp: CSI-000123. */
export async function nextInstanceCode(): Promise<string> {
  return sequentialCode("CSI", await prisma.careProcessInstance.count());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Hai instant có cùng NGÀY theo lịch VN không (so ngày/tháng/năm wall-clock VN). */
function sameVnDay(a: Date, b: Date): boolean {
  const x = vnClock(a);
  const y = vnClock(b);
  return x.day === y.day && x.month === y.month && x.year === y.year;
}

export class FollowUpDuplicateError extends Error {
  status = 409;
  code = "DUPLICATE_CARE_INSTANCE";
  existing: { id: string; code: string; appliedAt: Date; startDate: Date };
  constructor(existing: { id: string; code: string; appliedAt: Date; startDate: Date }) {
    super("Khách đã được áp quy trình này cùng ngày mốc (đang chạy). Xác nhận để tạo lần áp mới.");
    this.existing = existing;
  }
}

export interface ApplyResult {
  instance: { id: string; code: string; templateVersion: number };
  tasks: Array<{ id: string; title: string; dueDate: Date | null }>;
}

/**
 * Áp một quy trình follow-up cho khách hàng:
 *   1) Chống trùng: nếu đã có instance ACTIVE cùng (khách, quy trình, ngày mốc)
 *      và `force !== true` → ném FollowUpDuplicateError (409).
 *   2) Tạo CareProcessInstance (snapshot code/tên/version/trigger).
 *   3) Mỗi bước → 1 Task với hạn = anchor + dayOffset, gắn kênh/kịch bản/checklist
 *      + SNAPSHOT bước (stepSnapshot) + processStepId + processVersion.
 *   4) Ghi 1 CrmActivity tổng hợp (timeline khách).
 */
export async function applyFollowUpTemplate(params: {
  templateId: string;
  customerId: string;
  anchorDate?: Date;
  assignee?: string | null;
  createdBy?: string | null;
  force?: boolean;
  note?: string | null;
}): Promise<ApplyResult> {
  const template = await prisma.followUpTemplate.findUnique({
    where: { id: params.templateId },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  if (!template) throw Object.assign(new Error("Không tìm thấy quy trình CSKH"), { status: 404 });
  if (!template.isActive) throw Object.assign(new Error("Quy trình đã ngưng sử dụng — không thể áp mới"), { status: 409 });

  const customer = await prisma.customer.findUnique({ where: { id: params.customerId }, select: { id: true, fullName: true } });
  if (!customer) throw Object.assign(new Error("Không tìm thấy khách hàng"), { status: 404 });

  const anchor = params.anchorDate ?? new Date();

  // (1) Chống trùng — chỉ xét instance ĐANG CHẠY của đúng (khách, quy trình).
  if (!params.force) {
    const actives = await prisma.careProcessInstance.findMany({
      where: { customerId: params.customerId, templateId: template.id, status: "ACTIVE" },
      select: { id: true, code: true, appliedAt: true, startDate: true },
      orderBy: { appliedAt: "desc" },
    });
    const dup = actives.find((i) => sameVnDay(i.startDate, anchor));
    if (dup) throw new FollowUpDuplicateError(dup);
  }

  const code = await nextInstanceCode();

  const result = await prisma.$transaction(async (tx) => {
    const instance = await tx.careProcessInstance.create({
      data: {
        code,
        templateId: template.id,
        templateCode: template.code,
        templateName: template.name,
        templateVersion: template.version,
        trigger: template.trigger,
        customerId: params.customerId,
        startDate: anchor,
        status: "ACTIVE",
        appliedBy: params.createdBy ?? null,
        note: params.note ?? null,
      },
    });

    const tasks = [];
    for (const step of template.steps) {
      const snapshot = {
        stepId: step.id,
        orderIndex: step.orderIndex,
        dayOffset: step.dayOffset,
        channel: step.channel,
        title: step.title,
        script: step.script ?? null,
        checklist: step.checklist,
      };
      const t = await tx.task.create({
        data: {
          title: step.title,
          description: step.script ?? null,
          customerId: params.customerId,
          assignee: params.assignee ?? null,
          dueDate: addDays(anchor, step.dayOffset),
          channel: step.channel,
          checklist: step.checklist.length ? (step.checklist as unknown as Prisma.InputJsonValue) : undefined,
          followUpTemplateId: template.id,
          careProcessInstanceId: instance.id,
          processStepId: step.id,
          processVersion: template.version,
          stepSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          priority: "NORMAL",
          status: "OPEN",
          createdBy: params.createdBy ?? null,
        },
        select: { id: true, title: true, dueDate: true },
      });
      tasks.push(t);
    }

    // Ghi nhật ký CSKH (append-only) để hiện trong timeline khách.
    await tx.crmActivity.create({
      data: {
        customerId: params.customerId,
        type: "FOLLOW_UP",
        content: `Áp quy trình CSKH "${template.name}" (v${template.version}, ${tasks.length} bước) — lần áp ${instance.code}.`,
        performedBy: params.createdBy ?? null,
        followUpDate: tasks[0]?.dueDate ?? null,
        followUpOwner: params.assignee ?? null,
      },
    });

    return { instance, tasks };
  });

  return {
    instance: { id: result.instance.id, code: result.instance.code, templateVersion: result.instance.templateVersion },
    tasks: result.tasks,
  };
}

/**
 * Hủy một LẦN ÁP quy trình (khác với "ngưng dùng" quy trình): giữ lịch sử,
 * chuyển instance → CANCELLED (ghi ai/khi/lý do), và HỦY các task tương lai
 * (chưa hoàn thành/chưa hủy) của lần áp đó (status CANCELLED, không xóa cứng).
 */
export async function cancelCareInstance(params: {
  instanceId: string;
  reason: string;
  cancelledBy?: string | null;
}): Promise<{ cancelledTasks: number }> {
  const inst = await prisma.careProcessInstance.findUnique({ where: { id: params.instanceId } });
  if (!inst) throw Object.assign(new Error("Không tìm thấy lần áp quy trình"), { status: 404 });
  if (inst.status === "CANCELLED") throw Object.assign(new Error("Lần áp đã bị hủy trước đó"), { status: 409 });

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.careProcessInstance.update({
      where: { id: inst.id },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: params.cancelledBy ?? null, cancelReason: params.reason },
    });
    // Chỉ hủy task CHƯA kết thúc (OPEN / IN_PROGRESS). Task đã DONE/CANCELLED giữ nguyên.
    const res = await tx.task.updateMany({
      where: { careProcessInstanceId: inst.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: params.cancelledBy ?? null, cancelReason: `Hủy lần áp quy trình: ${params.reason}` },
    });
    return { cancelledTasks: res.count };
  });
}

/**
 * Đồng bộ trạng thái instance theo task (2 chiều, không đụng instance đã CANCELLED):
 *  - Mọi task đã kết thúc + có ≥1 DONE → COMPLETED.
 *  - Còn task chưa xong (OPEN/IN_PROGRESS) mà instance đang COMPLETED → quay lại ACTIVE
 *    (vd mở lại một task đã hoàn thành).
 */
export async function recomputeCareInstanceStatus(instanceId: string): Promise<void> {
  const inst = await prisma.careProcessInstance.findUnique({ where: { id: instanceId }, select: { status: true } });
  if (!inst || inst.status === "CANCELLED") return; // hủy là quyết định thủ công, không tự đổi
  const remaining = await prisma.task.count({
    where: { careProcessInstanceId: instanceId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (remaining === 0) {
    const anyDone = await prisma.task.count({ where: { careProcessInstanceId: instanceId, status: "DONE" } });
    if (anyDone > 0 && inst.status === "ACTIVE") {
      await prisma.careProcessInstance.update({ where: { id: instanceId }, data: { status: "COMPLETED" } });
    }
  } else if (inst.status === "COMPLETED") {
    // Có task mở lại → instance chưa hoàn tất, đưa về ACTIVE.
    await prisma.careProcessInstance.update({ where: { id: instanceId }, data: { status: "ACTIVE" } });
  }
}

export interface UpcomingBirthday {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  assignedTo: string | null;
  dob: string; // ISO
  day: number;
  month: number;
  turningAge: number | null;
  inDays: number; // số ngày tới sinh nhật (0 = hôm nay)
  nextBirthday: string; // ISO ngày sinh nhật tới (để prefill startDate)
  nextBirthdayDate: string; // yyyy-MM-dd theo lịch VN (prefill input date)
}

/**
 * Danh sách khách có sinh nhật trong `days` ngày tới. So theo NGÀY/THÁNG lịch VN
 * (bỏ qua năm sinh khi tính khoảng cách; xử lý wrap cuối năm). Tính tuổi từ DOB đầy
 * đủ (tuổi sắp bước sang). Khách thiếu ngày/tháng sinh (dob null) → loại khỏi tự động.
 * `today` truyền vào để test tất định.
 */
export async function upcomingBirthdays(days = 30, today = new Date()): Promise<UpcomingBirthday[]> {
  const customers = await prisma.customer.findMany({
    where: { isActive: true, dob: { not: null } },
    select: { id: true, code: true, fullName: true, phone: true, dob: true, assignedTo: true },
  });
  const t = vnClock(today);
  // Mốc "hôm nay" theo lịch VN, quy về instant UTC 00:00 VN của ngày đó.
  const baseVn = Date.UTC(t.year, t.month - 1, t.day) - 7 * 60 * 60_000;
  const base = new Date(baseVn);

  const out: UpcomingBirthday[] = [];
  for (const c of customers) {
    if (!c.dob) continue;
    const b = vnClock(new Date(c.dob)); // ngày/tháng sinh theo lịch VN
    const m = b.month - 1;
    const d = b.day;
    // Sinh nhật năm nay (theo lịch VN); nếu đã qua thì tính năm sau → xử lý wrap cuối năm.
    let nextY = t.year;
    let nextMs = Date.UTC(nextY, m, d) - 7 * 60 * 60_000;
    if (nextMs < base.getTime()) {
      nextY = t.year + 1;
      nextMs = Date.UTC(nextY, m, d) - 7 * 60 * 60_000;
    }
    const inDays = Math.round((nextMs - base.getTime()) / 86_400_000);
    if (inDays <= days) {
      const turningAge = b.year > 1900 ? nextY - b.year : null;
      const nextBirthdayDate = `${nextY}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({
        id: c.id, code: c.code, fullName: c.fullName, phone: c.phone, assignedTo: c.assignedTo ?? null,
        dob: new Date(c.dob).toISOString(), day: d, month: m + 1, turningAge, inDays,
        nextBirthday: new Date(nextMs).toISOString(), nextBirthdayDate,
      });
    }
  }
  out.sort((a, b) => a.inDays - b.inDays);
  return out;
}
