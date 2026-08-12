import { describe, it, expect, afterAll } from "vitest";
import { storage, newStorageKey, kindFromContentType } from "@/lib/storage";
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
});
