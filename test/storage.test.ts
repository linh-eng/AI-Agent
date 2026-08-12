import { describe, it, expect, afterAll } from "vitest";
import { storage, newStorageKey, kindFromContentType, signBlobToken, verifyBlobToken, validateUpload } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

describe("P3 — lưu trữ media riêng tư", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("put/get roundtrip đúng nội dung", async () => {
    const key = newStorageKey("anh.png");
    const buf = Buffer.from("noi-dung-anh-test");
    await storage.put(key, buf, "image/png");
    const got = await storage.get(key);
    expect(got.toString()).toBe("noi-dung-anh-test");
    await storage.delete(key);
  });

  it("chặn path traversal trong storage key", async () => {
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/không hợp lệ/);
    await expect(storage.put("../evil", Buffer.from("x"), "image/png")).rejects.toThrow(/không hợp lệ/);
  });

  it("newStorageKey sinh khóa an toàn (yyyy/mm/uuid.ext)", () => {
    const k = newStorageKey("Ảnh Của Khách.JPG");
    expect(k).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.jpg$/);
  });

  it("kindFromContentType phân loại đúng", () => {
    expect(kindFromContentType("image/png")).toBe("IMAGE");
    expect(kindFromContentType("video/mp4")).toBe("VIDEO");
    expect(kindFromContentType("application/pdf")).toBe("FILE");
  });

  it("signed URL token: hợp lệ, chống giả mạo, chống hết hạn", () => {
    const key = "2026/01/abc.png";
    const good = signBlobToken(key, Math.floor(Date.now() / 1000) + 300);
    expect(verifyBlobToken(good)?.key).toBe(key);
    // Giả mạo chữ ký -> null
    expect(verifyBlobToken(good.slice(0, -2) + "xx")).toBeNull();
    // Hết hạn -> null
    const expired = signBlobToken(key, Math.floor(Date.now() / 1000) - 10);
    expect(verifyBlobToken(expired)).toBeNull();
  });

  it("validateUpload: chặn quá cỡ, MIME lạ, và đuôi thực thi", () => {
    expect(validateUpload("a.png", "image/png", 1000)).toBeNull(); // OK
    expect(validateUpload("a.png", "image/png", 999_999_999)).toMatch(/quá lớn/);
    expect(validateUpload("a.txt", "text/plain", 10)).toMatch(/không hỗ trợ/);
    // MIME ảnh nhưng đuôi thực thi/script -> chặn
    expect(validateUpload("evil.svg", "image/png", 10)).toMatch(/bị chặn/);
    expect(validateUpload("x.exe", "image/png", 10)).toMatch(/bị chặn/);
  });
});
