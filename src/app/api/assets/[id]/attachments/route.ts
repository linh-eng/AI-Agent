export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { assetAttachmentSchema } from "@/lib/validation";

// Tải lên 1 file đính kèm cho tài sản (hoặc cho 1 đợt thanh toán). Lưu base64
// trong DB (~5MB). Chỉ ADMIN/MANAGER (asset.manage).
export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = assetAttachmentSchema.parse(await req.json());
  const row = await prisma.assetAttachment.create({
    data: {
      assetId: ctx.params.id,
      paymentId: input.paymentId ?? null,
      kind: input.kind,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      data: input.data,
      note: input.note,
      uploadedById: session.userId,
    },
    select: { id: true, kind: true, filename: true, mimeType: true, size: true, note: true, createdAt: true },
  });
  return created(row);
});
