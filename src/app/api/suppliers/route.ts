export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { supplierCreateSchema } from "@/lib/validation";
import { ensureUnique } from "@/lib/unique";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.SUPPLIER_READ);
  const rows = await prisma.supplier.findMany({ orderBy: { code: "asc" } });
  return ok(rows);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.SUPPLIER_WRITE);
  const data = supplierCreateSchema.parse(await req.json());
  await ensureUnique("supplier", "code", data.code, "Mã nhà cung cấp");
  const row = await prisma.supplier.create({ data });
  return created(row);
});
