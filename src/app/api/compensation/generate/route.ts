export const dynamic = "force-dynamic";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { generateTreatmentIncentivesForSession, generateSalesCommissionForPayment, generateSalesCommissionForDeposit, generateKpiBonusesForPeriod } from "@/lib/compensation";

// POST — sinh event thu nhập (hành động tường minh, không tự động ẩn).
// body: { type: "incentive"|"commission"|"kpi", sessionId?/paymentId?/depositId?/periodId? }
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.COMPENSATION_POLICY_WRITE);
  const body = await req.json();
  if (body.type === "incentive") { if (!body.sessionId) return fail(422, "Thiếu sessionId"); return ok(await generateTreatmentIncentivesForSession(session, body.sessionId)); }
  if (body.type === "commission") {
    if (body.paymentId) return ok(await generateSalesCommissionForPayment(session, body.paymentId));
    if (body.depositId) return ok(await generateSalesCommissionForDeposit(session, body.depositId));
    return fail(422, "Thiếu paymentId/depositId");
  }
  if (body.type === "kpi") { if (!body.periodId) return fail(422, "Thiếu periodId"); return ok(await generateKpiBonusesForPeriod(session, body.periodId)); }
  return fail(422, "type không hợp lệ");
});
