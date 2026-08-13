export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sequentialCode, canSeeFinance, maskFinance } from "@/lib/clinic";

// "Vật tư khách hàng" — dành riêng cho 1 khách. Lọc theo customerId.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const items = await prisma.customerMaterial.findMany({
    where: { ...(customerId ? { customerId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { code: true, fullName: true } },
      usages: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });
  // Bổ sung tên phác đồ liên quan (liên kết mềm planId) để hiển thị ở hồ sơ khách.
  const planIds = [...new Set(items.map((m) => m.planId).filter((x): x is string => !!x))];
  const plans = planIds.length
    ? await prisma.treatmentPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
    : [];
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  return ok(
    items.map((m) => ({
      ...maskFinance(m, canSee, ["unitCost"]),
      remainingQty: Number(m.allocatedQty) - Number(m.usedQty),
      planName: m.planId ? planName.get(m.planId) ?? null : null,
      lastUsedAt: m.usages[0]?.occurredAt ?? null,
    }))
  );
});

const schema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  allocatedQty: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  planId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = schema.parse(await req.json());
  const customer = await prisma.customer.findUnique({ where: { id: d.customerId }, select: { id: true } });
  if (!customer) return fail(400, "Khách hàng không hợp lệ");
  const code = sequentialCode("VTKH", await prisma.customerMaterial.count());
  const m = await prisma.customerMaterial.create({
    data: { ...d, code, createdBy: session.name },
  });
  return created(m);
});
