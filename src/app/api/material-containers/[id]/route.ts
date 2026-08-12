export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Cập nhật container: mở nắp / đổi hạn / hủy (DISPOSED).
const schema = z.object({
  openedAt: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  dispose: z.boolean().optional(),
});

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = schema.parse(await req.json());
  const c = await prisma.materialContainer.findUnique({ where: { id: params.id } });
  if (!c) return fail(404, "Không tìm thấy lọ/lô");
  const updated = await prisma.materialContainer.update({
    where: { id: params.id },
    data: {
      ...(d.openedAt !== undefined ? { openedAt: d.openedAt ? new Date(d.openedAt) : null } : {}),
      ...(d.expiryDate !== undefined ? { expiryDate: d.expiryDate ? new Date(d.expiryDate) : null } : {}),
      ...(d.dispose ? { status: "DISPOSED" } : {}),
    },
  });
  return ok(updated);
});
