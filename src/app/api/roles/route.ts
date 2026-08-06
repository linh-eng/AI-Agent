export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const roles = await prisma.role.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return ok(roles);
});
