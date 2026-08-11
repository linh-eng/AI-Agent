export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { careInstanceCreateSchema } from "@/lib/ext-validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const items = await prisma.careInstructionInstance.findMany({
    where: { ...(customerId ? { customerId } : {}), ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
});

// Gửi/áp hướng dẫn cho khách -> lưu SNAPSHOT nội dung (mục 6). Cá nhân hóa bản
// của khách không đổi template gốc.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CARE_WRITE);
  const parsed = careInstanceCreateSchema.parse(await req.json());

  let templateVersion: number | null = null;
  if (parsed.templateId) {
    const tpl = await prisma.careInstruction.findUnique({
      where: { id: parsed.templateId },
      select: { version: true },
    });
    templateVersion = tpl?.version ?? null;
  }

  const instance = await prisma.careInstructionInstance.create({
    data: {
      templateId: parsed.templateId ?? null,
      templateVersion,
      kind: parsed.kind,
      title: parsed.title,
      content: parsed.content,
      customerId: parsed.customerId,
      sessionId: parsed.sessionId ?? null,
      bookingId: parsed.bookingId ?? null,
      deliveredVia: parsed.deliveredVia,
      deliveredAt: parsed.markDelivered ? new Date() : null,
      providedBy: parsed.providedBy ?? session.name,
    },
  });
  return created(instance);
});
