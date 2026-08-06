export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";

// Danh bạ người dùng tối thiểu (id/tên/phòng ban) cho việc gán phụ trách, @nhắc tên.
// Bất kỳ người dùng đã đăng nhập đều xem được — KHÔNG lộ email/quyền.
export const GET = handle(async () => {
  await requireAuth();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, department: true },
  });
  return ok(users);
});
