export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { protocolRecommendedCreateSchema } from "@/lib/clinic-validation";
import { createProtocolRecommendedVersion, maskProtocolRecommended } from "@/lib/protocol-pricing";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const canSee = canSeeFinance(await getSession());
  const { searchParams } = new URL(req.url);
  const protocolId = searchParams.get("protocolId");
  if (!protocolId) return fail(400, "Thiếu protocolId");
  const versions = await prisma.protocolRecommendedPriceVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } });
  return ok(versions.map((v) => maskProtocolRecommended(v as any, canSee)));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const raw = await req.json();
  const input = protocolRecommendedCreateSchema.parse(raw);
  const protocolId = raw?.protocolId as string;
  if (!protocolId) return fail(400, "Thiếu protocolId");
  const version = await createProtocolRecommendedVersion({ ...input, protocolId, createdBy: session.email });
  await auditLog({ userId: session.userId, action: "PROTOCOL_RECOMMENDED_CREATED", entityType: "ProtocolRecommendedPriceVersion", entityId: version.id, changes: { protocolId, version: version.version, recommendedPrice: Number(version.calculatedRecommendedPrice) } });
  return created(maskProtocolRecommended(version as any, canSee));
});
