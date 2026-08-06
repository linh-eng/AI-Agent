export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { requestCreateSchema } from "@/lib/validation";
import { createRequest } from "@/lib/request-service";

export const GET = handle(async (req) => {
  await requireAuth();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine");
  const session = await requireAuth();

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (mine === "1") where.requesterId = session.userId;
  if (mine === "assigned") where.assigneeId = session.userId;

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: { select: { lines: true, comments: true } },
    },
  });
  return ok(requests);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.REQUEST_WRITE);
  const input = requestCreateSchema.parse(await req.json());
  const request = await createRequest(input, session);
  return created(request);
});
