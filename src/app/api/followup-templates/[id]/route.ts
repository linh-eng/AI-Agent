export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { followUpTemplateUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const template = await prisma.followUpTemplate.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  if (!template) return fail(404, "Không tìm thấy quy trình CSKH");
  return ok(template);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.FOLLOWUP_WRITE);
  const parsed = followUpTemplateUpdateSchema.parse(await req.json());
  const current = await prisma.followUpTemplate.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy quy trình CSKH");

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.trigger !== undefined) data.trigger = parsed.trigger;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;

  // Thay toàn bộ bước nếu gửi steps.
  if (parsed.steps) {
    await prisma.followUpStep.deleteMany({ where: { templateId: params.id } });
    data.steps = {
      create: parsed.steps.map((s, i) => ({
        orderIndex: s.orderIndex ?? i,
        dayOffset: s.dayOffset,
        channel: s.channel,
        title: s.title,
        script: s.script ?? null,
        checklist: s.checklist ?? [],
      })),
    };
  }

  const template = await prisma.followUpTemplate.update({
    where: { id: params.id },
    data,
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  await auditLog({
    userId: session.userId,
    action: "FOLLOWUP_TEMPLATE_UPDATED",
    entityType: "FollowUpTemplate",
    entityId: template.id,
    changes: { isActive: template.isActive },
  });
  return ok(template);
});
