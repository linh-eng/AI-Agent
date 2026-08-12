export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sequentialCode, canSeeFinance, maskFinance } from "@/lib/clinic";

// "Kho vật tư sử dụng" — danh mục vật tư dùng chung + các lọ/lô (container).
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const session = await getSession();
  const canSee = canSeeFinance(session);
  const materials = await prisma.usageMaterial.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { containers: { orderBy: { createdAt: "desc" } } },
  });
  return ok(
    materials.map((m) => ({
      ...m,
      containers: m.containers.map((c) => maskFinance(c, canSee, ["costSnapshot"])),
    }))
  );
});

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  technologyId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  expectedPerSession: z.coerce.number().nonnegative().optional().nullable(),
  lowThreshold: z.coerce.number().nonnegative().optional().nullable(),
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const data = createSchema.parse(await req.json());
  const code = sequentialCode("VT", await prisma.usageMaterial.count());
  const m = await prisma.usageMaterial.create({
    data: { ...data, code, createdBy: session.name },
  });
  return created(m);
});
