export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog, canSeeFinance } from "@/lib/clinic";
import { protocolCostingCreateSchema } from "@/lib/clinic-validation";
import { createProtocolCostingVersion, maskProtocolCosting } from "@/lib/protocol-pricing";

// GET /api/protocol-costings?protocolId= → danh sách version giá vốn gói. Cost mask theo finance.read.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICEFLOOR_READ);
  const canSee = canSeeFinance(await getSession());
  const { searchParams } = new URL(req.url);
  const protocolId = searchParams.get("protocolId");
  if (!protocolId) return fail(400, "Thiếu protocolId");
  const versions = await prisma.protocolCostingVersion.findMany({ where: { protocolId }, orderBy: { version: "desc" } });
  return ok(versions.map((v) => maskProtocolCosting(v as any, canSee)));
});

// POST /api/protocol-costings → tạo DRAFT (tính từ ServiceCostingVersion PUBLISHED của Service thành phần).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const canSee = canSeeFinance(session);
  const input = protocolCostingCreateSchema.parse(await req.json());
  const { version, warnings, components } = await createProtocolCostingVersion({ ...input, createdBy: session.email });
  await auditLog({ userId: session.userId, action: "PROTOCOL_COSTING_CREATED", entityType: "ProtocolCostingVersion", entityId: version.id, changes: { protocolId: version.protocolId, version: version.version, totalEstimatedCost: version.totalEstimatedCost } });
  return created({ ...maskProtocolCosting(version as any, canSee), warnings, components: canSee ? components : null });
});
