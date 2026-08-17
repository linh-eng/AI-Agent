export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { brandProtocolCreateSchema } from "@/lib/library-validation";
import { sequentialCode, auditLog } from "@/lib/clinic";
import { buildProtocolServicesCreate } from "@/lib/protocol-compose";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.LIBRARY_READ);
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const items = await prisma.brandProtocol.findMany({
    where: {
      isActive: true,
      ...(brandId ? { brandId } : {}),
      ...(kind ? { kind: kind as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      brand: { select: { name: true } },
      _count: { select: { technologies: true, products: true, sessions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return ok(items);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PROTOCOL_WRITE);
  const parsed = brandProtocolCreateSchema.parse(await req.json());
  const { technologyIds, productIds, services, ...data } = parsed;
  const code = parsed.code ?? sequentialCode("PROTO", await prisma.brandProtocol.count());
  // Redesign P2 — nếu tạo kèm compose Service, ghi version snapshot của từng Service.
  let servicesCreate: any = undefined;
  if (services?.length) {
    const svcs = await prisma.service.findMany({ where: { id: { in: services.map((s) => s.serviceId) } }, select: { id: true, version: true } });
    const versionById = new Map(svcs.map((s) => [s.id, s.version]));
    servicesCreate = { create: buildProtocolServicesCreate(services, versionById) };
  }
  const protocol = await prisma.brandProtocol.create({
    data: {
      ...data,
      code,
      createdBy: parsed.createdBy ?? session.name,
      technologies: technologyIds.length
        ? { create: technologyIds.map((technologyId) => ({ technologyId })) }
        : undefined,
      products: productIds.length
        ? { create: productIds.map((spaProductId) => ({ spaProductId })) }
        : undefined,
      services: servicesCreate,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "CREATE",
    entityType: "BrandProtocol",
    entityId: protocol.id,
    changes: { code, name: protocol.name, kind: protocol.kind },
  });
  return created(protocol);
});
