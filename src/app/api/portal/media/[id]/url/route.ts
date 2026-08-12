export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";
import { storage } from "@/lib/storage";

// Signed URL cho khách — CHỈ media thuộc chính khách + đã chia sẻ + chưa archive.
export const GET = handle(async (_req, { params }) => {
  const { customerId } = await requirePortal();
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.isArchived || asset.customerId !== customerId || !asset.sharedWithCustomer) {
    return fail(404, "Không tìm thấy");
  }
  const url = await storage.getSignedUrl(asset.storageKey, { contentType: asset.contentType, filename: asset.filename });
  return ok({ url });
});
