// =============================================================================
// P3 — Lưu trữ blob RIÊNG TƯ. Interface StorageProvider tách khỏi hạ tầng:
//   * LocalStorageProvider: ghi vào thư mục ngoài public/ (không phục vụ tĩnh).
//   * Đổi sang S3/GCS về sau chỉ cần thêm một provider (put/get/delete) và
//     đọc STORAGE_DRIVER — KHÔNG đổi tầng API/DB.
// Truy cập chỉ qua /api/media/[id] có kiểm quyền — không có URL công khai.
// =============================================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { STORAGE_CONFIG } from "./config";

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private root: string;
  constructor(root: string) {
    this.root = root;
  }
  private full(key: string): string {
    // Chặn path traversal: chỉ cho phép ký tự an toàn trong key.
    if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes("..")) {
      throw new Error("storage key không hợp lệ");
    }
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
}

// Singleton provider theo cấu hình. (S3 provider sẽ thêm ở đây khi cần.)
export const storage: StorageProvider = new LocalStorageProvider(STORAGE_CONFIG.dir);

/** Sinh storage key phân tán theo tháng + uuid, giữ đuôi file an toàn. */
export function newStorageKey(filename: string): string {
  const ext = (path.extname(filename) || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${randomUUID()}${ext}`;
}

/** Suy ra MediaKind gợi ý từ contentType. */
export function kindFromContentType(ct: string): "IMAGE" | "VIDEO" | "FILE" {
  if (ct.startsWith("image/")) return "IMAGE";
  if (ct.startsWith("video/")) return "VIDEO";
  return "FILE";
}
