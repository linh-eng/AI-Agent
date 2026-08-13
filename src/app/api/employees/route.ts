export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { employeeCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, canSeeFinance, maskFinance, auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.HR_READ);
  const session = await getSession();
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "1";
  const role = url.searchParams.get("role") ?? undefined;
  const employees = await prisma.employee.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(role ? { roles: { has: role } } : {}),
    },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    take: 500,
  });
  const canSee = canSeeFinance(session);
  return ok(employees.map((e) => maskFinance(e, canSee, ["defaultFee"])));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.HR_WRITE);
  const parsed = employeeCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("NV", await prisma.employee.count());
  const employee = await prisma.employee.create({
    data: {
      code,
      fullName: parsed.fullName,
      phone: parsed.phone ?? null,
      email: parsed.email || null,
      roles: parsed.roles ?? [],
      defaultFee: parsed.defaultFee ?? null,
      note: parsed.note ?? null,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "EMPLOYEE_CREATED",
    entityType: "Employee",
    entityId: employee.id,
    changes: { code, roles: parsed.roles },
  });
  return created(employee);
});
