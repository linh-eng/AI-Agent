export const dynamic = "force-dynamic";

import { handle, fail } from "@/lib/api";
import { storage, verifyBlobToken } from "@/lib/storage";

// Mục tiêu của SIGNED URL (local driver). Token HMAC có hạn LÀ ủy quyền (giống S3
// presigned) — được cấp CHỈ SAU khi kiểm quyền ở /api/media/[id]/url hoặc
// /api/portal/media/[id]/url. Không có phiên, không có URL công khai vĩnh viễn.
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return fail(400, "Thiếu token");
  const verified = verifyBlobToken(token);
  if (!verified) return fail(403, "Token không hợp lệ hoặc đã hết hạn");

  let data: Buffer;
  try {
    data = await storage.get(verified.key);
  } catch {
    return fail(404, "Không tìm thấy");
  }
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
