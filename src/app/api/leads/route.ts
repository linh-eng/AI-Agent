export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leadCreateSchema } from "@/lib/ext-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.MARKETING_READ);
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const items = await prisma.lead.findMany({
    where: { ...(campaignId ? { campaignId } : {}), ...(status ? { status: status as any } : {}) },
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.MARKETING_WRITE);
  const parsed = leadCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("LEAD", await prisma.lead.count());
  const item = await prisma.lead.create({ data: { ...parsed, code } });
  return created(item);
});
