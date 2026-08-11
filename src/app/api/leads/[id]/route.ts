export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leadUpdateSchema } from "@/lib/ext-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.MARKETING_WRITE);
  const parsed = leadUpdateSchema.parse(await req.json());
  const item = await prisma.lead.update({ where: { id: params.id }, data: parsed });
  return ok(item);
});
