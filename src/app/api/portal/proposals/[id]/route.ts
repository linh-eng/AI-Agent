export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";

// Xem 1 báo giá — CHỈ của chính khách (ownership check). KHÔNG lộ giá vốn / ghi chú
// nội bộ. Trả 404 nếu không thuộc khách để không lộ sự tồn tại (chống IDOR/enumeration).
export const GET = handle(async (_req, { params }) => {
  const { customerId } = await requirePortal();
  const proposal = await prisma.treatmentProposal.findUnique({
    where: { id: params.id },
    select: {
      id: true, code: true, title: true, status: true, customerId: true,
      agreedPrice: true, acceptedOptionId: true, acceptedAt: true, createdAt: true,
      options: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true, kind: true, name: true, sessions: true, estimatedDurationDays: true,
          discount: true, totalPrice: true,
          items: {
            orderBy: { orderIndex: "asc" },
            // KHÔNG select unitCost (nội bộ)
            select: { id: true, itemType: true, name: true, quantity: true, sessions: true, unitPrice: true, isHomeCare: true },
          },
        },
      },
    },
  });
  if (!proposal || proposal.customerId !== customerId) return fail(404, "Không tìm thấy báo giá");
  const { customerId: _omit, ...safe } = proposal;
  return ok(safe);
});
