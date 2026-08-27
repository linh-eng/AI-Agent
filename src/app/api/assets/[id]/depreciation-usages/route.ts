export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { depreciationUsageSchema } from "@/lib/validation";

// Ghi nhận sản lượng cho khấu hao theo sản lượng — ADMIN/MANAGER (asset.manage).
export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = depreciationUsageSchema.parse(await req.json());
  const row = await prisma.depreciationUsage.create({
    data: {
      assetId: ctx.params.id,
      usageDate: new Date(input.usageDate),
      units: input.units,
      note: input.note,
      createdById: session.userId,
    },
  });
  return created(row);
});
