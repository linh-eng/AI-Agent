export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { floorVersionStatusSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { transitionFloorVersion } from "@/lib/price-floor-service";

// Chuyển trạng thái version: submit / approve / activate / cancel.
// submit cần pricefloor.write; approve|activate cần pricefloor.approve (enforce trong service).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const { action, effectiveFrom, effectiveTo, reason } = floorVersionStatusSchema.parse(await req.json());
  const canApprove = session.permissions.includes(PERMISSIONS.PRICEFLOOR_APPROVE);

  // PH2 — trước khi activate, ghi nhận version ACTIVE trước đó (sẽ bị SUPERSEDED/EXPIRED).
  let prevActive: { id: string; version: number } | null = null;
  if (action === "activate") {
    const cur = await prisma.servicePriceFloorVersion.findUnique({ where: { id: params.id }, select: { serviceId: true } });
    if (cur) {
      const prev = await prisma.servicePriceFloorVersion.findFirst({ where: { serviceId: cur.serviceId, status: "ACTIVE", id: { not: params.id } }, select: { id: true, version: true } });
      prevActive = prev ?? null;
    }
  }

  const version = await transitionFloorVersion(params.id, action, { effectiveFrom, effectiveTo, reason, actor: session.name, canApprove });
  await auditLog({
    userId: session.userId,
    action: action === "activate" ? "PRICE_FLOOR_VERSION_ACTIVATE" : action === "approve" ? "PRICE_FLOOR_VERSION_APPROVE" : action === "cancel" ? "PRICE_FLOOR_VERSION_CANCEL" : "PRICE_FLOOR_VERSION_SUBMIT",
    entityType: "ServicePriceFloorVersion", entityId: version.id,
    changes: { version: version.version, status: version.status, reason: reason ?? null },
  });
  // PH2 — audit rõ ràng: phát hành (activate) + thay thế version cũ.
  if (action === "activate") {
    await auditLog({ userId: session.userId, action: "PRICE_FLOOR_PUBLISHED", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { version: version.version, floorPrice: Number(version.floorPrice), effectiveFrom: version.effectiveFrom } });
    if (prevActive)
      await auditLog({ userId: session.userId, action: "PRICE_FLOOR_SUPERSEDED", entityType: "ServicePriceFloorVersion", entityId: prevActive.id, changes: { supersededByVersion: version.version } });
  }
  return ok(version);
});
