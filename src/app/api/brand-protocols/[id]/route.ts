export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandProtocolUpdateSchema } from "@/lib/library-validation";
import { auditLog } from "@/lib/clinic";
import { protocolServicesInclude, buildProtocolServicesCreate, composeTotalDuration } from "@/lib/protocol-compose";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const protocol = await prisma.brandProtocol.findUnique({
    where: { id: params.id },
    include: {
      brand: { select: { id: true, name: true } },
      technologies: { include: { technology: { select: { id: true, name: true } } } },
      products: { include: { product: { select: { id: true, name: true, sku: true } } } },
      ...protocolServicesInclude, // Redesign P2 — compose nhiều Service (+ preview SOP read-only)
    },
  });
  if (!protocol) return fail(404, "Không tìm thấy protocol");
  // Tổng thời lượng khi compose theo Service (chỉ có ý nghĩa với mode SERVICES).
  const composeDuration = composeTotalDuration((protocol as any).services);
  return ok({ ...protocol, composeDuration });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PROTOCOL_WRITE);
  const parsed = brandProtocolUpdateSchema.parse(await req.json());
  const { technologyIds, productIds, bumpVersion, changeReason, changedBy, status, compositionMode, services, ...rest } = parsed;

  const current = await prisma.brandProtocol.findUnique({
    where: { id: params.id },
    include: { services: { orderBy: { sortOrder: "asc" }, select: { serviceId: true, sortOrder: true, isRequired: true, durationOverride: true } } },
  });
  if (!current) return fail(404, "Không tìm thấy protocol");

  // Chỉ vai trò có quyền duyệt mới được đưa protocol sang APPROVED/ACTIVE (mục 19).
  if (status && (status === "APPROVED" || status === "ACTIVE")) {
    await requirePermission(PERMISSIONS.PROTOCOL_APPROVE);
  }

  const data: Record<string, unknown> = { ...rest };
  if (status) data.status = status;
  if (compositionMode) data.compositionMode = compositionMode;

  // Redesign P2 — thay TOÀN BỘ danh sách Service compose (không clone SOP; ghi version snapshot).
  let servicesChanged = false;
  if (services !== undefined) {
    // Xác thực Service tồn tại + lấy version hiện hành để ghi serviceVersionSnapshot.
    const ids = services.map((s) => s.serviceId);
    const svcs = ids.length ? await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true, version: true } }) : [];
    const found = new Set(svcs.map((s) => s.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) return fail(422, `Dịch vụ không tồn tại: ${missing.join(", ")}`);
    const versionById = new Map(svcs.map((s) => [s.id, s.version]));
    await prisma.protocolService.deleteMany({ where: { protocolId: params.id } });
    const create = buildProtocolServicesCreate(services, versionById);
    if (create?.length) {
      for (const row of create) await prisma.protocolService.create({ data: { ...row, protocol: { connect: { id: params.id } } } as any });
    }
    servicesChanged = true;
  }

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

  // Audit thay đổi compose Service (thêm/bớt/đổi thứ tự/override) — before/after gọn (mục 20).
  if (servicesChanged) {
    const after = (services ?? []).map((s, i) => ({ serviceId: s.serviceId, sortOrder: i, isRequired: s.isRequired ?? true, durationOverride: s.durationOverride ?? null }));
    await auditLog({
      userId: session.userId,
      action: "PROTOCOL_SERVICES_CHANGED",
      entityType: "BrandProtocol",
      entityId: protocol.id,
      changes: { before: current.services, after, compositionMode: protocol.compositionMode },
    });
  }
  await auditLog({
    userId: session.userId,
    action: bumpVersion ? "VERSION_BUMP" : status ? "STATUS_CHANGE" : "UPDATE",
    entityType: "BrandProtocol",
    entityId: protocol.id,
    changes: { version: protocol.version, status: protocol.status, compositionMode: protocol.compositionMode },
  });
  return ok(protocol);
});

export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.PROTOCOL_WRITE);
  const protocol = await prisma.brandProtocol.update({ where: { id: params.id }, data: { isActive: false } });
  return ok({ id: protocol.id, isActive: protocol.isActive });
});
