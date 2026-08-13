import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq } from "./helpers";
import { analyzeImportRows, commitImport } from "@/lib/import-customers";

describe("Import khách hàng (mục 41)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("validate: thiếu họ tên / email sai / ngày sinh sai → ERROR", async () => {
    const a = await analyzeImportRows([
      { fullName: "", phone: "0900000001" },
      { fullName: "OK", email: "not-an-email" },
      { fullName: "OK2", dob: "32/13/2020" },
      { fullName: "OK3", dob: "15/03/1990" },
    ], "MySpa");
    expect(a[0].status).toBe("ERROR");
    expect(a[1].status).toBe("ERROR");
    expect(a[2].status).toBe("ERROR");
    expect(a[3].status).toBe("NEW");
    expect(a[3].normalized.dob?.toISOString().slice(0, 10)).toBe("1990-03-15");
  });

  it("phát hiện trùng theo SĐT (đã có) và trong lô", async () => {
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Đã có", phone: "0901112222" } });
    const a = await analyzeImportRows([
      { fullName: "Trùng SĐT cũ", phone: "0901112222" },
      { fullName: "Mới", phone: "0903334444" },
      { fullName: "Trùng trong lô", phone: "0903334444" },
    ], "MySpa");
    expect(a[0].status).toBe("DUPLICATE");
    expect(a[0].matchedBy).toBe("phone");
    expect(a[1].status).toBe("NEW");
    expect(a[2].status).toBe("DUPLICATE");
    expect(a[2].matchedBy).toBe("batch");
  });

  it("phát hiện trùng theo legacyId + legacySource", async () => {
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Cũ", legacyId: "MYSPA-1", legacySource: "MySpa" } });
    const a = await analyzeImportRows([
      { fullName: "X", legacyId: "MYSPA-1" }, // trùng
      { fullName: "Y", legacyId: "MYSPA-2" }, // mới
    ], "MySpa");
    expect(a[0].status).toBe("DUPLICATE");
    expect(a[0].matchedBy).toBe("legacyId");
    expect(a[1].status).toBe("NEW");
  });

  it("commit: chỉ tạo NEW, bỏ qua trùng/lỗi; gán legacyId/legacySource + parse giới tính", async () => {
    await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Có", phone: "0900000009" } });
    const report = await commitImport([
      { fullName: "Nguyễn A", phone: "0901000001", gender: "Nam", dob: "10/10/1995", legacyId: "MS-1" },
      { fullName: "Trần B", phone: "0900000009" }, // trùng SĐT
      { fullName: "" }, // lỗi
    ], "MySpa", "Tester");
    expect(report.created).toBe(1);
    expect(report.skippedDuplicate).toBe(1);
    expect(report.errorRows).toBe(1);

    const created = await prisma.customer.findFirst({ where: { phone: "0901000001" } });
    expect(created?.gender).toBe("MALE");
    expect(created?.legacyId).toBe("MS-1");
    expect(created?.legacySource).toBe("MySpa");
    expect(created?.dob?.toISOString().slice(0, 10)).toBe("1995-10-10");
  });
});
