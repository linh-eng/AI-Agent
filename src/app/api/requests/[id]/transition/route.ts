export const dynamic = "force-dynamic";

import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { hasPermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  requestReceiveSchema,
  requestReturnSchema,
  requestRejectSchema,
  requestAcceptSchema,
} from "@/lib/validation";
import {
  submitRequest,
  receiveRequest,
  startRequest,
  returnForSupplement,
  resubmitSupplement,
  rejectRequest,
  requestReview,
  completeByWarehouse,
  acceptRequest,
  cancelRequest,
} from "@/lib/request-service";
import { prisma } from "@/lib/prisma";

// Hành động của KHO (tiếp nhận/thực hiện) cần quyền request.receive
const WAREHOUSE_ACTIONS = new Set(["receive", "start", "return", "reject", "complete"]);
// Hành động của NGƯỜI YÊU CẦU
const REQUESTER_ACTIONS = new Set(["submit", "resubmit", "review", "accept", "cancel"]);

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requireAuth();
  const body = await req.json().catch(() => ({}));
  const action: string = body.action;
  if (!action) return fail(422, "Thiếu action");

  // Phân quyền theo nhóm hành động
  if (WAREHOUSE_ACTIONS.has(action) && !hasPermission(session, PERMISSIONS.REQUEST_RECEIVE)) {
    return fail(403, "Không có quyền tiếp nhận/xử lý yêu cầu (kho)");
  }
  if (REQUESTER_ACTIONS.has(action)) {
    const r = await prisma.request.findUnique({ where: { id: params.id }, select: { requesterId: true } });
    if (!r) return fail(404, "Không tìm thấy yêu cầu");
    const isOwner = r.requesterId === session.userId;
    const canReceive = hasPermission(session, PERMISSIONS.REQUEST_RECEIVE);
    // người yêu cầu, hoặc kho (cho hủy) mới thao tác
    if (!isOwner && !(action === "cancel" && canReceive)) {
      return fail(403, "Chỉ người yêu cầu mới thao tác được bước này");
    }
  }

  let result;
  switch (action) {
    case "submit":
      result = await submitRequest(params.id, session);
      break;
    case "receive":
      result = await receiveRequest(params.id, requestReceiveSchema.parse(body), session);
      break;
    case "start":
      result = await startRequest(params.id, session);
      break;
    case "return":
      result = await returnForSupplement(params.id, requestReturnSchema.parse(body), session);
      break;
    case "resubmit":
      result = await resubmitSupplement(params.id, session);
      break;
    case "reject":
      result = await rejectRequest(params.id, requestRejectSchema.parse(body), session);
      break;
    case "review":
      result = await requestReview(params.id, session);
      break;
    case "complete":
      result = await completeByWarehouse(params.id, session);
      break;
    case "accept":
      result = await acceptRequest(params.id, requestAcceptSchema.parse(body), session);
      break;
    case "cancel":
      result = await cancelRequest(params.id, { reason: body.reason }, session);
      break;
    default:
      return fail(422, `Action không hợp lệ: ${action}`);
  }
  return ok(result);
});
