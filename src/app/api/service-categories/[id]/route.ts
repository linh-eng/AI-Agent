export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceCategoryUpdateSchema } from "@/lib/clinic-validation";

// Sửa nhóm dịch vụ (tên/mô tả/trạng thái). Không hard-delete.
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceCategoryUpdateSchema.parse(await req.json());
  const cur = await prisma.serviceCategory.findUnique({ where: { id: params.id } });
  if (!cur) return fail(404, "Không tìm thấy nhóm dịch vụ");
  const cat = await prisma.serviceCategory.update({ where: { id: params.id }, data: parsed });
  return ok(cat);
});
