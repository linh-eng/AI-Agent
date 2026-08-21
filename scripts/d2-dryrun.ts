// =============================================================================
// D2 DRY-RUN — READ-ONLY. Đánh giá khả năng backfill tên nhân sự trong Booking
// (technician / master / assistants[]) sang employeeId, TRƯỚC khi làm migration.
//
// AN TOÀN TUYỆT ĐỐI:
//   * CHỈ SELECT (findMany/select). KHÔNG create/update/delete/execute DDL.
//   * KHÔNG migration, KHÔNG ALTER, KHÔNG ghi bất kỳ record nào.
//   * Chạy được trên DB production để lấy SỐ THẬT (chỉ đọc).
//
// Cách chạy trên máy production (sau git pull):
//   npm run d2:dryrun
// (đọc DATABASE_URL từ .env như app).
//
// Phân loại theo yêu cầu chủ:
//   TOTAL · UNIQUE MATCH · UNMATCHED · AMBIGUOUS · EMPTY/NULL
// Mẫu lỗi được CHE bớt (chỉ hiện vài ký tự đầu) — không phơi dữ liệu nhạy cảm.
// =============================================================================
import { prisma } from "@/lib/prisma";

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Che tên: giữ 2 ký tự đầu mỗi từ, phần còn lại thay bằng •
const mask = (s: string) =>
  s.trim().split(/\s+/).map((w) => (w.length <= 2 ? w : w.slice(0, 2) + "•".repeat(Math.min(3, w.length - 2)))).join(" ");

async function main() {
  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true, status: true } });
  const byName = new Map<string, { ids: string[]; active: string[] }>();
  for (const e of employees) {
    const k = norm(e.fullName);
    if (!k) continue;
    const cur = byName.get(k) ?? { ids: [], active: [] };
    cur.ids.push(e.id);
    if (e.status === "ACTIVE") cur.active.push(e.id);
    byName.set(k, cur);
  }
  const dupNames = [...byName.entries()].filter(([, v]) => v.ids.length > 1);

  const bookings = await prisma.booking.findMany({
    select: { id: true, technician: true, master: true, assistants: true },
  });

  const S = { TOTAL_BOOKINGS: bookings.length, SLOTS_TOTAL: 0, EMPTY_NULL: 0, UNIQUE_MATCH: 0, UNIQUE_MATCH_ACTIVE: 0, UNMATCHED: 0, AMBIGUOUS: 0 };
  const unmatchedSamples = new Set<string>();
  const ambiguousSamples = new Set<string>();

  const classify = (raw: string | null | undefined) => {
    const k = norm(raw);
    if (!k) { S.EMPTY_NULL++; return; }
    S.SLOTS_TOTAL++;
    const hit = byName.get(k);
    if (!hit) { S.UNMATCHED++; if (unmatchedSamples.size < 15) unmatchedSamples.add(mask(raw!)); return; }
    if (hit.ids.length > 1) { S.AMBIGUOUS++; if (ambiguousSamples.size < 15) ambiguousSamples.add(mask(raw!)); return; }
    S.UNIQUE_MATCH++;
    if (hit.active.length === 1) S.UNIQUE_MATCH_ACTIVE++;
  };

  for (const b of bookings) {
    classify(b.technician);
    classify(b.master);
    for (const a of (b.assistants ?? [])) classify(a);
  }

  const line = "─".repeat(64);
  console.log(line);
  console.log("D2 DRY-RUN (READ-ONLY) — Booking staff-name → employeeId");
  console.log("DB:", (process.env.DATABASE_URL || "").replace(/:\/\/[^@]+@/, "://***@").replace(/\?.*$/, ""));
  console.log(line);
  console.log("Nhân sự (Employee) tổng:", employees.length, "| ACTIVE:", employees.filter((e) => e.status === "ACTIVE").length);
  console.log("Tên nhân sự TRÙNG trong danh mục (≥2 người cùng tên):", dupNames.length,
    dupNames.length ? "→ " + dupNames.map(([, v]) => `×${v.ids.length}`).join(", ") : "(không có)");
  console.log(line);
  console.log("TOTAL (booking)          :", S.TOTAL_BOOKINGS);
  console.log("Slot nhân sự có giá trị  :", S.SLOTS_TOTAL, " | EMPTY/NULL (bỏ trống):", S.EMPTY_NULL);
  console.log(line);
  console.log("  UNIQUE MATCH  (an toàn):", S.UNIQUE_MATCH, `  (ACTIVE: ${S.UNIQUE_MATCH_ACTIVE})`);
  console.log("  UNMATCHED     (→ null) :", S.UNMATCHED);
  console.log("  AMBIGUOUS     (→ null) :", S.AMBIGUOUS);
  console.log(line);
  console.log("Mẫu UNMATCHED (đã che):", [...unmatchedSamples]);
  console.log("Mẫu AMBIGUOUS (đã che):", [...ambiguousSamples]);
  console.log(line);
  const anomalies: string[] = [];
  if (S.AMBIGUOUS > 0) anomalies.push(`${S.AMBIGUOUS} slot trùng tên — backfill PHẢI giữ null, cần rà tay.`);
  if (dupNames.length > 0) anomalies.push(`${dupNames.length} tên nhân sự trùng trong danh mục — cần phân biệt trước.`);
  if (S.UNMATCHED > 0) anomalies.push(`${S.UNMATCHED} slot tên không có trong danh mục nhân sự — giữ null + rà.`);
  console.log("ANOMALIES:", anomalies.length ? anomalies : "(không có — chỉ backfill UNIQUE MATCH)");
  console.log(line);
  console.log("Ghi nhớ: đây là DRY-RUN CHỈ ĐỌC. KHÔNG có record nào bị thay đổi.");
  console.log("Bước tiếp (RIÊNG, chờ chủ duyệt): backup → additive migration → backfill.");

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("Dry-run lỗi:", e?.message ?? e); await prisma.$disconnect(); process.exit(1); });
