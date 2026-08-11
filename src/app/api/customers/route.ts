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
  const q = url.searchParams.get("q")?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
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
