export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assessmentCreateSchema } from "@/lib/clinic-validation";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const items = await prisma.assessment.findMany({
    where: customerId ? { customerId } : undefined,
    orderBy: { assessedAt: "desc" },
  });
  return ok(items);
});

// Đánh giá lại nhiều lần theo thời gian (mục 10) — mỗi lần là record mới
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = assessmentCreateSchema.parse(await req.json());
  const item = await prisma.assessment.create({
    data: {
      ...parsed,
      assessedAt: parsed.assessedAt ?? new Date(),
      assessedBy: parsed.assessedBy ?? session.name,
    },
  });
  return created(item);
});
