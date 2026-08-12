// =============================================================================
// INF3 — Đưa CHỮ KÝ (và mọi giá trị dạng data-URL base64 nhúng trong phiếu) lên
// storage layer THẬT thay vì lưu base64 trực tiếp trong JSON của FormInstance.
//
//   * Chữ ký client tạo shape `{ dataUrl: "data:image/png;base64,…", signedBy, signedAt }`.
//   * Khi lưu phiếu, ta upload blob vào storage (MediaAsset kind=SIGNATURE, PRIVATE),
//     rồi thay `dataUrl` bằng `mediaId` (tham chiếu) — DB chỉ giữ object key + metadata.
//   * Idempotent: nếu đã có `mediaId` (không còn dataUrl) thì bỏ qua.
//   * An toàn: lỗi upload KHÔNG làm hỏng lần lưu lâm sàng — giữ nguyên giá trị cũ và
//     ghi log (để bước sau xử lý), tránh mất chữ ký.
// =============================================================================
import { prisma } from "./prisma";
import { storage, newStorageKey } from "./storage";
import { logger } from "./logger";

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

interface PersistCtx {
  customerId?: string | null;
  sessionId?: string | null;
  uploadedBy?: string | null;
}

/** Là một chữ ký chưa lưu storage (còn dataUrl base64)? */
function isInlineSignature(v: unknown): v is { dataUrl: string } & Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as any).dataUrl === "string" &&
    DATA_URL_RE.test((v as any).dataUrl)
  );
}

async function uploadOne(dataUrl: string, ctx: PersistCtx): Promise<string | null> {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0) return null;
  const ext = contentType === "image/png" ? "chu-ky.png" : "chu-ky.img";
  const storageKey = newStorageKey(ext);
  await storage.put(storageKey, buffer, contentType);
  const asset = await prisma.mediaAsset.create({
    data: {
      storageKey,
      filename: "chu-ky.png",
      contentType,
      size: buffer.length,
      kind: "SIGNATURE",
      customerId: ctx.customerId ?? null,
      sessionId: ctx.sessionId ?? null,
      uploadedBy: ctx.uploadedBy ?? null,
      // Chữ ký là dữ liệu nội bộ/pháp lý — mặc định RIÊNG TƯ.
      sharedWithCustomer: false,
    },
  });
  return asset.id;
}

/**
 * Duyệt đệ quy `data` của phiếu; với mỗi chữ ký còn base64 → upload vào storage và
 * thay `dataUrl` bằng `mediaId`. Trả về bản `data` MỚI (không sửa tại chỗ input).
 */
export async function persistInlineSignatures<T>(data: T, ctx: PersistCtx): Promise<T> {
  if (data == null || typeof data !== "object") return data;

  async function walk(node: unknown, depth: number): Promise<unknown> {
    if (depth > 6 || node == null || typeof node !== "object") return node;

    if (isInlineSignature(node)) {
      const { dataUrl, ...rest } = node as any;
      try {
        const mediaId = await uploadOne(dataUrl, ctx);
        if (mediaId) return { ...rest, mediaId }; // bỏ base64, chỉ giữ tham chiếu + signedBy/signedAt
      } catch (err) {
        logger.error("Không lưu được chữ ký vào storage — giữ tạm inline", {
          sessionId: ctx.sessionId, error: (err as Error)?.message,
        });
        return node; // giữ nguyên để không mất chữ ký
      }
      return node;
    }

    if (Array.isArray(node)) {
      return Promise.all(node.map((v) => walk(v, depth + 1)));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = await walk(v, depth + 1);
    }
    return out;
  }

  return (await walk(data, 0)) as T;
}
