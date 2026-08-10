export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceUsageSchema } from "@/lib/validation";
import { recordServiceUsage } from "@/lib/service-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.SERVICE_READ);
  const rows = await prisma.serviceUsage.findMany({
    include: {
      service: { select: { name: true, code: true } },
      warehouse: { select: { name: true } },
      performedBy: { select: { name: true } },
    },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_USE);
  const input = serviceUsageSchema.parse(await req.json());
  const result = await recordServiceUsage(input, session.userId);
  return created(result);
});
