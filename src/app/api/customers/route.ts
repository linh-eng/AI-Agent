export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { customerCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const p = url.searchParams;
  const q = p.get("q")?.trim();
  const source = p.get("source")?.trim();
  const assignedTo = p.get("assignedTo")?.trim();
  const serviceId = p.get("serviceId")?.trim();
  const technician = p.get("technician")?.trim();
  const plan = p.get("plan")?.trim();
  const status = p.get("status")?.trim(); // active | inactive | all
  const from = p.get("from");
  const to = p.get("to");
  const take = Math.min(Number(p.get("take") ?? 200) || 200, 500);

  // Bộ lọc kết hợp (AND). Các lọc theo dịch vụ/KTV/phác đồ dùng quan hệ lồng nhau.
  const and: Record<string, unknown>[] = [];
  if (q) {
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (source) and.push({ source: { contains: source, mode: "insensitive" } });
  if (assignedTo) and.push({ assignedTo: { contains: assignedTo, mode: "insensitive" } });
  if (from || to) {
    and.push({ createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } });
  }
  if (serviceId) {
    and.push({ OR: [{ bookings: { some: { serviceId } } }, { sessions: { some: { serviceId } } }] });
  }
  if (technician) {
    and.push({
      OR: [
        { bookings: { some: { technician: { contains: technician, mode: "insensitive" } } } },
        { sessions: { some: { performer: { contains: technician, mode: "insensitive" } } } },
        { sessions: { some: { staff: { some: { staffName: { contains: technician, mode: "insensitive" } } } } } },
      ],
    });
  }
  if (plan) and.push({ plans: { some: { name: { contains: plan, mode: "insensitive" } } } });

  const isActive = status === "inactive" ? false : status === "all" ? undefined : true;
  if (isActive !== undefined) and.push({ isActive });

  const customers = await prisma.customer.findMany({
    where: and.length ? { AND: and as any } : {},
    orderBy: { createdAt: "desc" },
    take,
  });
  return ok(customers);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const parsed = customerCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("KH", await prisma.customer.count());
  const customer = await prisma.customer.create({
    data: {
      ...parsed,
      code,
      email: parsed.email ? parsed.email : null,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "CREATE",
    entityType: "Customer",
    entityId: customer.id,
    changes: { code, fullName: customer.fullName },
  });
  return created(customer);
});
