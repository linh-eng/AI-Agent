export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { careInstanceUpdateSchema } from "@/lib/ext-validation";

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.CARE_WRITE);
  const parsed = careInstanceUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.content !== undefined) data.content = parsed.content;
  if (parsed.deliveredVia !== undefined) data.deliveredVia = parsed.deliveredVia;
  if (parsed.markDelivered) data.deliveredAt = new Date();
  const item = await prisma.careInstructionInstance.update({ where: { id: params.id }, data });
  return ok(item);
});
