export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { partnerCreateSchema } from "@/lib/validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PARTNER_READ);
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // SUPPLIER | CUSTOMER | BOTH
  const partners = await prisma.partner.findMany({
    where: type ? { OR: [{ type: type as any }, { type: "BOTH" }] } : undefined,
    orderBy: { code: "asc" },
  });
  return ok(partners);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.PARTNER_WRITE);
  const parsed = partnerCreateSchema.parse(await req.json());
  // Chuẩn hóa email rỗng -> null
  const data = { ...parsed, email: parsed.email ? parsed.email : null };
  const partner = await prisma.partner.create({ data });
  return created(partner);
});