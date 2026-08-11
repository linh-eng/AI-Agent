export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { recommendationUpdateSchema } from "@/lib/library-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.RECOMMEND_WRITE);
  const parsed = recommendationUpdateSchema.parse(await req.json());
  const rec = await prisma.productRecommendation.update({ where: { id: params.id }, data: parsed });
  return ok(rec);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.RECOMMEND_WRITE);
  await prisma.productRecommendation.delete({ where: { id: params.id } });
  return ok({ id: params.id, deleted: true });
});
