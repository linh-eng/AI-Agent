// =============================================================================
// IMPORT khách hàng (mục 12/41) — nhập liệu tổng quát: PHÂN TÍCH (chuẩn hóa +
// validate + phát hiện trùng theo THỨ TỰ ƯU TIÊN externalId→phone→email) rồi GHI
// (tạo mới, hoặc CẬP NHẬT khách trùng theo merge rule "chỉ điền chỗ trống"), có
// lưu vết ImportBatch + audit khi cập nhật. KHÔNG phụ thuộc schema nguồn: UI map
// cột nguồn → trường chuẩn rồi gửi các dòng đã map vào đây.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";

export interface CustomerImportRow {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  source?: string | null;
  group?: string | null;
  note?: string | null;
  legacyId?: string | null;
}

export type RowStatus = "NEW" | "DUPLICATE" | "ERROR";
export type PlannedAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";
export type ImportStrategy = "skip" | "update";

export interface RowAnalysis {
  index: number;
  status: RowStatus;
  action: PlannedAction; // hành động dự kiến theo chiến lược
  errors: string[];
  matchedBy?: "legacyId" | "phone" | "email" | "batch"; // vì sao coi là trùng (ưu tiên externalId→phone→email)
  matchedCustomerId?: string | null; // khách hiện hữu khớp (để cập nhật)
  normalized: {
    fullName: string;
    phone: string | null;
    email: string | null;
    dob: Date | null;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
    address: string | null;
    source: string | null;
    group: string | null;
    note: string | null;
    legacyId: string | null;
  };
}

function s(v: unknown): string {
  return (v ?? "").toString().trim();
}

/**
 * Chuẩn hóa SĐT Việt Nam: bỏ khoảng trắng/dấu chấm/gạch/ngoặc; đưa các dạng mã
 * quốc gia về 0 (+84… / 0084… / 84xxxxxxxxx). KHÔNG bịa/đệm số → không biến số sai
 * thành hợp lệ giả (chỉ đổi tiền tố mã quốc gia).
 */
export function normalizePhone(raw: unknown): string | null {
  let p = s(raw).replace(/[\s.\-()]/g, "");
  if (!p) return null;
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("0084")) p = "0" + p.slice(4);
  else if (/^84\d{9}$/.test(p)) p = "0" + p.slice(2); // 84 + 9 số → 0 + 9 số
  return p;
}

/** Chuẩn hóa email: trim + lowercase (đồng nhất với quy ước hệ thống). */
export function normalizeEmail(raw: unknown): string | null {
  const e = s(raw).toLowerCase();
  return e || null;
}

/** "Nam"→MALE, "Nữ/Nu"→FEMALE, "Male/Female", else null. */
function parseGender(v: string): "MALE" | "FEMALE" | "OTHER" | null {
  const x = v.toLowerCase();
  if (!x) return null;
  if (["nam", "male", "m", "nam giới"].includes(x)) return "MALE";
  if (["nữ", "nu", "female", "f", "nữ giới"].includes(x)) return "FEMALE";
  if (["khác", "other", "o"].includes(x)) return "OTHER";
  return null;
}

/** Chấp nhận dd/MM/yyyy, d-M-yyyy, yyyy-MM-dd. "INVALID" nếu mơ hồ/không hợp lệ. */
function parseDob(v: string): Date | null | "INVALID" {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  let y: number, m: number, d: number;
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else return "INVALID";
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return "INVALID";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "INVALID";
  return dt;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phân tích (dry-run): chuẩn hóa + validate + phát hiện TRÙNG với khách đã có theo
 * THỨ TỰ ƯU TIÊN: (1) externalId/legacyId (+ legacySource), (2) phone chuẩn hóa,
 * (3) email chuẩn hóa; và trùng NGAY TRONG lô. KHÔNG merge theo tên.
 * `strategy`: "skip" (bỏ qua trùng) | "update" (cập nhật khách trùng hiện hữu).
 */
export async function analyzeImportRows(
  rows: CustomerImportRow[],
  legacySource: string,
  strategy: ImportStrategy = "skip"
): Promise<RowAnalysis[]> {
  const normalizedRows = rows.map((r) => ({
    legacyId: s(r.legacyId) || null,
    phone: normalizePhone(r.phone),
    email: normalizeEmail(r.email),
  }));
  const phones = normalizedRows.map((r) => r.phone).filter((x): x is string => !!x);
  const emails = normalizedRows.map((r) => r.email).filter((x): x is string => !!x);
  const legacyIds = normalizedRows.map((r) => r.legacyId).filter((x): x is string => !!x);

  const [byPhone, byEmail, byLegacy] = await Promise.all([
    phones.length ? prisma.customer.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } }) : Promise.resolve([]),
    emails.length ? prisma.customer.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : Promise.resolve([]),
    legacyIds.length ? prisma.customer.findMany({ where: { legacyId: { in: legacyIds }, legacySource }, select: { id: true, legacyId: true } }) : Promise.resolve([]),
  ]);
  const phoneToId = new Map(byPhone.map((c) => [c.phone as string, c.id]));
  const emailToId = new Map(byEmail.map((c) => [c.email as string, c.id]));
  const legacyToId = new Map(byLegacy.map((c) => [c.legacyId as string, c.id]));

  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const seenLegacy = new Set<string>();
  const out: RowAnalysis[] = [];

  rows.forEach((r, index) => {
    const errors: string[] = [];
    const fullName = s(r.fullName);
    const phone = normalizePhone(r.phone);
    const email = normalizeEmail(r.email);
    const legacyId = s(r.legacyId) || null;

    if (!fullName) errors.push("Thiếu họ tên");
    if (email && !EMAIL_RE.test(email)) errors.push("Email không hợp lệ");
    const dobParsed = parseDob(s(r.dob));
    if (dobParsed === "INVALID") errors.push("Ngày sinh không hợp lệ (dd/MM/yyyy)");
    const dob = dobParsed === "INVALID" ? null : dobParsed;

    let status: RowStatus = "NEW";
    let matchedBy: RowAnalysis["matchedBy"];
    let matchedCustomerId: string | null = null;

    if (errors.length) {
      status = "ERROR";
    } else {
      // Ưu tiên externalId → phone → email (khách hiện hữu trước, rồi trùng trong lô).
      if (legacyId && legacyToId.has(legacyId)) { status = "DUPLICATE"; matchedBy = "legacyId"; matchedCustomerId = legacyToId.get(legacyId)!; }
      else if (phone && phoneToId.has(phone)) { status = "DUPLICATE"; matchedBy = "phone"; matchedCustomerId = phoneToId.get(phone)!; }
      else if (email && emailToId.has(email)) { status = "DUPLICATE"; matchedBy = "email"; matchedCustomerId = emailToId.get(email)!; }
      else if (legacyId && seenLegacy.has(legacyId)) { status = "DUPLICATE"; matchedBy = "batch"; }
      else if (phone && seenPhone.has(phone)) { status = "DUPLICATE"; matchedBy = "batch"; }
      else if (email && seenEmail.has(email)) { status = "DUPLICATE"; matchedBy = "batch"; }
    }
    if (status === "NEW") {
      if (phone) seenPhone.add(phone);
      if (email) seenEmail.add(email);
      if (legacyId) seenLegacy.add(legacyId);
    }

    const action: PlannedAction =
      status === "ERROR" ? "ERROR"
      : status === "NEW" ? "CREATE"
      : strategy === "update" && matchedCustomerId ? "UPDATE" // chỉ cập nhật khách HIỆN HỮU
      : "SKIP";

    out.push({
      index, status, action, errors, matchedBy, matchedCustomerId,
      normalized: {
        fullName, phone, email, dob,
        gender: parseGender(s(r.gender)),
        address: s(r.address) || null,
        source: s(r.source) || null,
        group: s(r.group) || null,
        note: s(r.note) || null,
        legacyId,
      },
    });
  });
  return out;
}

export interface ImportReport {
  batchCode: string;
  batchId: string;
  total: number;
  created: number;
  updated: number;
  skippedDuplicate: number;
  errorRows: number;
  createdCodes: string[];
  updatedCodes: string[];
  errors: { index: number; reason: string; data: CustomerImportRow }[];
}

export interface CommitOptions {
  legacySource: string;
  strategy?: ImportStrategy;
  filename?: string | null;
  mapping?: unknown;
  createdBy?: string | null;
}

// Trường được phép điền khi CẬP NHẬT (merge "chỉ điền chỗ trống").
const MERGE_FIELDS: Array<keyof RowAnalysis["normalized"]> = ["phone", "email", "dob", "gender", "address", "source", "group", "note", "legacyId"];

/**
 * Ghi import: tạo dòng NEW; nếu strategy="update" thì CẬP NHẬT khách trùng hiện hữu
 * theo merge rule "chỉ điền field đang trống" (KHÔNG ghi đè dữ liệu đang có bằng
 * blank/dữ liệu yếu hơn) + audit từng field đổi. Lưu ImportBatch để truy vết.
 */
export async function commitImport(rows: CustomerImportRow[], opts: CommitOptions): Promise<ImportReport> {
  const strategy: ImportStrategy = opts.strategy ?? "skip";
  const analysis = await analyzeImportRows(rows, opts.legacySource, strategy);
  const batchCode = sequentialCode("IMP", await prisma.importBatch.count());

  const createdCodes: string[] = [];
  const updatedCodes: string[] = [];
  const errors = analysis
    .filter((a) => a.status === "ERROR")
    .map((a) => ({ index: a.index, reason: a.errors.join("; "), data: rows[a.index] }));

  const batch = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1) Tạo mới
    const toCreate = analysis.filter((a) => a.action === "CREATE");
    const base = await tx.customer.count();
    for (let i = 0; i < toCreate.length; i++) {
      const n = toCreate[i].normalized;
      const code = sequentialCode("KH", base + i);
      await tx.customer.create({
        data: {
          code, fullName: n.fullName, phone: n.phone, email: n.email, dob: n.dob,
          gender: n.gender ?? undefined, address: n.address, source: n.source,
          group: n.group, note: n.note,
          legacyId: n.legacyId, legacySource: n.legacyId ? opts.legacySource : null,
        },
      });
      createdCodes.push(code);
    }

    // 2) Cập nhật khách trùng (chỉ khi strategy=update) — merge "điền chỗ trống" + audit
    const toUpdate = analysis.filter((a) => a.action === "UPDATE" && a.matchedCustomerId);
    for (const a of toUpdate) {
      const cur = await tx.customer.findUnique({ where: { id: a.matchedCustomerId! } });
      if (!cur) continue;
      const data: Record<string, unknown> = {};
      const diff: Record<string, { before: unknown; after: unknown }> = {};
      for (const f of MERGE_FIELDS) {
        const incoming = a.normalized[f];
        const existing = (cur as any)[f];
        // Chỉ điền khi field hiện đang TRỐNG và có giá trị import → KHÔNG ghi đè dữ liệu tốt hơn.
        const existingEmpty = existing === null || existing === undefined || existing === "";
        if (incoming != null && incoming !== "" && existingEmpty) {
          data[f] = incoming;
          diff[f] = { before: existing ?? null, after: incoming instanceof Date ? incoming.toISOString() : incoming };
        }
      }
      if (a.normalized.legacyId && data.legacyId) data.legacySource = opts.legacySource;
      if (Object.keys(data).length > 0) {
        await tx.customer.update({ where: { id: cur.id }, data });
        updatedCodes.push(cur.code);
        // audit: source=IMPORT + diff từng field (mục 10 X)
        await tx.auditLog.create({
          data: {
            action: "CUSTOMER_IMPORT_UPDATED",
            entityType: "Customer",
            entityId: cur.id,
            changes: { source: "IMPORT", batchCode, diff } as any,
          },
        });
      }
    }

    // 3) Lưu vết ImportBatch
    return tx.importBatch.create({
      data: {
        code: batchCode,
        source: opts.legacySource,
        filename: opts.filename ?? null,
        strategy: strategy.toUpperCase(),
        mapping: (opts.mapping ?? null) as any,
        total: rows.length,
        created: createdCodes.length,
        updated: updatedCodes.length,
        skipped: analysis.filter((x) => x.action === "SKIP").length,
        errorRows: errors.length,
        createdCodes: createdCodes as any,
        updatedCodes: updatedCodes as any,
        errors: errors as any,
        importedBy: opts.createdBy ?? null,
      },
    });
  });

  return {
    batchCode: batch.code,
    batchId: batch.id,
    total: rows.length,
    created: createdCodes.length,
    updated: updatedCodes.length,
    skippedDuplicate: analysis.filter((x) => x.action === "SKIP").length,
    errorRows: errors.length,
    createdCodes,
    updatedCodes,
    errors,
  };
}
