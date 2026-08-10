export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { issueCreateSchema } from "@/lib/validation";
import { createIssue } from "@/lib/outbound-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const rows = await prisma.goodsIssue.findMany({
    include: {
      warehouse: true,
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.OUTBOUND_WRITE);
  const input = issueCreateSchema.parse(await req.json());
  const result = await createIssue(input, session.userId);
  return created(result);
});
