export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { storage } from "@/lib/storage";

// Tải blob media — CHỈ nhân viên có quyền đọc khách. Không có URL công khai.
// (Cổng khách hàng dùng route riêng /api/portal/media với kiểm quyền sở hữu.)
export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.isArchived) return fail(404, "Không tìm thấy media");

  let data: Buffer;
  try {
    data = await storage.get(asset.storageKey);
  } catch {
    return fail(404, "Blob không tồn tại");
  }
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
      // Riêng tư: không cache ở proxy/CDN dùng chung.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// Xóa = ARCHIVE mềm (giữ bản ghi để không mồ côi tham chiếu; blob vẫn giữ để có thể khôi phục).
export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.MEDIA_WRITE);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!asset) return fail(404, "Không tìm thấy media");
  await prisma.mediaAsset.update({ where: { id: params.id }, data: { isArchived: true } });
  return ok({ id: params.id, isArchived: true });
});

// Cập nhật cờ chia sẻ cho khách (nhân viên chủ động chọn ảnh trước/sau để khách xem).
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.MEDIA_WRITE);
  const body = await req.json().catch(() => ({}));
  const asset = await prisma.mediaAsset.update({
    where: { id: params.id },
    data: { sharedWithCustomer: !!body.sharedWithCustomer },
  });
  return ok({ id: asset.id, sharedWithCustomer: asset.sharedWithCustomer });
});
