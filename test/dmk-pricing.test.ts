// =============================================================================
// Giá lẻ dịch vụ DMK (DV01–DV09) + giảm giá VIP — assert seed source-of-truth
// khớp "Bảng giá trị liệu DMK gợi ý cho đại lý" (retail = cột GIÁ LẺ; VIP = cột
// GIÁ 3 buổi trở lên, thấp hơn). Pure/deterministic — đọc seed data, không cần DB.
// =============================================================================
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const SEED = readFileSync(join(__dirname, "..", "prisma", "seed-demo.ts"), "utf8");

// Parse the dmkPrices literal → { DVxx: {retail, vip} }
function prices(): Record<string, { retail: number; vip: number }> {
  const start = SEED.indexOf("const dmkPrices");
  const end = SEED.indexOf("\n  };", start);
  const body = SEED.slice(start, end);
  const out: Record<string, { retail: number; vip: number }> = {};
  const re = /(DV0\d):\s*\{\s*retail:\s*([\d_]+),\s*vip:\s*([\d_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    out[m[1]] = { retail: Number(m[2].replace(/_/g, "")), vip: Number(m[3].replace(/_/g, "")) };
  }
  return out;
}
const P = prices();

// Bảng giá đúng theo PDF khách gửi (retail = giá lẻ; vip = 3 buổi trở lên).
const EXPECTED: Record<string, { retail: number; vip: number }> = {
  DV01: { retail: 450_000, vip: 360_000 },
  DV02: { retail: 450_000, vip: 360_000 },
  DV03: { retail: 700_000, vip: 560_000 },
  DV04: { retail: 1_150_000, vip: 950_000 },
  DV05: { retail: 630_000, vip: 500_000 },
  DV06: { retail: 980_000, vip: 780_000 },
  DV07: { retail: 1_650_000, vip: 1_350_000 },
  DV08: { retail: 1_050_000, vip: 850_000 },
  DV09: { retail: 2_150_000, vip: 1_750_000 },
};

describe("Giá lẻ + VIP dịch vụ DMK (DV01–DV09)", () => {
  it("có đủ 9 dịch vụ với giá", () => {
    expect(Object.keys(P).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [dv, exp] of Object.entries(EXPECTED)) {
    it(`${dv}: giá lẻ ${exp.retail.toLocaleString("vi-VN")} · VIP ${exp.vip.toLocaleString("vi-VN")}`, () => {
      expect(P[dv]).toBeTruthy();
      expect(P[dv].retail).toBe(exp.retail);
      expect(P[dv].vip).toBe(exp.vip);
      // VIP luôn thấp hơn giá lẻ (là mức giảm giá)
      expect(P[dv].vip).toBeLessThan(P[dv].retail);
    });
  }

  it("VIP là PriceRule priceType VIP gắn với dịch vụ DMK (không đổi giá lẻ)", () => {
    expect(SEED).toContain('priceType: "VIP"');
    expect(SEED).toContain('code: "DV-DMK-" + key');
    // upsert update giá lẻ khi chạy lại (cập nhật giá lẻ)
    expect(SEED).toContain("update: { standardPrice: p.retail }");
  });
});
