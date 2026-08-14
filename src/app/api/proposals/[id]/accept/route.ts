export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { proposalAcceptSchema } from "@/lib/ext-validation";
import { proposalOptionTotal, auditLog } from "@/lib/clinic";
import { proposalOptionFloorTotal } from "@/lib/price-floor";
import { PERMISSIONS as P } from "@/lib/rbac";

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

  // --- Chốt giá KHÁC giá phương án gốc: yêu cầu lý do điều chỉnh (mục 15) ---
  const priceAdjusted = Math.abs(agreedPrice - computedTotal) > 1e-6;
  if (priceAdjusted && !parsed.priceAdjustReason)
    return fail(422, "Giá chốt khác giá phương án — cần nhập lý do điều chỉnh giá");

  // --- Chặn/duyệt bán DƯỚI giá sàn (mục 26) ---
  const floor = await proposalOptionFloorTotal(
    option.items.map((it) => ({ itemType: it.itemType, refId: it.refId, quantity: it.quantity, sessions: it.sessions })),
    agreedPrice
  );
  if (floor.below) {
    const canOverride = session.permissions.includes(P.PRICEFLOOR_OVERRIDE);
    if (!parsed.allowBelowFloor)
      return fail(409, "Giá chốt thấp hơn tổng giá sàn của phương án", {
        priceFloor: { floorTotal: floor.floorTotal, agreedPrice, shortfall: floor.shortfall, canOverride },
      });
    if (!canOverride) return fail(403, "Cần quyền duyệt bán dưới giá sàn (pricefloor.override)");
    if (!parsed.priceAdjustReason) return fail(422, "Bán dưới giá sàn — cần nhập lý do");
  }

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
      priceAdjustReason: parsed.priceAdjustReason ?? null,
      acceptedSnapshot: snapshot as any,
    },
  });

  await auditLog({
    userId: session.userId,
    action: "PROPOSAL_ACCEPTED",
    entityType: "TreatmentProposal",
    entityId: updated.id,
    changes: {
      optionId: option.id,
      agreedPrice,
      priceAdjusted,
      belowFloor: floor.below,
      priceAdjustReason: parsed.priceAdjustReason ?? null,
    },
  });
  return ok(updated);
});
