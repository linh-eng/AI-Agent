export const dynamic = "force-dynamic";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { loyaltyActionSchema } from "@/lib/clinic-validation";
import { earnPointsForPayment, adjustPoints, redeemPointsToPrepaid, topUpPrepaid, redeemPrepaid, refundPrepaid } from "@/lib/loyalty";

// POST — hành động tường minh (earn/adjustPoints/redeemPoints/topup/redeemPrepaid/refundPrepaid).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.LOYALTY_WRITE);
  const i = loyaltyActionSchema.parse(await req.json());
  switch (i.action) {
    case "earn":
      if (!i.paymentId) return fail(422, "Thiếu paymentId");
      return ok(await earnPointsForPayment(session, i.paymentId));
    case "adjustPoints":
      if (!i.customerId || i.points == null) return fail(422, "Thiếu customerId/points");
      return ok({ pointsBalance: await adjustPoints(session, i.customerId, i.points, i.note ?? "") });
    case "redeemPoints":
      if (!i.customerId || i.points == null) return fail(422, "Thiếu customerId/points");
      return ok(await redeemPointsToPrepaid(session, i.customerId, i.points));
    case "topup":
      if (!i.customerId || i.amount == null) return fail(422, "Thiếu customerId/amount");
      return ok({ prepaidBalance: await topUpPrepaid(session, i.customerId, i.amount, { method: i.method, note: i.note ?? undefined }) });
    case "redeemPrepaid":
      if (!i.customerId || i.amount == null) return fail(422, "Thiếu customerId/amount");
      return ok({ prepaidBalance: await redeemPrepaid(session, i.customerId, i.amount, { invoiceId: i.invoiceId ?? undefined, note: i.note ?? undefined }) });
    case "refundPrepaid":
      if (!i.customerId || i.amount == null) return fail(422, "Thiếu customerId/amount");
      return ok({ prepaidBalance: await refundPrepaid(session, i.customerId, i.amount, i.note ?? "") });
    default:
      return fail(422, "Hành động không hợp lệ");
  }
});
