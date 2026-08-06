export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requireAuth();
  const request = await prisma.request.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      lines: true,
      comments: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  // Gắn thông tin sản phẩm cho từng dòng (RequestLine.productId là scalar)
  const productIds = Array.from(new Set(request.lines.map((l) => l.productId).filter(Boolean) as string[]));
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, name: true, partNumber: true, model: true } })
    : [];
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const linesWithProduct = request.lines.map((l) => ({ ...l, product: l.productId ? prodMap.get(l.productId) ?? null : null }));
  (request as any).lines = linesWithProduct;

  // Gắn thêm tên người liên quan (requester/assignee) để hiển thị
  const userIds = Array.from(
    new Set(
      [request.requesterId, request.assigneeId, request.receivedById, request.closedById].filter(Boolean) as string[]
    )
  );
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, department: true, email: true },
  });
  const partner = request.partnerId
    ? await prisma.partner.findUnique({ where: { id: request.partnerId }, select: { code: true, name: true } })
    : null;
  const project = request.projectId
    ? await prisma.project.findUnique({ where: { id: request.projectId }, select: { code: true, name: true } })
    : null;

  return ok({ request, users, partner, project });
});
