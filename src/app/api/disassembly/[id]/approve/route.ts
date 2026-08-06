export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { approveDisassembly } from "@/lib/disassembly-service";

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  // Rã máy bắt buộc duyệt cấp quản lý/BGĐ
  const session = await requirePermission(PERMISSIONS.DISASSEMBLY_APPROVE);
  const order = await approveDisassembly(params.id, session.userId);
  return ok(order);
});
