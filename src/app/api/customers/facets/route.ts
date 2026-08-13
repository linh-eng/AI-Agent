export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Dữ liệu cho các bộ lọc danh sách khách hàng: nguồn, nhân viên phụ trách, KTV,
// dịch vụ. Chỉ trả danh sách gọn để đổ vào dropdown lọc (không nặng).
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const [srcRows, assignRows, techBooking, techSession, services] = await Promise.all([
    prisma.customer.findMany({ where: { source: { not: null } }, select: { source: true }, distinct: ["source"], take: 200 }),
    prisma.customer.findMany({ where: { assignedTo: { not: null } }, select: { assignedTo: true }, distinct: ["assignedTo"], take: 200 }),
    prisma.booking.findMany({ where: { technician: { not: null } }, select: { technician: true }, distinct: ["technician"], take: 200 }),
    prisma.treatmentSession.findMany({ where: { performer: { not: null } }, select: { performer: true }, distinct: ["performer"], take: 200 }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
  ]);

  const clean = (arr: (string | null)[]) => [...new Set(arr.filter((x): x is string => !!x && x.trim() !== ""))].sort((a, b) => a.localeCompare(b, "vi"));

  return ok({
    sources: clean(srcRows.map((r) => r.source)),
    assignees: clean(assignRows.map((r) => r.assignedTo)),
    technicians: clean([...techBooking.map((r) => r.technician), ...techSession.map((r) => r.performer)]),
    services,
  });
});
