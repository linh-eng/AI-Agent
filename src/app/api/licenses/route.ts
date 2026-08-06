export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const url = new URL(req.url);
  const onlyFree = url.searchParams.get("free") === "1";
  const licenses = await prisma.license.findMany({
    where: onlyFree ? { activatedSerialId: null } : undefined,
    orderBy: { createdAt: "desc" },
    include: { product: { select: { sku: true, name: true } } },
  });
  return ok(licenses);
});
