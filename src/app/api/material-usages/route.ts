export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance, maskFinance } from "@/lib/clinic";
import { consumeFromContainer, consumeFromCustomerMaterial } from "@/lib/spa-material-service";

// Lịch sử tiêu hao vật tư (2 nguồn). Lọc theo buổi/khách/container/vật-tư-khách.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const u = new URL(req.url);
  const where: any = {};
  for (const k of ["sessionId", "customerId", "containerId", "customerMaterialId"]) {
    const v = u.searchParams.get(k);
    if (v) where[k] = v;
  }
  const usages = await prisma.materialUsage.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 500,
    include: {
      container: { include: { material: { select: { name: true, unit: true } } } },
      customerMaterial: { select: { name: true, unit: true } },
      session: { select: { name: true, sessionNumber: true } },
    },
  });
  return ok(usages.map((x) => maskFinance(x, canSee, ["unitCost", "costAllocated"])));
});

const consumeSchema = z.object({
  source: z.enum(["SHARED_STOCK", "CUSTOMER_OWNED"]),
  containerId: z.string().optional().nullable(),
  customerMaterialId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive(),
  note: z.string().optional().nullable(),
});

// Ghi nhận 1 lần tiêu hao (điều hướng theo nguồn).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = consumeSchema.parse(await req.json());
  const base = { sessionId: d.sessionId ?? null, performedBy: session.name, quantity: d.quantity, note: d.note ?? null };
  if (d.source === "SHARED_STOCK") {
    if (!d.containerId) return fail(400, "Thiếu lọ/lô (container)");
    const usage = await consumeFromContainer(d.containerId, base);
    return created(usage);
  }
  if (!d.customerMaterialId) return fail(400, "Thiếu vật tư khách hàng");
  const usage = await consumeFromCustomerMaterial(d.customerMaterialId, base);
  return created(usage);
});
