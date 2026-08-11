export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { campaignUpdateSchema } from "@/lib/ext-validation";
import { campaignMetrics } from "@/lib/marketing";
import { canSeeFinance, maskFinance } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.MARKETING_READ);
  const session = await getSession();
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: params.id },
    include: {
      leads: { orderBy: { createdAt: "desc" }, take: 100 },
      customers: { select: { id: true, code: true, fullName: true }, take: 100 },
    },
  });
  if (!campaign) return fail(404, "Không tìm thấy chiến dịch");
  const metrics = await campaignMetrics(campaign.id, Number(campaign.cost ?? 0));
  const canSee = canSeeFinance(session);
  return ok({
    ...maskFinance(campaign, canSee, ["cost", "budget"]),
    metrics: canSee ? metrics : { ...metrics, cost: 0, costPerLead: null, costPerCustomer: null, roi: null },
    canSeeFinance: canSee,
  });
});

export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.MARKETING_WRITE);
  const parsed = campaignUpdateSchema.parse(await req.json());
  const item = await prisma.marketingCampaign.update({ where: { id: params.id }, data: parsed });
  return ok(item);
});
