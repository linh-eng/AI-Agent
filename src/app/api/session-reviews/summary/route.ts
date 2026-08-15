export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { reviewSummary } from "@/lib/review";

// Tổng hợp đánh giá (điểm hài lòng, điểm KTV, tỷ lệ quay lại, theo từng KTV) — mục 37.
// Nhận CÙNG bộ lọc với gallery để KPI khớp phạm vi lưới ảnh (khách/dịch vụ/ngày).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const serviceId = url.searchParams.get("serviceId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return ok(await reviewSummary({
    customerId,
    serviceId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  }));
});
