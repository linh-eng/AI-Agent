export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandProtocolUpdateSchema } from "@/lib/library-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const protocol = await prisma.brandProtocol.findUnique({
    where: { id: params.id },
    include: {
      brand: { select: { id: true, name: true } },
      technologies: { include: { technology: { select: { id: true, name: true } } } },
      products: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });
  if (!protocol) return fail(404, "Không tìm thấy protocol");
  return ok(protocol);
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PROTOCOL_WRITE);
  const parsed = brandProtocolUpdateSchema.parse(await req.json());
  const { technologyIds, productIds, bumpVersion, changeReason, changedBy, status, ...rest } = parsed;

  const current = await prisma.brandProtocol.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy protocol");

  // Chỉ vai trò có quyền duyệt mới được đưa protocol sang APPROVED/ACTIVE (mục 19).
  if (status && (status === "APPROVED" || status === "ACTIVE")) {
    await requirePermission(PERMISSIONS.PROTOCOL_APPROVE);
  }

  const data: Record<string, unknown> = { ...rest };
  if (status) data.status = status;

  if (bumpVersion) {
    const log = Array.isArray(current.changeLog) ? (current.changeLog as any[]) : [];
    log.push({
      fromVersion: current.version,
      toVersion: current.version + 1,
      reason: changeReason ?? null,
      changedBy: changedBy ?? session.name,
      at: new Date().toISOString(),
    });
    data.version = current.version + 1;
    data.changeLog = log as any;
  }

  // Cập nhật join (thay thế toàn bộ) nếu client gửi danh sách
  if (technologyIds) {
    await prisma.brandProtocolTechnology.deleteMany({ where: { brandProtocolId: params.id } });
    if (technologyIds.length)
      await prisma.brandProtocolTechnology.createMany({
        data: technologyIds.map((technologyId) => ({ brandProtocolId: params.id, technologyId })),
        skipDuplicates: true,
      });
  }
  if (productIds) {
    await prisma.brandProtocolProduct.deleteMany({ where: { brandProtocolId: params.id } });
    if (productIds.length)
      await prisma.brandProtocolProduct.createMany({
        data: productIds.map((spaProductId) => ({ brandProtocolId: params.id, spaProductId })),
        skipDuplicates: true,
      });
  }

  const protocol = await prisma.brandProtocol.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: bumpVersion ? "VERSION_BUMP" : status ? "STATUS_CHANGE" : "UPDATE",
    entityType: "BrandProtocol",
    entityId: protocol.id,
    changes: { version: protocol.version, status: protocol.status },
  });
  return ok(protocol);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PROTOCOL_WRITE);
  const protocol = await prisma.brandProtocol.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: protocol.id, isActive: protocol.isActive });
});
