// =============================================================================
// IMPORT khách hàng (mục 41) — kiến trúc nhập liệu tổng quát: PHÂN TÍCH (validate
// + phát hiện trùng) rồi GHI. KHÔNG phụ thuộc schema nguồn (MySpa...): phía UI map
// cột nguồn → trường chuẩn, gửi các dòng đã map vào đây.
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

export interface RowAnalysis {
  index: number;
  status: RowStatus;
  errors: string[];
  matchedBy?: "phone" | "legacyId" | "batch"; // vì sao coi là trùng
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

/** "Nam"→MALE, "Nữ/Nu"→FEMALE, "Male/Female", else null. */
function parseGender(v: string): "MALE" | "FEMALE" | "OTHER" | null {
  const x = v.toLowerCase();
  if (!x) return null;
  if (["nam", "male", "m", "nam giới"].includes(x)) return "MALE";
  if (["nữ", "nu", "female", "f", "nữ giới"].includes(x)) return "FEMALE";
  if (["khác", "other", "o"].includes(x)) return "OTHER";
  return null;
}

/** Chấp nhận dd/MM/yyyy, d-M-yyyy, yyyy-MM-dd. Trả null nếu không hợp lệ. */
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
 * Phân tích (dry-run): validate từng dòng + phát hiện TRÙNG với khách đã có (theo
 * số điện thoại, hoặc legacyId + legacySource) và trùng NGAY TRONG lô nhập.
 */
export async function analyzeImportRows(
  rows: CustomerImportRow[],
  legacySource: string
): Promise<RowAnalysis[]> {
  const phones = rows.map((r) => s(r.phone)).filter(Boolean);
  const legacyIds = rows.map((r) => s(r.legacyId)).filter(Boolean);

  const [byPhone, byLegacy] = await Promise.all([
    phones.length
      ? prisma.customer.findMany({ where: { phone: { in: phones } }, select: { phone: true } })
      : Promise.resolve([]),
    legacyIds.length
      ? prisma.customer.findMany({ where: { legacyId: { in: legacyIds }, legacySource }, select: { legacyId: true } })
      : Promise.resolve([]),
  ]);
  const existPhones = new Set(byPhone.map((c) => c.phone));
  const existLegacy = new Set(byLegacy.map((c) => c.legacyId));

  const seenPhones = new Set<string>();
  const seenLegacy = new Set<string>();
  const out: RowAnalysis[] = [];

  rows.forEach((r, index) => {
    const errors: string[] = [];
    const fullName = s(r.fullName);
    const phone = s(r.phone) || null;
    const email = s(r.email) || null;
    const legacyId = s(r.legacyId) || null;

    if (!fullName) errors.push("Thiếu họ tên");
    if (email && !EMAIL_RE.test(email)) errors.push("Email không hợp lệ");
    const dobParsed = parseDob(s(r.dob));
    if (dobParsed === "INVALID") errors.push("Ngày sinh không hợp lệ (dd/MM/yyyy)");
    const dob = dobParsed === "INVALID" ? null : dobParsed;

    let status: RowStatus = "NEW";
    let matchedBy: RowAnalysis["matchedBy"];
    if (errors.length) {
      status = "ERROR";
    } else if (phone && (existPhones.has(phone) || seenPhones.has(phone))) {
      status = "DUPLICATE"; matchedBy = existPhones.has(phone) ? "phone" : "batch";
    } else if (legacyId && (existLegacy.has(legacyId) || seenLegacy.has(legacyId))) {
      status = "DUPLICATE"; matchedBy = existLegacy.has(legacyId) ? "legacyId" : "batch";
    }
    if (status === "NEW") {
      if (phone) seenPhones.add(phone);
      if (legacyId) seenLegacy.add(legacyId);
    }

    out.push({
      index,
      status,
      errors,
      matchedBy,
      normalized: {
        fullName,
        phone,
        email,
        dob,
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
  total: number;
  created: number;
  skippedDuplicate: number;
  errorRows: number;
  createdCodes: string[];
}

/** Ghi các dòng NEW (bỏ qua DUPLICATE & ERROR). Sinh mã KH tuần tự an toàn. */
export async function commitImport(
  rows: CustomerImportRow[],
  legacySource: string,
  createdBy?: string
): Promise<ImportReport> {
  const analysis = await analyzeImportRows(rows, legacySource);
  const toCreate = analysis.filter((a) => a.status === "NEW");

  const createdCodes: string[] = [];
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const base = await tx.customer.count();
    for (let i = 0; i < toCreate.length; i++) {
      const n = toCreate[i].normalized;
      const code = sequentialCode("KH", base + i);
      await tx.customer.create({
        data: {
          code,
          fullName: n.fullName,
          phone: n.phone,
          email: n.email,
          dob: n.dob,
          gender: n.gender ?? undefined,
          address: n.address,
          source: n.source,
          group: n.group,
          note: n.note,
          legacyId: n.legacyId,
          legacySource: n.legacyId ? legacySource : null,
        },
      });
      createdCodes.push(code);
    }
  });

  return {
    total: rows.length,
    created: createdCodes.length,
    skippedDuplicate: analysis.filter((a) => a.status === "DUPLICATE").length,
    errorRows: analysis.filter((a) => a.status === "ERROR").length,
    createdCodes,
  };
}
