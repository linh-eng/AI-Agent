// =============================================================================
// DATA-IO — Khung NHẬP / XUẤT CSV dùng chung cho dữ liệu DANH MỤC / MASTER.
// Mục tiêu: đổ dữ liệu nhanh (bulk) cho các danh mục an toàn — KHÔNG import dữ
// liệu giao dịch/sổ cái (hóa đơn/thanh toán/buổi/ledger) để bảo toàn tính đúng.
//
// Cơ chế:
//  * Đăng ký (registry) mỗi thực thể: model + khóa tự nhiên (mã) + cột + quyền.
//  * XUẤT: đọc DB → CSV (FK hiển thị bằng MÃ, không phải id — dễ đọc/round-trip).
//  * MẪU: chỉ dòng tiêu đề.
//  * XEM TRƯỚC (dry-run): kiểm tra + phân loại Thêm mới / Cập nhật / Lỗi.
//  * NHẬP: UPSERT theo khóa tự nhiên (KHÔNG xóa dữ liệu ngoài file — an toàn).
// Additive thuần — KHÔNG migration, KHÔNG đổi schema.
// =============================================================================
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// CSV parse / serialize (hỗ trợ dấu ngoặc kép, phẩy & xuống dòng trong ô).
// ---------------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // bỏ dòng rỗng cuối
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
type ColType = "string" | "number" | "boolean" | "date" | "enum" | "list";
type Ref = { model: string; codeField: string; fk: string };
export type Col = { key: string; header: string; type?: ColType; required?: boolean; enum?: string[]; ref?: Ref; note?: string };
export type Dataset = {
  key: string; label: string; group: string; model: string; naturalKey: string;
  readPerm: string; writePerm?: string; // không có writePerm → chỉ XUẤT
  columns: Col[];
  transform?: (data: any) => any; // chỉnh data trước khi upsert (vd đồng bộ isActive)
};

const GENDER = ["MALE", "FEMALE", "OTHER"];
const EMP_STATUS = ["ACTIVE", "ON_LEAVE", "RESIGNED"];
const RES_TYPE = ["ROOM", "BED", "MACHINE"];
const SVC_STATUS = ["ACTIVE", "PAUSED", "ARCHIVED"];
const PROD_TYPE = ["PROFESSIONAL", "HOME_CARE", "BOTH"];
const VOUCHER_TYPE = ["FIXED", "PERCENT"];
const KPI_CAT = ["PRODUCTIVITY", "QUALITY", "ATTENDANCE", "CUSTOMER", "SALES", "OPERATIONAL"];
const KPI_CALC = ["COUNT_DISTINCT", "SUM", "AVERAGE", "RATIO", "COUNT"];
const KPI_SRC = ["CONTRIBUTION", "ATTENDANCE", "SESSION", "REVIEW", "LEAVE", "MANUAL"];
const KPI_DIR = ["HIGHER_BETTER", "LOWER_BETTER", "NEUTRAL"];
const PC_KIND = ["EARNING", "DEDUCTION"];
const PC_CALC = ["FIXED", "PERCENT_BASE", "PERCENT_GROSS"];
const PC_SCOPE = ["COMPANY", "ROLE", "EMPLOYEE"];

export const DATASETS: Record<string, Dataset> = {
  "membership-tiers": {
    key: "membership-tiers", label: "Hạng thành viên", group: "Khách hàng thân thiết", model: "membershipTier", naturalKey: "code",
    readPerm: "loyalty.read", writePerm: "loyalty.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "minLifetimeSpend", header: "minLifetimeSpend", type: "number" }, { key: "pointsPerThousand", header: "pointsPerThousand", type: "number" },
      { key: "discountPercent", header: "discountPercent", type: "number" }, { key: "sortOrder", header: "sortOrder", type: "number" }, { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
  vouchers: {
    key: "vouchers", label: "Voucher", group: "Khách hàng thân thiết", model: "voucher", naturalKey: "code",
    readPerm: "loyalty.read", writePerm: "loyalty.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "type", header: "type", type: "enum", enum: VOUCHER_TYPE, required: true }, { key: "value", header: "value", type: "number", required: true },
      { key: "maxDiscount", header: "maxDiscount", type: "number" }, { key: "minSpend", header: "minSpend", type: "number" },
      { key: "maxRedemptions", header: "maxRedemptions", type: "number" }, { key: "expiresAt", header: "expiresAt", type: "date" },
    ],
  },
  customers: {
    key: "customers", label: "Khách hàng", group: "Khách hàng & Hành trình", model: "customer", naturalKey: "code",
    readPerm: "customer.read", writePerm: "customer.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "fullName", header: "fullName", required: true },
      { key: "phone", header: "phone" }, { key: "email", header: "email" }, { key: "gender", header: "gender", type: "enum", enum: GENDER },
      { key: "dob", header: "dob", type: "date" }, { key: "source", header: "source" }, { key: "group", header: "group" },
      { key: "assignedTo", header: "assignedTo" }, { key: "note", header: "note" },
    ],
  },
  "service-categories": {
    key: "service-categories", label: "Nhóm dịch vụ", group: "Thư viện chuyên môn", model: "serviceCategory", naturalKey: "code",
    readPerm: "service.read", writePerm: "service.write",
    columns: [{ key: "code", header: "code", required: true }, { key: "name", header: "name", required: true }, { key: "description", header: "description" }, { key: "isActive", header: "isActive", type: "boolean" }],
  },
  services: {
    key: "services", label: "Dịch vụ", group: "Thư viện chuyên môn", model: "service", naturalKey: "code",
    readPerm: "service.read", writePerm: "service.write",
    transform: (d) => ({ ...d, ...(d.status ? { isActive: d.status === "ACTIVE" } : {}) }),
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "categoryCode", header: "categoryCode", ref: { model: "serviceCategory", codeField: "code", fk: "categoryId" } },
      { key: "durationMinutes", header: "durationMinutes", type: "number" }, { key: "standardPrice", header: "standardPrice", type: "number" },
      { key: "expectedCost", header: "expectedCost", type: "number" }, { key: "status", header: "status", type: "enum", enum: SVC_STATUS },
    ],
  },
  "spa-products": {
    key: "spa-products", label: "Sản phẩm spa", group: "Thư viện chuyên môn", model: "spaProduct", naturalKey: "sku",
    readPerm: "library.read", writePerm: "catalog.write",
    columns: [
      { key: "sku", header: "sku", required: true }, { key: "name", header: "name", required: true },
      { key: "brandCode", header: "brandCode", ref: { model: "brand", codeField: "code", fk: "brandId" } },
      { key: "category", header: "category" }, { key: "productType", header: "productType", type: "enum", enum: PROD_TYPE },
      { key: "sellingPrice", header: "sellingPrice", type: "number" }, { key: "cost", header: "cost", type: "number" }, { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
  technologies: {
    key: "technologies", label: "Công nghệ", group: "Thư viện chuyên môn", model: "technology", naturalKey: "code",
    readPerm: "library.read", writePerm: "technology.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true }, { key: "group", header: "group" },
      { key: "brandCode", header: "brandCode", ref: { model: "brand", codeField: "code", fk: "brandId" } },
      { key: "deviceModel", header: "deviceModel" }, { key: "area", header: "area" }, { key: "durationMinutes", header: "durationMinutes", type: "number" }, { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
  brands: {
    key: "brands", label: "Thương hiệu", group: "Thư viện chuyên môn", model: "brand", naturalKey: "code",
    readPerm: "library.read", writePerm: "brand.write",
    columns: [{ key: "code", header: "code", required: true }, { key: "name", header: "name", required: true }, { key: "description", header: "description" }, { key: "isActive", header: "isActive", type: "boolean" }],
  },
  "booking-resources": {
    key: "booking-resources", label: "Tài nguyên (phòng/giường/máy)", group: "Khách hàng & Hành trình", model: "bookingResource", naturalKey: "code",
    readPerm: "booking.read", writePerm: "booking.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "type", header: "type", type: "enum", enum: RES_TYPE, required: true },
      { key: "parentCode", header: "parentCode", ref: { model: "bookingResource", codeField: "code", fk: "parentId" } },
      { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
  employees: {
    key: "employees", label: "Nhân sự", group: "Vận hành & Hệ thống", model: "employee", naturalKey: "code",
    readPerm: "staff.read", writePerm: "staff.write",
    transform: (d) => ({ ...d, ...(d.status ? { isActive: d.status === "ACTIVE" } : {}) }),
    columns: [
      { key: "code", header: "code", required: true }, { key: "fullName", header: "fullName", required: true },
      { key: "phone", header: "phone" }, { key: "email", header: "email" }, { key: "title", header: "title" },
      { key: "roles", header: "roles", type: "list" }, { key: "branch", header: "branch" },
      { key: "status", header: "status", type: "enum", enum: EMP_STATUS }, { key: "dob", header: "dob", type: "date" }, { key: "startDate", header: "startDate", type: "date" },
    ],
  },
  "kpi-definitions": {
    key: "kpi-definitions", label: "Định nghĩa KPI", group: "Vận hành & Hệ thống", model: "kpiDefinition", naturalKey: "code",
    readPerm: "attendance.read", writePerm: "attendance.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "category", header: "category", type: "enum", enum: KPI_CAT, required: true }, { key: "unit", header: "unit" },
      { key: "calculationType", header: "calculationType", type: "enum", enum: KPI_CALC }, { key: "sourceType", header: "sourceType", type: "enum", enum: KPI_SRC },
      { key: "direction", header: "direction", type: "enum", enum: KPI_DIR }, { key: "sortOrder", header: "sortOrder", type: "number" }, { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
  "payroll-component-rules": {
    key: "payroll-component-rules", label: "Phụ cấp / Khấu trừ lương", group: "Vận hành & Hệ thống", model: "payrollComponentRule", naturalKey: "code",
    readPerm: "payroll.read", writePerm: "payroll.write",
    columns: [
      { key: "code", header: "code", required: true }, { key: "name", header: "name", required: true },
      { key: "kind", header: "kind", type: "enum", enum: PC_KIND, required: true }, { key: "calcType", header: "calcType", type: "enum", enum: PC_CALC },
      { key: "value", header: "value", type: "number", required: true }, { key: "scope", header: "scope", type: "enum", enum: PC_SCOPE }, { key: "scopeRef", header: "scopeRef" }, { key: "isActive", header: "isActive", type: "boolean" },
    ],
  },
};

const m = (model: string) => (prisma as any)[model];

// ---------------------------------------------------------------------------
// Format 1 giá trị khi XUẤT.
// ---------------------------------------------------------------------------
function fmt(val: any, type?: ColType): string {
  if (val == null) return "";
  if (type === "date") { const d = new Date(val); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }
  if (type === "boolean") return val ? "true" : "false";
  if (type === "list") return Array.isArray(val) ? val.join("|") : String(val);
  if (type === "number") return String(Number(val));
  return String(val);
}

/** XUẤT toàn bộ bản ghi của 1 dataset → CSV (FK hiển thị bằng mã). */
export async function exportDataset(key: string): Promise<string> {
  const ds = DATASETS[key];
  if (!ds) throw new Error("Dataset không tồn tại");
  const rows = await m(ds.model).findMany({ orderBy: { [ds.naturalKey]: "asc" } });
  // prefetch id→code cho các cột ref
  const refMaps = new Map<string, Map<string, string>>();
  for (const c of ds.columns) if (c.ref) {
    if (!refMaps.has(c.ref.model)) {
      const refRows = await m(c.ref.model).findMany({ select: { id: true, [c.ref.codeField]: true } });
      refMaps.set(c.ref.model, new Map(refRows.map((r: any) => [r.id, r[c.ref!.codeField]])));
    }
  }
  const header = ds.columns.map((c) => c.header);
  const out = rows.map((row: any) => ds.columns.map((c) => {
    if (c.ref) { const id = row[c.ref.fk]; return id ? refMaps.get(c.ref.model)!.get(id) ?? "" : ""; }
    return fmt(row[c.key], c.type);
  }));
  return toCsv(header, out);
}

/** Dòng tiêu đề (mẫu). */
export function templateCsv(key: string): string {
  const ds = DATASETS[key];
  if (!ds) throw new Error("Dataset không tồn tại");
  return ds.columns.map((c) => c.header).join(",");
}

// ---------------------------------------------------------------------------
// Coerce 1 ô khi NHẬP.
// ---------------------------------------------------------------------------
function coerce(raw: string, c: Col): { value: any } | { error: string } {
  const v = (raw ?? "").trim();
  if (v === "") return { value: undefined };
  switch (c.type) {
    case "number": { const n = Number(v.replace(/[, ]/g, "")); if (isNaN(n)) return { error: `${c.header}: không phải số` }; return { value: n }; }
    case "boolean": return { value: /^(true|1|yes|có|x)$/i.test(v) };
    case "date": { const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v); if (isNaN(d.getTime())) return { error: `${c.header}: ngày không hợp lệ (yyyy-MM-dd)` }; return { value: d }; }
    case "enum": if (!c.enum!.includes(v)) return { error: `${c.header}: phải thuộc [${c.enum!.join("/")}]` }; return { value: v };
    case "list": return { value: v.split(/[|,]/).map((x) => x.trim()).filter(Boolean) };
    default: return { value: v };
  }
}

type RowResult = { index: number; status: "NEW" | "UPDATE" | "ERROR"; errors: string[]; key?: string };

async function buildRows(ds: Dataset, header: string[], dataRows: string[][]) {
  // map header → cột (theo header trùng, không phân biệt hoa/thường)
  const colByHeader = new Map(ds.columns.map((c) => [c.header.toLowerCase(), c]));
  const idx = header.map((h) => colByHeader.get(h.trim().toLowerCase()));
  // prefetch code→id cho ref
  const refCodeMaps = new Map<string, Map<string, string>>();
  for (const c of ds.columns) if (c.ref && !refCodeMaps.has(c.ref.model)) {
    const rr = await m(c.ref.model).findMany({ select: { id: true, [c.ref.codeField]: true } });
    refCodeMaps.set(c.ref.model, new Map(rr.map((r: any) => [String(r[c.ref!.codeField]), r.id])));
  }
  const built: { data: any; naturalVal?: string; errors: string[] }[] = [];
  for (const cells of dataRows) {
    const data: any = {}; const errors: string[] = [];
    idx.forEach((c, i) => {
      if (!c) return; // cột không nhận dạng → bỏ qua
      const res = coerce(cells[i] ?? "", c);
      if ("error" in res) { errors.push(res.error); return; }
      if (res.value === undefined) return;
      if (c.ref) { const id = refCodeMaps.get(c.ref.model)!.get(String(res.value)); if (!id) errors.push(`${c.header}: mã "${res.value}" không tồn tại`); else data[c.ref.fk] = id; }
      else data[c.key] = res.value;
    });
    for (const c of ds.columns) if (c.required && (data[c.key] == null && !(c.ref && data[c.ref.fk]))) errors.push(`Thiếu ${c.header}`);
    const naturalVal = data[ds.naturalKey];
    built.push({ data: ds.transform ? ds.transform(data) : data, naturalVal, errors });
  }
  return built;
}

/** Xem trước (dry-run): phân loại Thêm mới / Cập nhật / Lỗi. */
export async function previewImport(key: string, header: string[], dataRows: string[][]): Promise<{ results: RowResult[]; counts: { willCreate: number; willUpdate: number; willError: number } }> {
  const ds = DATASETS[key];
  if (!ds) throw new Error("Dataset không tồn tại");
  const built = await buildRows(ds, header, dataRows);
  const keys = built.map((b) => b.naturalVal).filter(Boolean);
  const existing = keys.length ? await m(ds.model).findMany({ where: { [ds.naturalKey]: { in: keys } }, select: { [ds.naturalKey]: true } }) : [];
  const existSet = new Set(existing.map((e: any) => String(e[ds.naturalKey])));
  const results: RowResult[] = built.map((b, i) => {
    if (b.errors.length) return { index: i, status: "ERROR", errors: b.errors };
    return { index: i, status: existSet.has(String(b.naturalVal)) ? "UPDATE" : "NEW", errors: [], key: b.naturalVal };
  });
  return { results, counts: { willCreate: results.filter((r) => r.status === "NEW").length, willUpdate: results.filter((r) => r.status === "UPDATE").length, willError: results.filter((r) => r.status === "ERROR").length } };
}

/** NHẬP: UPSERT theo khóa tự nhiên. Bỏ qua dòng lỗi. KHÔNG xóa dữ liệu ngoài file. */
export async function commitImport(key: string, header: string[], dataRows: string[][]): Promise<{ total: number; created: number; updated: number; skippedError: number; errors: { index: number; reason: string }[] }> {
  const ds = DATASETS[key];
  if (!ds) throw new Error("Dataset không tồn tại");
  const built = await buildRows(ds, header, dataRows);
  let created = 0, updated = 0, skippedError = 0;
  const errors: { index: number; reason: string }[] = [];
  for (let i = 0; i < built.length; i++) {
    const b = built[i];
    if (b.errors.length) { skippedError++; errors.push({ index: i, reason: b.errors.join("; ") }); continue; }
    const val = b.naturalVal;
    const { [ds.naturalKey]: _k, ...updateData } = b.data;
    try {
      const existed = await m(ds.model).findUnique({ where: { [ds.naturalKey]: val }, select: { id: true } });
      await m(ds.model).upsert({ where: { [ds.naturalKey]: val }, create: b.data, update: updateData });
      if (existed) updated++; else created++;
    } catch (e) { skippedError++; errors.push({ index: i, reason: (e as Error).message.slice(0, 200) }); }
  }
  return { total: built.length, created, updated, skippedError, errors };
}

/** Danh sách dataset (cho UI) — chỉ những cái người dùng có quyền đọc. */
export function listDatasets(perms: string[]) {
  return Object.values(DATASETS)
    .filter((d) => perms.includes(d.readPerm))
    .map((d) => ({ key: d.key, label: d.label, group: d.group, canWrite: !!d.writePerm && perms.includes(d.writePerm), columns: d.columns.map((c) => ({ header: c.header, required: !!c.required, type: c.type ?? "string", enum: c.enum, ref: c.ref ? c.ref.model : undefined })) }));
}
