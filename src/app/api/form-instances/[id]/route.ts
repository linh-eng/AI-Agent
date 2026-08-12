export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { formInstanceUpdateSchema } from "@/lib/library-validation";
import { persistInlineSignatures } from "@/lib/signature-storage";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const instance = await prisma.formInstance.findUnique({
    where: { id: params.id },
    include: {
      template: { select: { name: true, code: true } },
      customer: { select: { code: true, fullName: true } },
    },
  });
  if (!instance) return fail(404, "Không tìm thấy phiếu");
  return ok(instance);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = formInstanceUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.data !== undefined) {
    // Đẩy chữ ký/ảnh base64 nhúng lên storage riêng tư trước khi lưu.
    const existing = await prisma.formInstance.findUnique({
      where: { id: params.id },
      select: { customerId: true, sessionId: true },
    });
    data.data = (await persistInlineSignatures(parsed.data, {
      customerId: existing?.customerId ?? null,
      sessionId: existing?.sessionId ?? null,
      uploadedBy: session.name,
    })) as any;
  }
  if (parsed.complete) {
    data.status = "COMPLETED";
    data.completedBy = session.name;
    data.completedAt = new Date();
  }
  const instance = await prisma.formInstance.update({ where: { id: params.id }, data });
  return ok(instance);
});
