export const dynamic = "force-dynamic";

import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { resolvePrice } from "@/lib/pricing";

// Gợi ý giá áp dụng cho 1 target tại 1 thời điểm (dùng khi tạo booking/proposal).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.PRICE_READ);
  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  if (!targetType || !targetId) return fail(400, "Thiếu targetType/targetId");
  const at = url.searchParams.get("at");
  const branch = url.searchParams.get("branch");
  const types = url.searchParams.get("types");
  const resolved = await resolvePrice(targetType, targetId, {
    at: at ? new Date(at) : undefined,
    branch,
    types: types ? types.split(",") : undefined,
  });
  return ok(resolved);
});
