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
    await client.send(new PutObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key, Body: data, ContentType: contentType }));
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
