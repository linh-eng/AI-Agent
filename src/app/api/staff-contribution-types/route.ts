export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { ensureContributionTypes } from "@/lib/contribution-service";

// Danh mục loại đóng góp (active) — mọi phiên đã đăng nhập đọc được (dùng khi ghi buổi).
export const GET = handle(async () => {
  await requireAuth();
  const count = await prisma.staffContributionType.count();
  if (count === 0) await ensureContributionTypes();
  const list = await prisma.staffContributionType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return ok(list);
});
