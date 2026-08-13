export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { followUpTemplateCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import { nextTemplateCode } from "@/lib/followup";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "1";
  const templates = await prisma.followUpTemplate.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { steps: { orderBy: { orderIndex: "asc" } }, _count: { select: { steps: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return ok(templates);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.FOLLOWUP_WRITE);
  const parsed = followUpTemplateCreateSchema.parse(await req.json());
  const template = await prisma.followUpTemplate.create({
    data: {
      code: await nextTemplateCode(),
      name: parsed.name,
      description: parsed.description ?? null,
      trigger: parsed.trigger,
      createdBy: session.name,
      steps: {
        create: parsed.steps.map((s, i) => ({
          orderIndex: s.orderIndex ?? i,
          dayOffset: s.dayOffset,
          channel: s.channel,
          title: s.title,
          script: s.script ?? null,
          checklist: s.checklist ?? [],
        })),
      },
    },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  await auditLog({
    userId: session.userId,
    action: "FOLLOWUP_TEMPLATE_CREATED",
    entityType: "FollowUpTemplate",
    entityId: template.id,
    changes: { name: parsed.name, steps: parsed.steps.length },
  });
  return created(template);
});
