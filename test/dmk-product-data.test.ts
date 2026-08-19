// =============================================================================
// PRODUCT DETAIL DATA CORRECTION — data-integrity assertions on the DMK seed
// (prisma/seed-demo.ts `dmkProducts`). Guards the source-of-truth product
// records against cross-field leakage, alias-as-canonical, package-size-as-dosage,
// wrong-field placement and fabricated/unsourced wording. Pure/deterministic —
// asserts the seed data itself, no DB required.
// =============================================================================
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const SEED = readFileSync(join(__dirname, "..", "prisma", "seed-demo.ts"), "utf8");

// Slice the `const dmkProducts = [ ... ];` literal, then split into per-product blocks.
function productBlocks(): Record<string, string> {
  const start = SEED.indexOf("const dmkProducts = [");
  expect(start).toBeGreaterThan(-1);
  const end = SEED.indexOf("\n  ];", start);
  const body = SEED.slice(start, end);
  const parts = body.split(/\{ sku: "/).slice(1); // drop preamble
  const out: Record<string, string> = {};
  for (const p of parts) {
    const sku = p.slice(0, p.indexOf('"'));
    out[sku] = "{ sku: \"" + p; // keep full object text
  }
  return out;
}
const P = productBlocks();

// Read a single field value out of a product block (best-effort, non-greedy to next `",`).
function field(block: string, key: string): string | null {
  const m = block.match(new RegExp(key + ': "((?:[^"\\\\]|\\\\.)*)"'));
  return m ? m[1] : null;
}

describe("PRODUCT DETAIL DATA CORRECTION — DMK seed invariants", () => {
  it("1. Actrol Powder — source-backed wording (khóa viêm), no unsourced claims", () => {
    const b = P["SP-DMK-ACTROL"];
    expect(b).toBeTruthy();
    expect(field(b, "category")).toContain("khóa viêm");
    const benefits = field(b, "benefits")!;
    expect(benefits).toContain("khóa viêm");
    expect(benefits).not.toContain("tẩy tế bào chết");
    expect(benefits).not.toContain("kháng khuẩn"); // not source-backed for Actrol
  });

  it("2. Beta Gel — NOT classified as home-care-only (has professional/recovery context)", () => {
    const b = P["SP-DMK-BETAGEL"];
    expect(field(b, "type")).toBe("BOTH");
    expect(b).not.toContain('type: "HOME_CARE"');
    expect(field(b, "category")).not.toContain("home-care");
  });

  it("3. Pore Reduction — canonical name (no 'Plus' as canonical)", () => {
    const b = P["SP-DMK-PORERED"];
    expect(field(b, "name")).toBe("DMK Pore Reduction");
    expect(SEED).not.toContain('name: "DMK Pore Reduction Plus"');
  });

  it("4. Alias does NOT create a new Product ID (exactly one PORERED record)", () => {
    const occurrences = SEED.split('sku: "SP-DMK-PORERED"').length - 1;
    expect(occurrences).toBe(1);
    // and no separate SKU coined from the alias wording
    expect(SEED).not.toContain("SP-DMK-PORERED-PLUS");
  });

  it("5. Pro Alpha #1 — shows quantity 2 ml", () => {
    const b = P["SP-DMK-PROALPHA1"];
    expect(field(b, "usage")).toMatch(/2\s?ml/);
  });

  it("6. Pro Alpha #1 — verified contraindication (Da quá nhiều dầu)", () => {
    const b = P["SP-DMK-PROALPHA1"];
    expect(field(b, "contraindications")).toContain("nhiều dầu");
  });

  it("7. Prozyme — heat/moisture condition is NOT a contraindication; page-backed CĐ is 'Da khô thiếu dầu'", () => {
    const b = P["SP-DMK-PROZYME"];
    const ci = field(b, "contraindications")!;
    expect(ci).toMatch(/^Da khô thiếu dầu\.?$/);
    expect(ci).not.toContain("ủ nóng");
    expect(ci).not.toContain("đủ ẩm");
    // the heat/moisture note lives in usage (a usage condition), not contraindications
    expect(field(b, "usage")).toContain("ĐỦ NHIỆT");
  });

  it("8. Prozyme — monograph timing 15-25 not merged with Acne Body 5-15", () => {
    const b = P["SP-DMK-PROZYME"];
    const usage = field(b, "usage")!;
    expect(usage).toContain("15-25");
    expect(usage).not.toContain("5-15");
  });

  it("9. Quick Peel — keeps total contact time 3-5 phút", () => {
    const b = P["SP-DMK-QUICKPEEL"];
    expect(field(b, "usage")).toContain("3-5");
  });

  it("10. Quick Peel — contraindication present (Da mỏng yếu, dễ đỏ)", () => {
    const b = P["SP-DMK-QUICKPEEL"];
    const ci = field(b, "contraindications");
    expect(ci).toBeTruthy();
    expect(ci).toContain("mỏng yếu");
  });

  it("11. Sebum Soak — professional directions separated from home-use guidance", () => {
    const b = P["SP-DMK-SEBUM"];
    expect(field(b, "usage")).toContain("Chuyên nghiệp"); // professional directions
    expect(field(b, "frequency")).toContain("Tại nhà"); // home-care guidance
  });

  it("12. Epitoxyl — professional dosage separated from home frequency", () => {
    const b = P["SP-DMK-EPITOXYL"];
    expect(field(b, "usage")).toContain("Chuyên nghiệp");
    expect(field(b, "usage")).toMatch(/1\s?ml/);
    expect(field(b, "frequency")).toContain("1-2 lần/tuần");
  });

  it("13. Package size (volume) is never a drop-based dosage", () => {
    for (const [sku, b] of Object.entries(P)) {
      const vol = field(b, "volume");
      if (vol) {
        expect(vol, `${sku} volume`).not.toContain("giọt");
        expect(vol, `${sku} volume`).toMatch(/\d+\s?(ml|g)$/i);
      }
    }
  });

  it("15. Missing-source fields are NOT auto-populated (Pro Alpha #2 left blank)", () => {
    const b = P["SP-DMK-PROALPHA2"];
    // intentionally has only ingredients + benefits; no indication/CĐ/usage invented
    expect(field(b, "suitableFor")).toBeNull();
    expect(field(b, "contraindications")).toBeNull();
    expect(field(b, "usage")).toBeNull();
  });

  it("bonus — Melanotech / Enbioment reclassified BOTH (professional dosing present)", () => {
    expect(field(P["SP-DMK-MELANOTECH"], "type")).toBe("BOTH");
    expect(field(P["SP-DMK-ENBIOMENT"], "type")).toBe("BOTH");
  });
});
