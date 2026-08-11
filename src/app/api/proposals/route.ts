export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { proposalCreateSchema } from "@/lib/ext-validation";
import { sequentialCode, proposalOptionTotal, auditLog, canSeeFinance } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PROPOSAL_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const items = await prisma.treatmentProposal.findMany({
    where: customerId ? { customerId } : undefined,
    include: {
      customer: { select: { code: true, fullName: true } },
      _count: { select: { options: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PROPOSAL_WRITE);
  const parsed = proposalCreateSchema.parse(await req.json());
  const code = sequentialCode("PROP", await prisma.treatmentProposal.count());

  const proposal = await prisma.treatmentProposal.create({
    data: {
      code,
      customerId: parsed.customerId,
      planId: parsed.planId ?? null,
      title: parsed.title,
      note: parsed.note ?? null,
      createdBy: parsed.createdBy ?? session.name,
      options: {
        create: parsed.options.map((o, oi) => ({
          kind: o.kind,
          name: o.name,
          orderIndex: o.orderIndex ?? oi,
          sessions: o.sessions ?? null,
          estimatedDurationDays: o.estimatedDurationDays ?? null,
          discount: o.discount ?? null,
          note: o.note ?? null,
          totalPrice: proposalOptionTotal(o.items, o.discount),
          items: {
            create: o.items.map((it, ii) => ({
              itemType: it.itemType,
              refId: it.refId ?? null,
              name: it.name,
              quantity: it.quantity,
              sessions: it.sessions ?? null,
              unitPrice: it.unitPrice ?? null,
              unitCost: it.unitCost ?? null,
              isHomeCare: it.isHomeCare,
              note: it.note ?? null,
              orderIndex: it.orderIndex ?? ii,
            })),
          },
        })),
      },
    },
    include: { options: { include: { items: true } } },
  });

  await auditLog({
    userId: session.userId,
    action: "CREATE",
    entityType: "TreatmentProposal",
    entityId: proposal.id,
    changes: { code, options: parsed.options.length },
  });
  return created(proposal);
});
