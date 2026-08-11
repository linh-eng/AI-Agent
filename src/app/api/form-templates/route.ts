export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { formTemplateCreateSchema } from "@/lib/library-validation";
import { sequentialCode } from "@/lib/clinic";
import { emptySchema } from "@/lib/form-builder";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await prisma.formTemplate.findMany({
    where: { isActive: true, ...(status ? { status: status as any } : {}) },
    include: { _count: { select: { instances: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.FORM_WRITE);
  const parsed = formTemplateCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("FORM", await prisma.formTemplate.count());
  const template = await prisma.formTemplate.create({
    data: {
      ...parsed,
      code,
      schema: (parsed.schema as any) ?? (emptySchema() as any),
      createdBy: parsed.createdBy ?? session.name,
    },
  });
  return created(template);
});
