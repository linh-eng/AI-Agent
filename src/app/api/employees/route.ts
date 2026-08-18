export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { employeeCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode, canSeeFinance, auditLog } from "@/lib/clinic";
import { currentRoleFees } from "@/lib/hr";

/** Được xem phí nhân sự: finance.read HOẶC staff.fee.read (mục 19). */
function canSeeStaffFee(session: { permissions: string[] } | null): boolean {
  return !!session && (canSeeFinance(session as any) || session.permissions.includes(PERMISSIONS.STAFF_FEE_READ));
}

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.STAFF_READ);
  const session = await getSession();
  const url = new URL(req.url);
  const p = url.searchParams;
  const activeOnly = p.get("active") === "1";
  const role = p.get("role") ?? undefined;
  const branch = p.get("branch")?.trim();
  const branchId = p.get("branchId")?.trim(); // HR-PH1 — lọc theo Branch chuẩn hóa
  const status = p.get("status") ?? undefined;
  const technology = p.get("technology") ?? undefined; // refId công nghệ (năng lực)
  const q = p.get("q")?.trim().toLowerCase();

  const employees = await prisma.employee.findMany({
    where: {
      ...(activeOnly ? { status: "ACTIVE" } : {}),
      ...(status ? { status: status as any } : {}),
      ...(branchId ? { branchId } : {}),
      ...(branch ? { branch: { contains: branch, mode: "insensitive" } } : {}),
      ...(technology ? { competences: { some: { kind: "TECHNOLOGY", refId: technology } } } : {}),
    },
    include: {
      roleFees: { where: { isActive: true } },
      competences: true,
      branchRef: { select: { id: true, code: true, name: true } }, // HR-PH1
      _count: { select: { certifications: true, schedules: true } },
    },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    take: 500,
  });

  const showFee = canSeeStaffFee(session);
  const now = new Date();
  let rows = await Promise.all(
    employees.map(async (e) => {
      const feeRows = showFee ? await currentRoleFees(e.id, now) : [];
      const roleSet = Array.from(new Set<string>([...(e.roles ?? []), ...e.roleFees.map((r) => r.role)]));
      const mainCompetence = e.competences.find((c) => c.kind === "TECHNOLOGY") ?? e.competences[0] ?? null;
      return {
        id: e.id, code: e.code, fullName: e.fullName, phone: e.phone, email: e.email,
        title: e.title, branch: e.branch, status: e.status, startDate: e.startDate,
        // --- HR-PH1 (additive) ---
        branchId: e.branchId, branchName: e.branchRef?.name ?? null, branchCode: e.branchRef?.code ?? null,
        employmentType: e.employmentType, endDate: e.endDate, hasAccount: !!e.userId,
        roles: roleSet,
        roleFees: feeRows, // [] nếu không có quyền xem phí
        competenceCount: e.competences.length,
        mainCompetence: mainCompetence?.name ?? null,
        certCount: e._count.certifications, scheduleCount: e._count.schedules,
      };
    })
  );
  if (role) rows = rows.filter((r) => r.roles.includes(role));
  if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q));
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.STAFF_WRITE);
  const parsed = employeeCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("NV", await prisma.employee.count());
  const status = parsed.status ?? "ACTIVE";
  if (parsed.branchId) {
    const br = await prisma.branch.findUnique({ where: { id: parsed.branchId }, select: { id: true } });
    if (!br) return fail(422, "Chi nhánh không tồn tại");
  }
  const employee = await prisma.employee.create({
    data: {
      code, fullName: parsed.fullName, phone: parsed.phone ?? null, email: parsed.email || null,
      dob: parsed.dob ?? null, title: parsed.title ?? null, branch: parsed.branch ?? null, startDate: parsed.startDate ?? null,
      status, isActive: status === "ACTIVE", roles: parsed.roles ?? [], defaultFee: parsed.defaultFee ?? null, note: parsed.note ?? null,
      // --- HR-PH1 (additive) ---
      branchId: parsed.branchId ?? null, employmentType: parsed.employmentType ?? null, endDate: parsed.endDate ?? null,
    },
  });
  await auditLog({ userId: session.userId, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id, changes: { code, roles: parsed.roles, status } });
  return created(employee);
});
