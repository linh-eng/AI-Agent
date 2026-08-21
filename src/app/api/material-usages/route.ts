export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance, maskFinance } from "@/lib/clinic";
import { consumeFromContainer, consumeFromCustomerMaterial } from "@/lib/spa-material-service";
import { auditLog } from "@/lib/clinic";

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
  idempotencyKey: z.string().optional().nullable(), // Redesign P4 — chống double-deduct
  origin: z.enum(["SOP", "MANUAL"]).optional(), // D6 — nguồn gợi ý (SOP) vs nhập tay; chỉ để TRACE qua audit, KHÔNG cột DB
});

// Ghi nhận 1 lần tiêu hao (điều hướng theo nguồn). Idempotent theo idempotencyKey (P4).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = consumeSchema.parse(await req.json());
  const base = { sessionId: d.sessionId ?? null, performedBy: session.name, quantity: d.quantity, note: d.note ?? null, idempotencyKey: d.idempotencyKey ?? null };
  let usage;
  if (d.source === "SHARED_STOCK") {
    if (!d.containerId) return fail(400, "Thiếu lọ/lô (container)");
    usage = await consumeFromContainer(d.containerId, base);
  } else {
    if (!d.customerMaterialId) return fail(400, "Thiếu vật tư khách hàng");
    usage = await consumeFromCustomerMaterial(d.customerMaterialId, base);
  }
  // Idempotent: nếu là bản đã tồn tại (POST trùng key) thì không audit lần nữa.
  const isNew = usage.createdAt && Date.now() - new Date(usage.createdAt).getTime() < 5000;
  if (isNew) await auditLog({ userId: session.userId, action: "MATERIAL_USAGE_POSTED", entityType: "MaterialUsage", entityId: usage.id, changes: { sessionId: d.sessionId, quantity: d.quantity, source: d.source, origin: d.origin ?? "MANUAL" } });
  return created(usage);
});
