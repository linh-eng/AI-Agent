// =============================================================================
// CSKH follow-up (mục 31–35) — áp QUY TRÌNH follow-up cho khách → sinh Task theo
// lịch (mốc + số ngày), kèm kênh/kịch bản/checklist; ghi nhật ký CSKH. Và tính
// danh sách SINH NHẬT sắp tới (chương trình CSKH, tách khỏi Marketing).
// =============================================================================
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";

/** Sinh mã quy trình CSKH kế tiếp: CS-000123. */
export async function nextTemplateCode(): Promise<string> {
  return sequentialCode("CS", await prisma.followUpTemplate.count());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Áp một quy trình follow-up cho khách hàng: mỗi bước → 1 Task với hạn =
 * anchor + dayOffset, gắn kênh/kịch bản/checklist. Ghi 1 CrmActivity tổng hợp.
 * Trả về danh sách task đã tạo.
 */
export async function applyFollowUpTemplate(params: {
  templateId: string;
  customerId: string;
  anchorDate?: Date;
  assignee?: string | null;
  createdBy?: string | null;
}) {
  const template = await prisma.followUpTemplate.findUnique({
    where: { id: params.templateId },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  if (!template) throw Object.assign(new Error("Không tìm thấy quy trình CSKH"), { status: 404 });
  if (!template.isActive) throw Object.assign(new Error("Quy trình đã ngưng sử dụng"), { status: 409 });

  const customer = await prisma.customer.findUnique({ where: { id: params.customerId }, select: { id: true, fullName: true } });
  if (!customer) throw Object.assign(new Error("Không tìm thấy khách hàng"), { status: 404 });

  const anchor = params.anchorDate ?? new Date();

  const tasks = await prisma.$transaction(
    template.steps.map((step) =>
      prisma.task.create({
        data: {
          title: step.title,
          description: step.script ?? null,
          customerId: params.customerId,
          assignee: params.assignee ?? null,
          dueDate: addDays(anchor, step.dayOffset),
          channel: step.channel,
          checklist: step.checklist.length ? (step.checklist as any) : undefined,
          followUpTemplateId: template.id,
          priority: "NORMAL",
          status: "OPEN",
          createdBy: params.createdBy ?? null,
        },
      })
    )
  );

  // Ghi nhật ký CSKH (append-only) để hiện trong timeline khách.
  await prisma.crmActivity.create({
    data: {
      customerId: params.customerId,
      type: "FOLLOW_UP",
      content: `Áp quy trình CSKH "${template.name}" (${tasks.length} bước follow-up).`,
      performedBy: params.createdBy ?? null,
      followUpDate: tasks[0]?.dueDate ?? null,
      followUpOwner: params.assignee ?? null,
    },
  });

  return tasks;
}

export interface UpcomingBirthday {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  dob: string; // ISO
  day: number;
  month: number;
  turningAge: number | null;
  inDays: number; // số ngày tới sinh nhật (0 = hôm nay)
}

/**
 * Danh sách khách có sinh nhật trong `days` ngày tới (so theo ngày/tháng, bỏ qua năm).
 * `today` truyền vào để test tất định.
 */
export async function upcomingBirthdays(days = 30, today = new Date()): Promise<UpcomingBirthday[]> {
  const customers = await prisma.customer.findMany({
    where: { isActive: true, dob: { not: null } },
    select: { id: true, code: true, fullName: true, phone: true, dob: true },
  });
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  const out: UpcomingBirthday[] = [];
  for (const c of customers) {
    if (!c.dob) continue;
    const dob = new Date(c.dob);
    const m = dob.getMonth();
    const d = dob.getDate();
    // Sinh nhật năm nay; nếu đã qua thì tính năm sau.
    let next = new Date(base.getFullYear(), m, d);
    next.setHours(0, 0, 0, 0);
    if (next < base) next = new Date(base.getFullYear() + 1, m, d);
    const inDays = Math.round((next.getTime() - base.getTime()) / 86_400_000);
    if (inDays <= days) {
      const turningAge = dob.getFullYear() > 1900 ? next.getFullYear() - dob.getFullYear() : null;
      out.push({
        id: c.id, code: c.code, fullName: c.fullName, phone: c.phone,
        dob: dob.toISOString(), day: d, month: m + 1, turningAge, inDays,
      });
    }
  }
  out.sort((a, b) => a.inDays - b.inDays);
  return out;
}
