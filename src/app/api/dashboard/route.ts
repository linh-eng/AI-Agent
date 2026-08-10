export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getDashboardStats } from "@/lib/inventory";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const [stats, recentReceipts, recentIssues] = await Promise.all([
    getDashboardStats(),
    prisma.goodsReceipt.findMany({
      where: { status: "POSTED" },
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }),
    prisma.goodsIssue.findMany({
      where: { status: "POSTED" },
      include: { _count: { select: { items: true } } },
      orderBy: { issuedAt: "desc" },
      take: 5,
    }),
  ]);
  return ok({ stats, recentReceipts, recentIssues });
});
