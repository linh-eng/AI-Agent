export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { careInstructionCreateSchema } from "@/lib/ext-validation";
import { sequentialCode } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const serviceId = url.searchParams.get("serviceId") ?? undefined;
  const technologyId = url.searchParams.get("technologyId") ?? undefined;
  const brandProtocolId = url.searchParams.get("brandProtocolId") ?? undefined;
  const items = await prisma.careInstruction.findMany({
    where: {
      isActive: true,
      ...(kind ? { kind: kind as any } : {}),
      ...(status ? { status: status as any } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(technologyId ? { technologyId } : {}),
      ...(brandProtocolId ? { brandProtocolId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CARE_WRITE);
  const parsed = careInstructionCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("CARE", await prisma.careInstruction.count());
  const item = await prisma.careInstruction.create({
    data: { ...parsed, code, createdBy: parsed.createdBy ?? session.name, updatedBy: session.name },
  });
  return created(item);
});
