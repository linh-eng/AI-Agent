export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { storage } from "@/lib/storage";

// Cấp SIGNED URL có hạn cho nhân viên (đã kiểm quyền customer.read) — KHÔNG URL công khai.
export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.isArchived) return fail(404, "Không tìm thấy media");
  const url = await storage.getSignedUrl(asset.storageKey, { contentType: asset.contentType, filename: asset.filename });
  return ok({ url, contentType: asset.contentType, filename: asset.filename });
});
