export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { STORAGE_CONFIG } from "@/lib/config";
import { storage, newStorageKey, kindFromContentType } from "@/lib/storage";

const VALID_KINDS = ["IMAGE", "BEFORE_IMAGE", "AFTER_IMAGE", "VIDEO", "FILE", "SIGNATURE"];

// Upload media RIÊNG TƯ. Trả về id (KHÔNG phải URL công khai). Hiển thị qua
// /api/media/[id] có kiểm quyền.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.MEDIA_WRITE);

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return fail(400, "Thiếu tệp (field 'file')");

  const blob = file as unknown as File;
  const contentType = blob.type || "application/octet-stream";
  const size = blob.size;

  if (size <= 0) return fail(400, "Tệp rỗng");
  if (size > STORAGE_CONFIG.maxBytes) {
    return fail(413, `Tệp quá lớn (tối đa ${Math.round(STORAGE_CONFIG.maxBytes / 1024 / 1024)}MB)`);
  }
  if (!STORAGE_CONFIG.allowedContentTypes.includes(contentType)) {
    return fail(415, `Loại tệp không hỗ trợ: ${contentType}`);
  }

  const kindRaw = String(form.get("kind") ?? "").toUpperCase();
  const kind = VALID_KINDS.includes(kindRaw) ? kindRaw : kindFromContentType(contentType);
  const customerId = (form.get("customerId") as string) || null;
  const sessionId = (form.get("sessionId") as string) || null;
  const filename = (blob.name || "upload").slice(0, 200);

  // Xác thực tham chiếu tồn tại (tránh gắn media vào id rác).
  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!c) return fail(400, "customerId không hợp lệ");
  }
  if (sessionId) {
    const s = await prisma.treatmentSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!s) return fail(400, "sessionId không hợp lệ");
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const storageKey = newStorageKey(filename);
  await storage.put(storageKey, buffer, contentType);

  const asset = await prisma.mediaAsset.create({
    data: {
      storageKey,
      filename,
      contentType,
      size,
      kind: kind as any,
      customerId,
      sessionId,
      uploadedBy: session.name,
    },
  });
  // KHÔNG trả storageKey ra ngoài.
  return created({
    id: asset.id,
    filename: asset.filename,
    contentType: asset.contentType,
    size: asset.size,
    kind: asset.kind,
  });
});

// Liệt kê media của 1 khách/buổi (metadata, không blob).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  if (!customerId && !sessionId) return fail(400, "Cần customerId hoặc sessionId");
  const assets = await prisma.mediaAsset.findMany({
    where: { isArchived: false, ...(customerId ? { customerId } : {}), ...(sessionId ? { sessionId } : {}) },
    select: { id: true, filename: true, contentType: true, size: true, kind: true, createdAt: true, sharedWithCustomer: true, sessionId: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(assets);
});
