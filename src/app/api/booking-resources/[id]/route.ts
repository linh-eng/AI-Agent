export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// Sửa / bật-tắt hoạt động của tài nguyên (không hard-delete để giữ lịch sử booking cũ).
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const d = patchSchema.parse(await req.json());
  const cur = await prisma.bookingResource.findUnique({ where: { id: params.id } });
  if (!cur) return fail(404, "Không tìm thấy tài nguyên");
  const item = await prisma.bookingResource.update({ where: { id: params.id }, data: d });
  return ok(item);
});
