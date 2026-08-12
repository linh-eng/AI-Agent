export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";

// Khách xác nhận đã đọc hướng dẫn — chỉ hướng dẫn của chính mình.
export const POST = handle(async (_req, { params }) => {
  const { customerId } = await requirePortal();
  const inst = await prisma.careInstructionInstance.findUnique({
    where: { id: params.id },
    select: { id: true, customerId: true },
  });
  if (!inst || inst.customerId !== customerId) return fail(404, "Không tìm thấy hướng dẫn");
  await prisma.careInstructionInstance.update({ where: { id: params.id }, data: { acknowledgedAt: new Date() } });
  return ok({ acknowledged: true });
});
