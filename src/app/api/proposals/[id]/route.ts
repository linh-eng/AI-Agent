export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { proposalUpdateSchema } from "@/lib/ext-validation";
import { proposalOptionTotal, canSeeFinance, auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PROPOSAL_READ);
  const session = await getSession();
  const proposal = await prisma.treatmentProposal.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { code: true, fullName: true } },
      plan: { select: { code: true, name: true } },
      options: {
        include: { items: { orderBy: { orderIndex: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!proposal) return fail(404, "Không tìm thấy báo giá");

  const canSee = canSeeFinance(session);
  // Che dữ liệu nội bộ (giá vốn/margin/ghi chú nội bộ) khi không có finance.read.
  const masked = {
    ...proposal,
    note: canSee ? proposal.note : null,
    options: proposal.options.map((o) => ({
      ...o,
      items: o.items.map((it) => ({ ...it, unitCost: canSee ? it.unitCost : null })),
    })),
    canSeeFinance: canSee,
  };
  return ok(masked);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PROPOSAL_WRITE);
  const parsed = proposalUpdateSchema.parse(await req.json());
  const current = await prisma.treatmentProposal.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy báo giá");

  // Đã chốt -> khóa lịch sử: không cho sửa phương án/hạng mục.
  if (current.status === "ACCEPTED" && parsed.options) {
    return fail(409, "Báo giá đã được khách chốt — không thể sửa phương án (giữ snapshot lịch sử).");
  }

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.note !== undefined) data.note = parsed.note;
  if (parsed.status !== undefined) data.status = parsed.status;

  // Thay thế toàn bộ options nếu gửi (chưa chốt)
  if (parsed.options) {
    await prisma.treatmentProposalOption.deleteMany({ where: { proposalId: params.id } });
    data.options = {
      create: parsed.options.map((o, oi) => ({
        kind: o.kind,
        name: o.name,
        orderIndex: o.orderIndex ?? oi,
        sessions: o.sessions ?? null,
        estimatedDurationDays: o.estimatedDurationDays ?? null,
        discount: o.discount ?? null,
        note: o.note ?? null,
        totalPrice: proposalOptionTotal(o.items, o.discount),
        items: {
          create: o.items.map((it, ii) => ({
            itemType: it.itemType,
            refId: it.refId ?? null,
            name: it.name,
            quantity: it.quantity,
            sessions: it.sessions ?? null,
            unitPrice: it.unitPrice ?? null,
            unitCost: it.unitCost ?? null,
            isHomeCare: it.isHomeCare,
            note: it.note ?? null,
            orderIndex: it.orderIndex ?? ii,
          })),
        },
      })),
    };
  }

  const proposal = await prisma.treatmentProposal.update({
    where: { id: params.id },
    data,
    include: { options: { include: { items: true } } },
  });
  await auditLog({
    userId: session.userId,
    action: "UPDATE",
    entityType: "TreatmentProposal",
    entityId: proposal.id,
    changes: { status: proposal.status },
  });
  return ok(proposal);
});
