export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { partnerUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PARTNER_READ);
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: params.id } });
  return ok(partner);
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.PARTNER_WRITE);
  const parsed = partnerUpdateSchema.parse(await req.json());
  const data = "email" in parsed ? { ...parsed, email: parsed.email ? parsed.email : null } : parsed;
  const partner = await prisma.partner.update({ where: { id: params.id }, data });
  return ok(partner);
});