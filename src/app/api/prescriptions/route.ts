export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { prescriptionCreateSchema } from "@/lib/clinic-validation";
import { nextPrescriptionCode, buildPrescriptionItems, prescriptionInclude } from "@/lib/prescription";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const rows = await prisma.prescription.findMany({
    where: { ...(customerId ? { customerId } : {}), ...(sessionId ? { sessionId } : {}), ...(status ? { status: status as any } : {}) },
    orderBy: { createdAt: "desc" },
    include: prescriptionInclude,
    take: 200,
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = prescriptionCreateSchema.parse(await req.json());
  const cust = await prisma.customer.findUnique({ where: { id: parsed.customerId }, select: { id: true } });
  if (!cust) return fail(404, "Không tìm thấy khách hàng");
  const code = await nextPrescriptionCode();
  const row = await prisma.prescription.create({
    data: {
      code,
      customerId: parsed.customerId,
      sessionId: parsed.sessionId || null,
      diagnosis: parsed.diagnosis || null,
      advice: parsed.advice || null,
      followUpDate: parsed.followUpDate ?? null,
      issuedBy: parsed.issuedBy || session.name,
      items: { create: buildPrescriptionItems(parsed.items) },
    },
    include: prescriptionInclude,
  });
  await auditLog({ userId: session.userId, action: "PRESCRIPTION_CREATED", entityType: "Prescription", entityId: row.id, changes: { code, items: row.items.length } });
  return created(row);
});
