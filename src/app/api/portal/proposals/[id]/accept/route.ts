export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";
import { proposalOptionTotal } from "@/lib/clinic";

// Khách TỰ chốt phương án qua cổng — chỉ báo giá của chính mình, đang ở trạng thái SENT.
export const POST = handle(async (req, { params }) => {
  const { customerId } = await requirePortal();
  const body = await req.json().catch(() => ({}));
  const optionId = String(body.optionId ?? "");
  if (!optionId) return fail(400, "Thiếu optionId");

  const proposal = await prisma.treatmentProposal.findUnique({
    where: { id: params.id },
    include: { options: { include: { items: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!proposal || proposal.customerId !== customerId) return fail(404, "Không tìm thấy báo giá");
  if (proposal.status !== "SENT") return fail(409, "Báo giá không ở trạng thái chờ khách chốt");
  const option = proposal.options.find((o) => o.id === optionId);
  if (!option) return fail(400, "Phương án không thuộc báo giá này");

  const computedTotal = proposalOptionTotal(option.items, option.discount);
  const snapshot = {
    optionId: option.id, kind: option.kind, name: option.name, sessions: option.sessions,
    estimatedDurationDays: option.estimatedDurationDays, discount: option.discount, computedTotal,
    items: option.items.map((it) => ({ itemType: it.itemType, name: it.name, quantity: it.quantity, sessions: it.sessions, unitPrice: it.unitPrice, isHomeCare: it.isHomeCare })),
    acceptedAt: new Date().toISOString(),
    acceptedVia: "PORTAL",
  };

  await prisma.treatmentProposal.update({
    where: { id: proposal.id },
    data: {
      status: "ACCEPTED",
      acceptedOptionId: option.id,
      acceptedAt: new Date(),
      acceptedBy: "Khách hàng (Portal)",
      agreedPrice: computedTotal,
      acceptedSnapshot: snapshot as any,
    },
  });
  // Ghi audit (không userId vì là khách, ghi qua entity)
  await prisma.auditLog.create({
    data: { action: "PROPOSAL_ACCEPTED_PORTAL", entityType: "TreatmentProposal", entityId: proposal.id, changes: { optionId, customerId } },
  });
  return ok({ status: "ACCEPTED", agreedPrice: computedTotal });
});
