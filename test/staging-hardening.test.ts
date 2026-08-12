// =============================================================================
// INF5 — Test cho phase Hạ tầng Staging:
//   * Bất biến version biểu mẫu/protocol (áp mẫu -> snapshot; đổi mẫu KHÔNG đổi bản đã áp).
//   * Xác thực upload theo MAGIC BYTES (không tin MIME/đuôi tệp).
//   * Chữ ký base64 -> đẩy lên storage (MediaAsset), DB không giữ base64.
//   * Logger REDACT bí mật (không lộ password/token/secret/URL ký).
// Chạy trên PostgreSQL thật (thng_test).
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateUploadBytes, sniffContentType } from "@/lib/storage";
import { persistInlineSignatures } from "@/lib/signature-storage";
import { __test as loggerTest } from "@/lib/logger";
import { resetDb, uniq, makeCustomer } from "./helpers";

// Magic bytes mẫu
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG_DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;

beforeAll(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("INF5 · Bất biến version biểu mẫu (Protocol/Form)", () => {
  it("áp mẫu -> snapshot schema+version; sửa mẫu lên V2 KHÔNG đổi bản đã áp (V1)", async () => {
    const template = await prisma.formTemplate.create({
      data: {
        code: uniq("FORM"), name: "Phiếu đánh giá da", version: 1, status: "ACTIVE",
        schema: { fields: [{ id: "f1", type: "SHORT_TEXT", label: "Tình trạng" }] },
      },
    });
    const customer = await makeCustomer();
    // Áp mẫu cho khách -> instance snapshot V1
    const instance = await prisma.formInstance.create({
      data: {
        templateId: template.id,
        templateVersion: template.version,
        schemaSnapshot: template.schema as any,
        customerId: customer.id,
        name: template.name,
      },
    });
    // Sửa template -> V2, schema khác
    await prisma.formTemplate.update({
      where: { id: template.id },
      data: { version: 2, schema: { fields: [{ id: "f1", type: "LONG_TEXT", label: "Tình trạng chi tiết" }, { id: "f2", type: "NUMBER", label: "Điểm" }] } },
    });
    // Instance cũ vẫn giữ nguyên V1 + schema V1 (bất biến)
    const after = await prisma.formInstance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(after.templateVersion).toBe(1);
    expect((after.schemaSnapshot as any).fields).toHaveLength(1);
    expect((after.schemaSnapshot as any).fields[0].type).toBe("SHORT_TEXT");
  });
});

describe("INF5 · Xác thực upload theo magic bytes", () => {
  it("nhận diện đúng loại theo chữ ký byte", () => {
    expect(sniffContentType(PNG)).toBe("image/png");
    expect(sniffContentType(JPEG)).toBe("image/jpeg");
    expect(sniffContentType(Buffer.from("hello world 1234"))).toBeNull();
  });

  it("chặn tệp thực thi ngụy trang thành ảnh (đuôi .png nhưng nội dung không phải ảnh)", () => {
    const fake = Buffer.from("MZ\x90\x00 this is a PE exe not an image....");
    const r = validateUploadBytes("anh.png", "image/png", fake);
    expect("error" in r).toBe(true);
  });

  it("chặn khi MIME khai báo KHÁC nội dung thật (JPEG thật, khai báo PNG)", () => {
    const r = validateUploadBytes("x.png", "image/png", JPEG);
    expect("error" in r).toBe(true);
  });

  it("chấp nhận ảnh PNG hợp lệ và trả contentType tin cậy", () => {
    const r = validateUploadBytes("x.png", "image/png", PNG);
    expect("contentType" in r && r.contentType).toBe("image/png");
  });
});

describe("INF5 · Chữ ký -> storage (không giữ base64 trong DB)", () => {
  it("persistInlineSignatures upload base64 lên MediaAsset và thay bằng mediaId", async () => {
    const customer = await makeCustomer();
    const data = {
      note: "ok",
      chuKyKhach: { dataUrl: PNG_DATA_URL, signedBy: "Nguyễn Văn A", signedAt: "2026-08-12T10:00:00Z" },
    };
    const out: any = await persistInlineSignatures(data, { customerId: customer.id, uploadedBy: "NV Test" });
    // dataUrl base64 đã bị loại; thay bằng mediaId; giữ signedBy/signedAt
    expect(out.chuKyKhach.dataUrl).toBeUndefined();
    expect(typeof out.chuKyKhach.mediaId).toBe("string");
    expect(out.chuKyKhach.signedBy).toBe("Nguyễn Văn A");
    // MediaAsset đã tạo, kind=SIGNATURE, RIÊNG TƯ
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: out.chuKyKhach.mediaId } });
    expect(asset.kind).toBe("SIGNATURE");
    expect(asset.sharedWithCustomer).toBe(false);
    expect(asset.customerId).toBe(customer.id);
    // JSON serialize không còn chứa chuỗi base64
    expect(JSON.stringify(out)).not.toContain("base64");
  });

  it("idempotent: chạy lại trên dữ liệu đã có mediaId không tạo asset mới", async () => {
    const before = await prisma.mediaAsset.count();
    const data = { sig: { mediaId: "abc", signedBy: "X" } };
    const out: any = await persistInlineSignatures(data, {});
    expect(out.sig.mediaId).toBe("abc");
    expect(await prisma.mediaAsset.count()).toBe(before);
  });
});

describe("INF5 · Logger redact bí mật", () => {
  it("che các khóa nhạy cảm và pattern token/URL ký", () => {
    const red: any = loggerTest.redact({
      email: "a@b.com",
      password: "sieu-bi-mat",
      passwordHash: "$2a$10$abcdef",
      s3SecretAccessKey: "AKIAxxxxSECRET",
      token: "eyJhbGciOi.J9.abc",
      note: "Bearer eyJabc.def.ghi trong header",
      url: "https://bucket.s3/obj?X-Amz-Signature=deadbeef&y=1",
    });
    expect(red.password).toBe("«redacted»");
    expect(red.passwordHash).toBe("«redacted»");
    expect(red.s3SecretAccessKey).toBe("«redacted»");
    expect(red.token).toBe("«redacted»");
    expect(red.email).toBe("a@b.com"); // không nhạy cảm -> giữ
    expect(String(red.note)).not.toContain("eyJabc.def.ghi");
    expect(String(red.url)).not.toContain("deadbeef");
  });
});
