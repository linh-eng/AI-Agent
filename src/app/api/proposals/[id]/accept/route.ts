export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { proposalAcceptSchema } from "@/lib/ext-validation";
import { proposalOptionTotal, auditLog } from "@/lib/clinic";

// Khách chốt 1 phương án -> lưu SNAPSHOT bất biến (mục 5). Catalog/giá đổi sau
// KHÔNG ảnh hưởng báo giá đã chốt.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PROPOSAL_ACCEPT);
  const parsed = proposalAcceptSchema.parse(await req.json());

  const proposal = await prisma.treatmentProposal.findUnique({
    where: { id: params.id },
    include: { options: { include: { items: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!proposal) return fail(404, "Không tìm thấy báo giá");
  if (proposal.status === "ACCEPTED") return fail(409, "Báo giá đã được chốt trước đó");

  const option = proposal.options.find((o) => o.id === parsed.optionId);
  if (!option) return fail(400, "Phương án không thuộc báo giá này");

  const computedTotal = proposalOptionTotal(option.items, option.discount);
  const agreedPrice =
    parsed.agreedPrice ?? computedTotal - Number(parsed.appliedDiscount ?? 0);

  // Đông cứng option đã chọn (item + giá) — không phụ thuộc bản gốc về sau.
  const snapshot = {
    optionId: option.id,
    kind: option.kind,
    name: option.name,
    sessions: option.sessions,
    estimatedDurationDays: option.estimatedDurationDays,
    discount: option.discount,
    computedTotal,
    items: option.items.map((it) => ({
      itemType: it.itemType,
      refId: it.refId,
      name: it.name,
      quantity: it.quantity,
      sessions: it.sessions,
      unitPrice: it.unitPrice,
      isHomeCare: it.isHomeCare,
    })),
    acceptedAt: new Date().toISOString(),
  };

  const updated = await prisma.treatmentProposal.update({
    where: { id: params.id },
    data: {
      status: "ACCEPTED",
      acceptedOptionId: option.id,
      acceptedAt: new Date(),
      acceptedBy: parsed.acceptedBy ?? session.name,
      agreedPrice,
      appliedDiscount: parsed.appliedDiscount ?? null,
      acceptedSnapshot: snapshot as any,
    },
  });

  await auditLog({
    userId: session.userId,
    action: "PROPOSAL_ACCEPTED",
    entityType: "TreatmentProposal",
    entityId: updated.id,
    changes: { optionId: option.id, agreedPrice },
  });
  return ok(updated);
});
