// =============================================================================
// SEC3 — Lưu trữ blob RIÊNG TƯ, có SIGNED URL và swappable backend.
//   * StorageProvider: put/get/delete + getSignedUrl (URL có hạn, đã xác thực).
//   * LocalStorageProvider: FS ngoài public/, signed URL = HMAC token tới
//     /api/storage/blob (không phiên, hết hạn ngắn) -> KHÔNG có URL công khai vĩnh viễn.
//   * S3StorageProvider: private bucket + presigned GET URL (S3/R2/MinIO).
//   * Đổi backend qua STORAGE_DRIVER — KHÔNG đổi tầng nghiệp vụ/DB.
// =============================================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { STORAGE_CONFIG } from "./config";

export interface SignedUrlOpts {
  expiresIn?: number; // giây
  contentType?: string;
  filename?: string;
}

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** URL có hạn để truy cập blob (đã được kiểm quyền TRƯỚC khi cấp). */
  getSignedUrl(key: string, opts?: SignedUrlOpts): Promise<string>;
}

function assertSafeKey(key: string) {
  if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes("..")) {
    throw new Error("storage key không hợp lệ");
  }
}

// ---------- Signed token (dùng cho local driver) ----------
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function signBlobToken(key: string, expEpoch: number): string {
  const payload = b64url(Buffer.from(JSON.stringify({ k: key, e: expEpoch })));
  const sig = b64url(createHmac("sha256", STORAGE_CONFIG.signSecret).update(payload).digest());
  return `${payload}.${sig}`;
}
export function verifyBlobToken(token: string): { key: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", STORAGE_CONFIG.signSecret).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { k, e } = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (typeof k !== "string" || typeof e !== "number") return null;
    if (Date.now() / 1000 > e) return null; // hết hạn
    return { key: k };
  } catch {
    return null;
  }
}

// ---------- Local provider ----------
class LocalStorageProvider implements StorageProvider {
  constructor(private root: string) {}
  private full(key: string): string {
    assertSafeKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer): Promise<void> {
    const p = this.full(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data, { mode: 0o600 });
  }
  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }
  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }
  async getSignedUrl(key: string, opts?: SignedUrlOpts): Promise<string> {
    assertSafeKey(key);
    const ttl = opts?.expiresIn ?? STORAGE_CONFIG.signedUrlTtl;
    const token = signBlobToken(key, Math.floor(Date.now() / 1000) + ttl);
    return `/api/storage/blob?t=${encodeURIComponent(token)}`;
  }
}

// ---------- S3 provider (private bucket + presigned URL) ----------
class S3StorageProvider implements StorageProvider {
  private clientPromise: Promise<any> | null = null;
  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import("@aws-sdk/client-s3");
        const c = STORAGE_CONFIG.s3;
        return new S3Client({
          region: c.region,
          endpoint: c.endpoint,
          forcePathStyle: c.forcePathStyle,
          credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
        });
      })();
    }
    return this.clientPromise;
  }
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new PutObjectCommand({
      Bucket: STORAGE_CONFIG.s3.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      // Mã hóa at-rest phía server (S3/R2 SSE). Bucket vẫn PRIVATE; không set ACL public.
      ServerSideEncryption: "AES256",
    }));
  }
  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const res = await client.send(new GetObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of res.Body as any) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }));
  }
  async getSignedUrl(key: string, opts?: SignedUrlOpts): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    const cmd = new GetObjectCommand({
      Bucket: STORAGE_CONFIG.s3.bucket,
      Key: key,
      ResponseContentType: opts?.contentType,
      ResponseContentDisposition: opts?.filename ? `inline; filename="${encodeURIComponent(opts.filename)}"` : undefined,
    });
    return getSignedUrl(client, cmd, { expiresIn: opts?.expiresIn ?? STORAGE_CONFIG.signedUrlTtl });
  }
}

function makeProvider(): StorageProvider {
  if (STORAGE_CONFIG.driver === "s3") return new S3StorageProvider();
  return new LocalStorageProvider(STORAGE_CONFIG.dir);
}
export const storage: StorageProvider = makeProvider();

/** Sinh storage key KHÔNG đoán được: yyyy/mm/uuid.ext (đuôi an toàn). */
export function newStorageKey(filename: string): string {
  const ext = (path.extname(filename) || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${randomUUID()}${ext}`;
}

export function kindFromContentType(ct: string): "IMAGE" | "VIDEO" | "FILE" {
  if (ct.startsWith("image/")) return "IMAGE";
  if (ct.startsWith("video/")) return "VIDEO";
  return "FILE";
}

/** Kiểm tra tệp upload có hợp lệ không (MIME allowlist + chặn đuôi thực thi). */
export function validateUpload(filename: string, contentType: string, size: number): string | null {
  if (size <= 0) return "Tệp rỗng";
  if (size > STORAGE_CONFIG.maxBytes) return `Tệp quá lớn (tối đa ${Math.round(STORAGE_CONFIG.maxBytes / 1024 / 1024)}MB)`;
  if (!STORAGE_CONFIG.allowedContentTypes.includes(contentType)) return `Loại tệp không hỗ trợ: ${contentType}`;
  const ext = path.extname(filename).toLowerCase();
  if (STORAGE_CONFIG.blockedExtensions.includes(ext)) return `Đuôi tệp bị chặn: ${ext}`;
  return null;
}

/**
 * Nhận diện loại nội dung THẬT bằng magic bytes (không tin MIME/filename do browser
 * khai báo). Trả về MIME suy ra từ chữ ký byte, hoặc null nếu không nhận ra.
 * Chỉ nhận các định dạng nghiệp vụ cho phép: JPEG, PNG, WEBP, GIF, PDF, MP4/QuickTime.
 */
export function sniffContentType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  // PDF: "%PDF"
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  // RIFF....WEBP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  // ISO Base Media (mp4/quicktime/heic): bytes 4..8 == "ftyp"
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("qt")) return "video/quicktime";
    if (brand.startsWith("hei") || brand.startsWith("mif")) return "image/heic";
    return "video/mp4";
  }
  return null;
}

/**
 * Xác thực upload dựa trên NỘI DUNG THẬT (magic bytes) — tầng bảo vệ mạnh hơn
 * `validateUpload`. Chống: đổi đuôi tệp, giả MIME, upload script/thực thi ngụy trang
 * thành ảnh. Trả về `{ error }` nếu chặn, hoặc `{ contentType }` (MIME đã suy ra tin cậy).
 */
export function validateUploadBytes(
  filename: string,
  declaredType: string,
  buf: Buffer
): { error: string } | { contentType: string } {
  const basic = validateUpload(filename, declaredType, buf.length);
  if (basic) return { error: basic };
  const sniffed = sniffContentType(buf);
  if (!sniffed) return { error: "Không xác thực được nội dung tệp (magic bytes không hợp lệ)" };
  if (!STORAGE_CONFIG.allowedContentTypes.includes(sniffed)) {
    return { error: `Nội dung tệp không được phép: ${sniffed}` };
  }
  // MIME khai báo phải KHỚP nội dung thật (cho phép heic/heif tương đương).
  if (sniffed !== declaredType && !(sniffed === "image/heic" && declaredType.startsWith("image/"))) {
    return { error: `MIME khai báo (${declaredType}) không khớp nội dung thật (${sniffed})` };
  }
  return { contentType: sniffed };
}
