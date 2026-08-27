export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { settingUpdateSchema } from "@/lib/validation";

const ID = "company";

async function getOrCreate() {
  return prisma.companySetting.upsert({
    where: { id: ID },
    update: {},
    create: { id: ID, name: "Sophia Wellness" },
  });
}

// Công khai (không cần đăng nhập) — dùng cho trang đăng nhập hiển thị logo/tên.
export const GET = handle(async () => {
  const s = await getOrCreate();
  return ok({
    name: s.name,
    logo: s.logo,
    address: s.address,
    phone: s.phone,
    email: s.email,
    taxCode: s.taxCode,
  });
});

export const PATCH = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.SETTING_MANAGE);
  const input = settingUpdateSchema.parse(await req.json());
  const s = await prisma.companySetting.upsert({
    where: { id: ID },
    update: input,
    create: { id: ID, ...input },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "SETTING_UPDATE", entityType: "CompanySetting", entityId: ID },
  });
  return ok({ name: s.name });
});
