import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq } from "./helpers";
import { analyzeImportRows, commitImport, normalizePhone, normalizeEmail } from "@/lib/import-customers";

const opt = (over: Partial<{ strategy: "skip" | "update"; createdBy: string }> = {}) => ({ legacySource: "MySpa", createdBy: "Tester", ...over });

describe("Import khách hàng (mục 12)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("D · normalize phone (+84/84/0/khoảng trắng) không bịa số", () => {
    expect(normalizePhone("+84 90 123 4567")).toBe("0901234567");
    expect(normalizePhone("84901234567")).toBe("0901234567");
    expect(normalizePhone("0084901234567")).toBe("0901234567");
    expect(normalizePhone(" 0901234567 ")).toBe("0901234567");
    expect(normalizePhone("090.123.4567")).toBe("0901234567");
    expect(normalizePhone("")).toBeNull();
    expect(normalizeEmail("  ABC@Example.COM ")).toBe("abc@example.com");
  });

  it("A/E · validate: thiếu họ tên / email sai / ngày sinh sai → ERROR; hợp lệ → NEW", async () => {
    const a = await analyzeImportRows([
      { fullName: "", phone: "0900000001" },
      { fullName: "OK", email: "not-an-email" },
      { fullName: "OK2", dob: "32/13/2020" },
      { fullName: "OK3", dob: "15/03/1990" },
    ], "MySpa");
    expect(a.map((x) => x.status)).toEqual(["ERROR", "ERROR", "ERROR", "NEW"]);
    expect(a[3].normalized.dob?.toISOString().slice(0, 10)).toBe("1990-03-15");
  });

  it("F/G · duplicate ưu tiên externalId→phone→email; KHÔNG merge theo tên", async () => {
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Đã có", phone: "0901112222", email: "have@x.com", legacyId: "MYSPA-1", legacySource: "MySpa" } });
    const a = await analyzeImportRows([
      { fullName: "Trùng externalId", legacyId: "MYSPA-1", phone: "0999999999" }, // legacyId ưu tiên
      { fullName: "Trùng phone (+84)", phone: "+84901112222" },                  // normalize → trùng phone
      { fullName: "Trùng email hoa", email: "HAVE@X.COM" },                       // normalize → trùng email
      { fullName: "Đã có" },                                                      // TRÙNG TÊN nhưng không có key → NEW (không merge theo tên)
      { fullName: "Mới hẳn", phone: "0903334444" },
      { fullName: "Trùng trong lô", phone: "0903334444" },
    ], "MySpa");
    expect(a[0].matchedBy).toBe("legacyId");
    expect(a[1].matchedBy).toBe("phone");
    expect(a[2].matchedBy).toBe("email");
    expect(a[3].status).toBe("NEW"); // trùng tên đơn thuần KHÔNG coi là duplicate
    expect(a[4].status).toBe("NEW");
    expect(a[5].matchedBy).toBe("batch");
  });

  it("I/K · commit skip: chỉ tạo NEW; lưu ImportBatch + báo cáo lỗi có dòng/lý do", async () => {
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Có", phone: "0900000009" } });
    const report = await commitImport([
      { fullName: "Nguyễn A", phone: "+84 901 000 001", gender: "Nam", dob: "10/10/1995", legacyId: "MS-1" },
      { fullName: "Trần B", phone: "0900000009" }, // trùng SĐT
      { fullName: "" },                            // lỗi
    ], opt());
    expect(report.created).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.skippedDuplicate).toBe(1);
    expect(report.errorRows).toBe(1);
    expect(report.errors[0]).toMatchObject({ index: 2, reason: expect.stringContaining("họ tên") });
    expect(report.batchCode).toMatch(/^IMP-/);

    const created = await prisma.customer.findFirst({ where: { legacyId: "MS-1" } });
    expect(created?.phone).toBe("0901000001"); // đã normalize
    expect(created?.gender).toBe("MALE");
    expect(created?.legacySource).toBe("MySpa");

    // ImportBatch persist
    const batch = await prisma.importBatch.findUnique({ where: { code: report.batchCode } });
    expect(batch).toBeTruthy();
    expect(batch!.total).toBe(3);
    expect(batch!.created).toBe(1);
    expect(batch!.errorRows).toBe(1);
    expect(batch!.strategy).toBe("SKIP");
    expect(batch!.importedBy).toBe("Tester");
  });

  it("J · update mode: điền CHỖ TRỐNG, KHÔNG ghi đè dữ liệu đang có; audit field cũ→mới", async () => {
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách", phone: "0905550001", email: null, address: null, source: "Cũ tốt" } });
    const report = await commitImport([
      // trùng theo phone; email/address đang trống → điền; source đang có "Cũ tốt" → KHÔNG ghi đè
      { fullName: "Khách", phone: "0905550001", email: "New@Mail.com", address: "123 ABC", source: "IMPORT-YẾU" },
    ], opt({ strategy: "update" }));
    expect(report.updated).toBe(1);
    expect(report.created).toBe(0);

    const after = await prisma.customer.findUnique({ where: { id: cust.id } });
    expect(after!.email).toBe("new@mail.com"); // điền chỗ trống (normalize)
    expect(after!.address).toBe("123 ABC");     // điền chỗ trống
    expect(after!.source).toBe("Cũ tốt");       // KHÔNG ghi đè dữ liệu đang có

    // audit field-level source=IMPORT
    const audit = await prisma.auditLog.findFirst({ where: { action: "CUSTOMER_IMPORT_UPDATED", entityId: cust.id } });
    expect(audit).toBeTruthy();
    const ch: any = audit!.changes;
    expect(ch.source).toBe("IMPORT");
    expect(ch.diff.email).toMatchObject({ before: null, after: "new@mail.com" });
    expect(ch.diff.source).toBeUndefined(); // không đổi source đang có
  });

  it("M · idempotency: import lại CÙNG dữ liệu không tạo trùng hàng loạt", async () => {
    const rows = [
      { fullName: "A", phone: "0906660001", legacyId: "EXT-1" },
      { fullName: "B", email: "b@x.com" },
    ];
    const r1 = await commitImport(rows, opt());
    expect(r1.created).toBe(2);
    const r2 = await commitImport(rows, opt()); // import lại cùng file
    expect(r2.created).toBe(0);
    expect(r2.skippedDuplicate).toBe(2);
    // tổng khách vẫn = 2 (không nhân đôi)
    expect(await prisma.customer.count()).toBe(2);
  });

  it("P · birthday: khách import có DOB hợp lệ → dùng được cho logic sinh nhật (dob lưu đúng)", async () => {
    await commitImport([{ fullName: "Sinh nhật", phone: "0907770001", dob: "20/08/1996" }], opt());
    const c = await prisma.customer.findFirst({ where: { phone: "0907770001" } });
    expect(c!.dob?.toISOString().slice(0, 10)).toBe("1996-08-20");
    expect(c!.isActive).toBe(true); // xuất hiện trong danh sách + logic sinh nhật (isActive + dob)
  });
});
