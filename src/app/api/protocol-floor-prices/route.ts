export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { protocolFloorCreateSchema } from "@/lib/clinic-validation";
import { createProtocolFloorVersion } from "@/lib/protocol-pricing";

// GET /api/protocol-floor-prices?protocolId= → danh sách version giá sàn gói.
// floorPrice là guardrail (hiển thị); minMarginPercent/costSnapshot mask theo finance.read.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const canSee = canSeeFinance(await getSession());
  const { searchParams } = new URL(req.url);
  const protocolId = searchParams.get("protocolId");
  if (!protocolId) return fail(400, "Thiếu protocolId");
  const versions = await prisma.protocolFloorPriceVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } });
  return ok(versions.map((v) => ({
    id: v.id, protocolId: v.protocolId, protocolCostingVersionId: v.protocolCostingVersionId, version: v.version, status: v.status,
    floorPrice: Number(v.floorPrice), roundingUnit: v.roundingUnit,
    minMarginPercent: canSee ? Number(v.minMarginPercent) : null, costSnapshot: canSee ? Number(v.costSnapshot) : null,
    note: v.note, createdBy: v.createdBy, createdAt: v.createdAt, publishedAt: v.publishedAt, publishedBy: v.publishedBy,
  })));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const raw = await req.json();
  const input = protocolFloorCreateSchema.parse(raw);
  const protocolId = raw?.protocolId as string;
  if (!protocolId) return fail(400, "Thiếu protocolId");
  const version = await createProtocolFloorVersion({ ...input, protocolId, createdBy: session.email });
  await auditLog({ userId: session.userId, action: "PROTOCOL_FLOOR_CREATED", entityType: "ProtocolFloorPriceVersion", entityId: version.id, changes: { protocolId, version: version.version, floorPrice: Number(version.floorPrice), protocolCostingVersionId: input.protocolCostingVersionId } });
  return created({ id: version.id, version: version.version, status: version.status, floorPrice: Number(version.floorPrice) });
});
