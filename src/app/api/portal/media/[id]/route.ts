export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handle, fail } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";
import { storage } from "@/lib/storage";

// Tải media qua cổng khách — CHỈ khi: thuộc chính khách + đã được chia sẻ + chưa archive.
// Không thỏa -> 404 (không lộ tồn tại).
export const GET = handle(async (_req, { params }) => {
  const { customerId } = await requirePortal();
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.isArchived || asset.customerId !== customerId || !asset.sharedWithCustomer) {
    return fail(404, "Không tìm thấy");
  }
  let data: Buffer;
  try {
    data = await storage.get(asset.storageKey);
  } catch {
    return fail(404, "Không tìm thấy");
  }
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
