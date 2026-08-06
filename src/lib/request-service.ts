// =============================================================================
// v1.5 — Dịch vụ Lớp Yêu cầu (5A-0):
//   Nháp → Chờ tiếp nhận → Đã tiếp nhận → Đang thực hiện → Chờ nghiệm thu → Hoàn tất
//   Nhánh: Trả lại bổ sung (dừng SLA) · Từ chối (kèm lý do) · Yêu cầu xem lại.
//   Đồng hồ SLA dừng khi Chờ bổ sung — cộng dồn, KHÔNG reset mốc gốc (C30).
//   Điểm chất lượng phục vụ kho 4 thành phần (tự tính, không cảm tính).
// =============================================================================
import { Prisma, type RequestType, type RequestPriority } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { REQUEST_TYPES, getCompletionConfig } from "./requests";
import { addWorkingDays, addWorkingHours } from "./sla";

async function nextRequestNumber(tx: Prisma.TransactionClient, type: RequestType): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;
  const count = await tx.request.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** SLA hoàn tất tính từ mốc `from` theo loại + ưu tiên. */
function computeCompletionDeadline(type: RequestType, priority: RequestPriority, from: Date): Date {
  if (priority === "P1") {
    // P1 gấp = trong ngày → 17:00 cùng ngày
    const d = new Date(from);
    d.setHours(17, 0, 0, 0);
    if (d.getTime() <= from.getTime()) return addWorkingHours(from, 4);
    return d;
  }
  const cfg = getCompletionConfig(type);
  if (cfg.days) return addWorkingDays(from, cfg.days);
  if (cfg.hours) return addWorkingHours(from, cfg.hours);
  return addWorkingDays(from, 2);
}

interface CreateInput {
  type: RequestType;
  priority?: RequestPriority;
  p1Reason?: string | null;
  neededBy?: string | null;
  content?: string | null;
  projectId?: string | null;
  partnerId?: string | null;
  isCommercialStock?: boolean;
  deliveryLocation?: string | null;
  relatedDocCode?: string | null;
  supportTicketId?: string | null;
  createdForDept?: string | null;
  lines?: { productId?: string | null; productText?: string | null; quantity: number; designatedSerial?: string | null; techNote?: string | null }[];
}

export async function createRequest(input: CreateInput, session: { userId: string; name: string }) {
  const def = REQUEST_TYPES[input.type];
  if (!def) throw new HttpError(422, "Loại yêu cầu không hợp lệ");
  const priority = input.priority ?? "P2";

  // C25 — P1 bắt buộc ghi lý do
  if (priority === "P1" && !input.p1Reason?.trim()) {
    throw new HttpError(422, "Yêu cầu gấp (P1) bắt buộc ghi lý do.");
  }
  if (def.needsPartner && !input.partnerId) {
    throw new HttpError(422, `${def.label} cần chọn NCC/khách hàng.`);
  }
  // YCN: dự án hoặc hàng thương mại (NT3/C2)
  if (input.type === "YCN" && !input.projectId && !input.isCommercialStock) {
    throw new HttpError(422, "Phải gắn dự án hoặc đánh dấu hàng tồn thương mại.");
  }
  if (def.needsLines && (!input.lines || input.lines.length === 0)) {
    throw new HttpError(422, `${def.label} cần ít nhất một dòng hàng.`);
  }

  // Lấy phòng ban người yêu cầu
  const requester = await prisma.user.findUnique({ where: { id: session.userId } });

  return prisma.$transaction(async (tx) => {
    const code = await nextRequestNumber(tx, input.type);
    const req = await tx.request.create({
      data: {
        code,
        type: input.type,
        status: "DRAFT",
        priority,
        p1Reason: priority === "P1" ? input.p1Reason : null,
        requesterId: session.userId,
        requesterDept: requester?.department ?? null,
        createdForDept: input.createdForDept ?? null,
        createdById: input.createdForDept ? session.userId : null,
        neededBy: input.neededBy ? new Date(input.neededBy) : null,
        content: input.content ?? null,
        projectId: input.projectId ?? null,
        partnerId: input.partnerId ?? null,
        isCommercialStock: input.isCommercialStock ?? false,
        deliveryLocation: input.deliveryLocation ?? null,
        relatedDocCode: input.relatedDocCode ?? null,
        supportTicketId: input.supportTicketId ?? null,
        lines: input.lines
          ? {
              create: input.lines.map((l) => ({
                productId: l.productId ?? null,
                productText: l.productText ?? null,
                quantity: l.quantity,
                designatedSerial: l.designatedSerial ?? null,
                techNote: l.techNote ?? null,
              })),
            }
          : undefined,
        events: { create: { toStatus: "DRAFT", userId: session.userId, reason: "Tạo yêu cầu" } },
      },
      include: { lines: true },
    });
    return req;
  });
}

/** Gửi yêu cầu: Nháp → Chờ tiếp nhận. Đồng hồ SLA bắt đầu chạy. */
export async function submitRequest(id: string, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "DRAFT") throw new HttpError(409, "Chỉ gửi được yêu cầu ở trạng thái Nháp");
  const now = new Date();
  const deadline = computeCompletionDeadline(req.type, req.priority, now);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { status: "PENDING_RECEIPT", slaDeadline: deadline },
    });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: "DRAFT", toStatus: "PENDING_RECEIPT", userId: session.userId, reason: "Gửi yêu cầu — SLA bắt đầu" },
    });
    return updated;
  });
}

/** Đếm số yêu cầu P1 đang mở giao cho một người trong hôm nay (C26). */
export async function countActiveP1Today(assigneeId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.request.count({
    where: {
      assigneeId,
      priority: "P1",
      status: { in: ["RECEIVED", "IN_PROGRESS"] },
      receivedAt: { gte: start },
    },
  });
}

/** Tiếp nhận + gán người phụ trách: Chờ tiếp nhận → Đã tiếp nhận. */
export async function receiveRequest(
  id: string,
  input: { assigneeId: string; conflictResolution?: string; conflictReason?: string },
  session: { userId: string }
) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "PENDING_RECEIPT") throw new HttpError(409, "Chỉ tiếp nhận yêu cầu ở trạng thái Chờ tiếp nhận");
  if (!input.assigneeId) throw new HttpError(422, "Bắt buộc gán người phụ trách.");

  // C26 — xung đột P1 cho cùng một người trong ngày
  if (req.priority === "P1") {
    const existing = await countActiveP1Today(input.assigneeId);
    if (existing >= 1 && !input.conflictResolution) {
      throw new HttpError(409, "Người này đã có yêu cầu P1 hôm nay — chọn hướng xử lý trước khi lưu.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { status: "RECEIVED", receivedById: session.userId, assigneeId: input.assigneeId, receivedAt: new Date() },
    });
    await tx.requestEvent.create({
      data: {
        requestId: id,
        fromStatus: "PENDING_RECEIPT",
        toStatus: "RECEIVED",
        userId: session.userId,
        reason: input.conflictResolution
          ? `Tiếp nhận + gán người phụ trách (xung đột P1: ${input.conflictResolution}${input.conflictReason ? " — " + input.conflictReason : ""})`
          : "Tiếp nhận + gán người phụ trách",
      },
    });
    return updated;
  });
}

/** Bắt đầu thực hiện (đã sinh phiếu): Đã tiếp nhận → Đang thực hiện. */
export async function startRequest(id: string, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "RECEIVED") throw new HttpError(409, "Chỉ chuyển sang Đang thực hiện từ Đã tiếp nhận");
  return transition(id, "IN_PROGRESS", session.userId, "Bắt đầu thực hiện");
}

/** Trả lại bổ sung: → Chờ bổ sung. Dừng đồng hồ SLA. */
export async function returnForSupplement(
  id: string,
  input: { fields?: string[]; note: string },
  session: { userId: string }
) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (!["PENDING_RECEIPT", "RECEIVED", "IN_PROGRESS"].includes(req.status)) {
    throw new HttpError(409, "Không thể trả lại bổ sung ở trạng thái hiện tại");
  }
  if (!input.note?.trim()) throw new HttpError(422, "Phải nêu rõ cần bổ sung gì.");
  const detail = [(input.fields ?? []).join(", "), input.note].filter(Boolean).join(" — ");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { status: "PENDING_SUPPLEMENT", supplementReason: detail, slaPausedAt: new Date() },
    });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: "PENDING_SUPPLEMENT", userId: session.userId, reason: `Trả lại bổ sung: ${detail}` },
    });
    return updated;
  });
}

/** Người gửi bổ sung xong gửi lại: Chờ bổ sung → (Đã tiếp nhận / Chờ tiếp nhận). SLA chạy tiếp. */
export async function resubmitSupplement(id: string, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "PENDING_SUPPLEMENT") throw new HttpError(409, "Chỉ gửi lại từ trạng thái Chờ bổ sung");

  // Cộng dồn thời gian tạm dừng, đẩy deadline đi đúng bằng khoảng dừng (không reset mốc gốc)
  let extraData: Prisma.RequestUpdateInput = {};
  if (req.slaPausedAt && req.slaDeadline) {
    const pausedMin = Math.round((Date.now() - req.slaPausedAt.getTime()) / 60000);
    extraData = {
      slaDeadline: new Date(req.slaDeadline.getTime() + pausedMin * 60000),
      slaPausedTotalMinutes: req.slaPausedTotalMinutes + pausedMin,
      slaPausedAt: null,
    };
  }
  const nextStatus = req.assigneeId ? "RECEIVED" : "PENDING_RECEIPT";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({ where: { id }, data: { status: nextStatus, ...extraData } });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: "PENDING_SUPPLEMENT", toStatus: nextStatus, userId: session.userId, reason: "Người gửi bổ sung xong — SLA chạy tiếp" },
    });
    return updated;
  });
}

/** Từ chối có lý do: → Từ chối. */
export async function rejectRequest(
  id: string,
  input: { reasonGroup: string; note: string },
  session: { userId: string }
) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (!["PENDING_RECEIPT", "RECEIVED", "IN_PROGRESS"].includes(req.status)) {
    throw new HttpError(409, "Không thể từ chối ở trạng thái hiện tại");
  }
  if (!input.reasonGroup || !input.note?.trim()) throw new HttpError(422, "Phải nêu rõ lý do từ chối.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { status: "REJECTED", rejectReasonGroup: input.reasonGroup, rejectReasonNote: input.note },
    });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: "REJECTED", userId: session.userId, reason: `Từ chối [${input.reasonGroup}]: ${input.note}` },
    });
    return updated;
  });
}

/** Người gửi bấm "Yêu cầu xem lại": Từ chối → Chờ tiếp nhận (cùng mã). */
export async function requestReview(id: string, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "REJECTED") throw new HttpError(409, "Chỉ yêu cầu xem lại khi đang bị Từ chối");
  return transition(id, "PENDING_RECEIPT", session.userId, "Người gửi yêu cầu xem lại — giữ nguyên mã & mốc gốc");
}

/** Kho báo xong: Đang thực hiện → Chờ nghiệm thu. */
export async function completeByWarehouse(id: string, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "IN_PROGRESS") throw new HttpError(409, "Chỉ báo xong từ trạng thái Đang thực hiện");
  return transition(id, "PENDING_ACCEPTANCE", session.userId, "Kho báo xong — chờ người yêu cầu nghiệm thu");
}

/** Người yêu cầu xác nhận Hoàn tất + chấm điểm (C28: chỉ người yêu cầu). */
export async function acceptRequest(
  id: string,
  input: { stars?: number; note?: string },
  session: { userId: string }
) {
  const req = await prisma.request.findUnique({ where: { id }, include: { events: true } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (req.status !== "PENDING_ACCEPTANCE") throw new HttpError(409, "Chỉ nghiệm thu yêu cầu ở trạng thái Chờ nghiệm thu");
  if (req.requesterId !== session.userId) throw new HttpError(403, "Chỉ người yêu cầu mới xác nhận hoàn tất.");

  const now = new Date();
  const scoreSla = req.slaDeadline ? now.getTime() <= req.slaDeadline.getTime() : true;
  // Không bị làm lại do lỗi kho: đếm số lần bị Từ chối rồi xem lại (lỗi kho phán đoán sai).
  const rejections = req.events.filter((e) => e.toStatus === "REJECTED").length;
  const scoreNoRedo = rejections === 0;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: {
        status: "DONE",
        closedAt: now,
        closedById: session.userId,
        scoreSla,
        scoreCorrect: true,
        scoreNoRedo,
        ratingStars: input.stars ?? null,
        ratingNote: input.note ?? null,
      },
    });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: "PENDING_ACCEPTANCE", toStatus: "DONE", userId: session.userId, reason: `Nghiệm thu hoàn tất${input.stars ? ` — ${input.stars}★` : ""}` },
    });
    return updated;
  });
}

/** Tự đóng khi quá hạn nghiệm thu 2 ngày làm việc (5A-0 / SLA). */
export async function autoCloseStaleAcceptance(id: string) {
  return transition(id, "DONE", null, "Tự đóng do người yêu cầu không phản hồi quá hạn nghiệm thu");
}

export async function cancelRequest(id: string, input: { reason?: string }, session: { userId: string }) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (["DONE", "CANCELLED"].includes(req.status)) throw new HttpError(409, "Yêu cầu đã đóng");
  // C29: nếu có phiếu đang picking -> chặn (sẽ nối khi tích hợp phiếu). Hiện chỉ hủy.
  return transition(id, "CANCELLED", session.userId, input.reason ? `Hủy: ${input.reason}` : "Hủy yêu cầu");
}

export async function addComment(
  id: string,
  input: { content: string; mentions?: string[] },
  session: { userId: string }
) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req) throw new HttpError(404, "Không tìm thấy yêu cầu");
  if (!input.content?.trim()) throw new HttpError(422, "Nội dung trao đổi trống");
  return prisma.requestComment.create({
    data: {
      requestId: id,
      userId: session.userId,
      content: input.content,
      mentions: input.mentions && input.mentions.length ? JSON.stringify(input.mentions) : null,
    },
  });
  // NOTE (mục 6): mỗi bình luận @nhắc tên sinh 1 bản soạn mail — nối ở phase mail.
}

// --- helper chung ---
async function transition(id: string, to: any, userId: string | null, reason: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.request.findUnique({ where: { id } });
    const updated = await tx.request.update({ where: { id }, data: { status: to } });
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: cur?.status ?? null, toStatus: to, userId, reason },
    });
    return updated;
  });
}
