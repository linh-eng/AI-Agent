export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { reviewSummary } from "@/lib/review";

// Tổng hợp đánh giá (điểm hài lòng, điểm KTV, tỷ lệ quay lại, theo từng KTV) — mục 37.
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  return ok(await reviewSummary());
});
