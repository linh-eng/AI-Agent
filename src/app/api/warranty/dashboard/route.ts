export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { overdueDays, addDays, SLA_DAYS } from "@/lib/sla";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const now = new Date();

  const [intakes, rmas, damaged, claims] = await Promise.all([
    prisma.warrantyIntake.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.vendorRma.findMany({ where: { status: "SENT" }, orderBy: { sentDate: "asc" }, take: 100 }),
    prisma.damagedItem.findMany({ where: { resolution: "PENDING" }, orderBy: { dueDate: "asc" }, take: 100 }),
    prisma.rmaTicket.findMany({ where: { isVendorClaim: true, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  // Gắn thông tin serial
  const sids = [
    ...intakes.map((i) => i.serialId),
    ...rmas.map((r) => r.serialId),
    ...damaged.map((d) => d.serialId),
    ...claims.map((c) => c.serialId),
  ].filter(Boolean) as string[];
  const serials = await prisma.serial.findMany({
    where: { id: { in: sids } },
    select: { id: true, serialNumber: true, product: { select: { name: true } } },
  });
  const sMap = new Map(serials.map((s) => [s.id, s]));
  const sn = (id?: string | null) => (id ? sMap.get(id) : null);

  return ok({
    intakes: intakes.map((i) => ({ ...i, serial: sn(i.serialId) })),
    vendorRma: rmas.map((r) => {
      const due = r.sentDate ? addDays(r.sentDate, r.slaDays ?? SLA_DAYS.VENDOR_RMA) : null;
      return { ...r, serial: sn(r.serialId), dueDate: due, overdue: due ? overdueDays(due, now) : 0 };
    }),
    damaged: damaged.map((d) => ({ ...d, serial: sn(d.serialId), overdue: overdueDays(d.dueDate, now) })),
    claims: claims.map((c) => ({ ...c, serial: sn(c.serialId) })),
  });
});
