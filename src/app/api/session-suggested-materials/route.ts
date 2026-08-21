export const dynamic = "force-dynamic";

// =============================================================================
// D6 — Gợi ý vật tư theo SOP cho MỘT buổi (READ-ONLY, KHÔNG trừ kho).
//   * Nguồn: SOP của dịch vụ thực tế (ServiceStep.products) — Planned/Suggested.
//   * KHÔNG tạo MaterialUsage, KHÔNG đụng tồn kho. Chỉ để UI prefill số dự kiến.
//   * Kèm danh sách đã "Bỏ qua" (từ audit SOP_MATERIAL_SKIPPED) để hiển thị trạng thái.
// Nguyên tắc: Planned ≠ Actual. Trừ kho CHỈ khi Confirmed Actual Usage qua
// /api/material-usages (engine tiêu hao hiện có) — route này KHÔNG trừ kho.
// =============================================================================
import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceStepsInclude } from "@/lib/service-sop";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return fail(400, "Thiếu sessionId");

  const sess = await prisma.treatmentSession.findUnique({
    where: { id: sessionId },
    select: { id: true, serviceId: true },
  });
  if (!sess) return fail(404, "Không tìm thấy buổi");

  // Gom vật tư dự kiến từ SOP dịch vụ (cộng số lượng theo tên chuẩn hóa).
  let suggested: { name: string; quantity: number; unit: string; isRequired: boolean; spaProductId: string | null }[] = [];
  if (sess.serviceId) {
    const service = await prisma.service.findUnique({ where: { id: sess.serviceId }, include: serviceStepsInclude });
    const agg = new Map<string, { name: string; quantity: number; unit: string; isRequired: boolean; spaProductId: string | null }>();
    for (const step of (service?.steps ?? [])) {
      for (const p of ((step as any).products ?? [])) {
        const key = norm(p.name);
        if (!key) continue;
        const cur = agg.get(key);
        const q = Number(p.quantity ?? 0);
        if (cur) { cur.quantity += q; cur.isRequired = cur.isRequired || !!p.isRequired; }
        else agg.set(key, { name: p.name, quantity: q, unit: p.unit ?? "", isRequired: !!p.isRequired, spaProductId: p.spaProductId ?? null });
      }
    }
    suggested = [...agg.values()];
  }

  // Đã "Bỏ qua" (audit) — lấy bản GẦN NHẤT mỗi tên vật tư.
  const skips = await prisma.auditLog.findMany({
    where: { action: "SOP_MATERIAL_SKIPPED", entityType: "TreatmentSession", entityId: sessionId },
    orderBy: { createdAt: "desc" },
    select: { changes: true, createdAt: true },
  });
  const skipByName = new Map<string, { materialName: string; reason: string; at: Date }>();
  for (const s of skips) {
    const c = (s.changes ?? {}) as any;
    const nm = c.materialName ? norm(c.materialName) : "";
    if (nm && !skipByName.has(nm)) skipByName.set(nm, { materialName: c.materialName, reason: c.reason ?? "", at: s.createdAt });
  }

  return ok({ serviceId: sess.serviceId, suggested, skipped: [...skipByName.values()] });
});
