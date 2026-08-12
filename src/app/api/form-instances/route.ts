export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { formInstanceCreateSchema } from "@/lib/library-validation";
import { persistInlineSignatures } from "@/lib/signature-storage";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const planId = url.searchParams.get("planId") ?? undefined;
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const items = await prisma.formInstance.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(planId ? { planId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    include: { template: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
});

// Áp template cho khách/phác đồ/buổi -> tạo INSTANCE riêng (snapshot schema),
// KHÔNG thay đổi template gốc (mục 14).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = formInstanceCreateSchema.parse(await req.json());
  const template = await prisma.formTemplate.findUnique({ where: { id: parsed.templateId } });
  if (!template) return fail(404, "Không tìm thấy biểu mẫu");

  // Chữ ký/ảnh nhúng base64 -> đẩy lên storage riêng tư, thay bằng tham chiếu mediaId.
  const data = parsed.data
    ? await persistInlineSignatures(parsed.data, {
        customerId: parsed.customerId ?? null,
        sessionId: parsed.sessionId ?? null,
        uploadedBy: session.name,
      })
    : undefined;

  const instance = await prisma.formInstance.create({
    data: {
      templateId: template.id,
      templateVersion: template.version,
      schemaSnapshot: template.schema as any,
      data: (data as any) ?? undefined,
      customerId: parsed.customerId ?? null,
      planId: parsed.planId ?? null,
      sessionId: parsed.sessionId ?? null,
      name: parsed.name ?? template.name,
      createdBy: parsed.createdBy ?? session.name,
    },
  });
  return created(instance);
});
