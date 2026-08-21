export const dynamic = "force-dynamic";

// =============================================================================
// D6-B — Bỏ qua 1 vật tư dự kiến theo SOP cho buổi. LÝ DO BẮT BUỘC (no silent skip).
//   * KHÔNG trừ kho, KHÔNG tạo MaterialUsage — chỉ ghi VẾT bằng audit
//     SOP_MATERIAL_SKIPPED (D6-C: trace qua audit, KHÔNG cột DB mới).
//   * Quyền: MATERIAL_WRITE (như ghi tiêu hao).
// =============================================================================
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";

const skipSchema = z.object({
  sessionId: z.string().min(1),
  materialName: z.string().min(1),
  plannedQty: z.coerce.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  reason: z.string().trim().min(3, "Lý do bỏ qua bắt buộc (tối thiểu 3 ký tự)"),
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const d = skipSchema.parse(await req.json());
  const sess = await prisma.treatmentSession.findUnique({ where: { id: d.sessionId }, select: { id: true } });
  if (!sess) return fail(404, "Không tìm thấy buổi");
  await auditLog({
    userId: session.userId,
    action: "SOP_MATERIAL_SKIPPED",
    entityType: "TreatmentSession",
    entityId: d.sessionId,
    changes: { materialName: d.materialName, plannedQty: d.plannedQty ?? null, unit: d.unit ?? null, reason: d.reason, by: session.name },
  });
  return created({ ok: true, materialName: d.materialName, reason: d.reason });
});
