export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { campaignCreateSchema } from "@/lib/ext-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.MARKETING_READ);
  const items = await prisma.marketingCampaign.findMany({
    include: { _count: { select: { leads: true, customers: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.MARKETING_WRITE);
  const parsed = campaignCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("CAMP", await prisma.marketingCampaign.count());
  const item = await prisma.marketingCampaign.create({ data: { ...parsed, code } });
  return created(item);
});
