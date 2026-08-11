export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leadConvertSchema } from "@/lib/ext-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";

// Chuyển lead -> khách hàng (first-touch attribution: gán campaignId/source).
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.MARKETING_WRITE);
  const parsed = leadConvertSchema.parse(await req.json().catch(() => ({})));

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return fail(404, "Không tìm thấy lead");
  if (lead.convertedCustomerId) return fail(409, "Lead đã được chuyển đổi");

  let customerId = parsed.customerId ?? null;
  if (!customerId) {
    const code = sequentialCode("KH", await prisma.customer.count());
    const customer = await prisma.customer.create({
      data: {
        code,
        fullName: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        campaignId: lead.campaignId,
      },
    });
    customerId = customer.id;
  } else {
    // gắn attribution vào khách có sẵn nếu chưa có
    await prisma.customer.update({
      where: { id: customerId },
      data: { campaignId: lead.campaignId ?? undefined, source: lead.source ?? undefined },
    });
  }

  const updated = await prisma.lead.update({
    where: { id: params.id },
    data: { status: "WON", convertedCustomerId: customerId },
  });
  await auditLog({ userId: session.userId, action: "LEAD_CONVERTED", entityType: "Lead", entityId: lead.id, changes: { customerId } });
  return ok({ lead: updated, customerId });
});
