// =============================================================================
// Protocol / Form Builder — định nghĩa schema biểu mẫu động + logic điều kiện.
// Dùng chung cho builder (thiết kế) và renderer (điền instance).
// Pure TS, không phụ thuộc server — an toàn import ở client component.
// =============================================================================

export type FieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "CURRENCY"
  | "PERCENTAGE"
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "DROPDOWN"
  | "RADIO"
  | "CHECKBOX"
  | "MULTI_SELECT"
  | "YES_NO"
  | "RATING"
  | "SLIDER"
  | "MEASUREMENT"
  | "IMAGE"
  | "BEFORE_IMAGE"
  | "AFTER_IMAGE"
  | "VIDEO"
  | "FILE"
  | "SIGNATURE"
  | "SERVICE"
  | "TECHNOLOGY"
  | "PRODUCT"
  | "MATERIAL"
  | "EMPLOYEE"
  | "BODY_AREA"
  | "TABLE"
  | "REPEATING_GROUP"
  | "CALCULATED";

export interface FieldTypeMeta {
  value: FieldType;
  label: string;
  group: "Cơ bản" | "Lựa chọn" | "Đo lường" | "Media" | "Liên kết" | "Nâng cao";
  hasOptions?: boolean; // cần danh sách lựa chọn
  isEntity?: boolean; // select nạp từ dữ liệu hệ thống
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { value: "SHORT_TEXT", label: "Văn bản ngắn", group: "Cơ bản" },
  { value: "LONG_TEXT", label: "Văn bản dài", group: "Cơ bản" },
  { value: "NUMBER", label: "Số", group: "Cơ bản" },
  { value: "CURRENCY", label: "Tiền tệ", group: "Cơ bản" },
  { value: "PERCENTAGE", label: "Phần trăm", group: "Cơ bản" },
  { value: "DATE", label: "Ngày", group: "Cơ bản" },
  { value: "DATETIME", label: "Ngày giờ", group: "Cơ bản" },
  { value: "TIME", label: "Giờ", group: "Cơ bản" },
  { value: "DROPDOWN", label: "Danh sách lựa chọn", group: "Lựa chọn", hasOptions: true },
  { value: "RADIO", label: "Nút chọn (một)", group: "Lựa chọn", hasOptions: true },
  { value: "CHECKBOX", label: "Ô lựa chọn", group: "Lựa chọn", hasOptions: true },
  { value: "MULTI_SELECT", label: "Chọn nhiều", group: "Lựa chọn", hasOptions: true },
  { value: "YES_NO", label: "Có / Không", group: "Lựa chọn" },
  { value: "RATING", label: "Rating (sao)", group: "Đo lường" },
  { value: "SLIDER", label: "Thanh trượt", group: "Đo lường" },
  { value: "MEASUREMENT", label: "Chỉ số đo (giá trị + đơn vị)", group: "Đo lường" },
  { value: "IMAGE", label: "Hình ảnh", group: "Media" },
  { value: "BEFORE_IMAGE", label: "Ảnh trước", group: "Media" },
  { value: "AFTER_IMAGE", label: "Ảnh sau", group: "Media" },
  { value: "VIDEO", label: "Video", group: "Media" },
  { value: "FILE", label: "Tệp đính kèm", group: "Media" },
  { value: "SIGNATURE", label: "Chữ ký", group: "Media" },
  { value: "SERVICE", label: "Dịch vụ", group: "Liên kết", isEntity: true },
  { value: "TECHNOLOGY", label: "Công nghệ", group: "Liên kết", isEntity: true },
  { value: "PRODUCT", label: "Sản phẩm", group: "Liên kết", isEntity: true },
  { value: "MATERIAL", label: "Vật tư", group: "Liên kết", isEntity: true },
  { value: "EMPLOYEE", label: "Nhân viên", group: "Liên kết" },
  { value: "BODY_AREA", label: "Vùng cơ thể", group: "Liên kết", hasOptions: true },
  { value: "TABLE", label: "Bảng", group: "Nâng cao" },
  { value: "REPEATING_GROUP", label: "Nhóm lặp", group: "Nâng cao" },
  { value: "CALCULATED", label: "Trường tính toán", group: "Nâng cao" },
];

export const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPES.map((f) => [f.value, f.label])
);

export interface FieldOption {
  label: string;
  value: string;
}

export type CalcOp =
  | "sum"
  | "avg"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "percentage";

export interface CalcConfig {
  op: CalcOp;
  fields: string[]; // id các field số tham chiếu (theo thứ tự chọn)
}

export const CALC_OP_LABEL: Record<CalcOp, string> = {
  sum: "Tổng (Σ)",
  avg: "Trung bình",
  add: "Cộng (a+b+…)",
  subtract: "Trừ (a−b−…)",
  multiply: "Nhân (a×b×…)",
  divide: "Chia (a÷b)",
  percentage: "Phần trăm (a÷b×100)",
};

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: FieldOption[]; // cho DROPDOWN/RADIO/CHECKBOX/MULTI_SELECT/BODY_AREA
  unit?: string; // cho MEASUREMENT
  min?: number; // SLIDER/NUMBER
  max?: number;
  columns?: string[]; // cho TABLE (tên cột)
  subFields?: FormField[]; // cho REPEATING_GROUP
  calc?: CalcConfig; // cho CALCULATED
}

export interface FormGroup {
  id: string;
  title?: string;
  fields: FormField[];
}

export interface FormSection {
  id: string;
  title: string;
  tab?: string; // tên tab (gộp section theo tab)
  groups: FormGroup[];
}

export type LogicOp = "eq" | "neq" | "gt" | "lt" | "contains" | "empty" | "notEmpty";
export type LogicAction = "show" | "hide" | "require";

export interface LogicCondition {
  fieldId: string;
  op: LogicOp;
  value?: any;
}

export interface LogicRule {
  id: string;
  match: "ALL" | "ANY"; // AND / OR
  conditions: LogicCondition[];
  action: LogicAction;
  targets: string[]; // id field/section chịu tác động
}

export interface FormSchema {
  sections: FormSection[];
  logic: LogicRule[];
}

export function emptySchema(): FormSchema {
  return { sections: [], logic: [] };
}

// --- Sinh id ổn định (không dùng Math.random ở server workflow, nhưng đây là
//     client/runtime bình thường; vẫn thêm bộ đếm để tránh trùng trong 1 tick).
let _seq = 0;
export function genId(prefix = "f"): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

export function newField(type: FieldType): FormField {
  const meta = FIELD_TYPES.find((f) => f.value === type);
  const base: FormField = { id: genId("fld"), type, label: meta?.label ?? "Trường mới" };
  if (meta?.hasOptions) {
    base.options = [
      { label: "Lựa chọn 1", value: "opt1" },
      { label: "Lựa chọn 2", value: "opt2" },
    ];
  }
  if (type === "MEASUREMENT") base.unit = "mm";
  if (type === "SLIDER") { base.min = 0; base.max = 100; }
  if (type === "CALCULATED") base.calc = { op: "sum", fields: [] };
  return base;
}

export function newGroup(): FormGroup {
  return { id: genId("grp"), title: "", fields: [] };
}
export function newSection(title = "Mục mới"): FormSection {
  return { id: genId("sec"), title, groups: [newGroup()] };
}

/** Liệt kê mọi field trong schema (phẳng). */
export function allFields(schema: FormSchema): FormField[] {
  const out: FormField[] = [];
  for (const s of schema.sections) for (const g of s.groups) for (const f of g.fields) out.push(f);
  return out;
}

function toNumber(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function evalCondition(c: LogicCondition, values: Record<string, any>): boolean {
  const v = values[c.fieldId];
  switch (c.op) {
    case "eq": return String(v ?? "") === String(c.value ?? "");
    case "neq": return String(v ?? "") !== String(c.value ?? "");
    case "gt": return toNumber(v) > toNumber(c.value);
    case "lt": return toNumber(v) < toNumber(c.value);
    case "contains":
      if (Array.isArray(v)) return v.map(String).includes(String(c.value));
      return String(v ?? "").includes(String(c.value ?? ""));
    case "empty": return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    case "notEmpty": return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    default: return false;
  }
}

export interface LogicResult {
  hidden: Set<string>; // id bị ẩn
  required: Set<string>; // id bắt buộc bổ sung
}

/** Đánh giá conditional logic -> tập id bị ẩn / bắt buộc thêm. */
export function evaluateLogic(schema: FormSchema, values: Record<string, any>): LogicResult {
  const hidden = new Set<string>();
  const required = new Set<string>();
  for (const rule of schema.logic ?? []) {
    if (!rule.conditions?.length) continue;
    const results = rule.conditions.map((c) => evalCondition(c, values));
    const pass = rule.match === "ANY" ? results.some(Boolean) : results.every(Boolean);
    if (rule.action === "show") {
      // show: nếu KHÔNG pass thì ẩn targets
      if (!pass) rule.targets.forEach((t) => hidden.add(t));
    } else if (rule.action === "hide") {
      if (pass) rule.targets.forEach((t) => hidden.add(t));
    } else if (rule.action === "require") {
      if (pass) rule.targets.forEach((t) => required.add(t));
    }
  }
  return { hidden, required };
}

/**
 * Tính giá trị field CALCULATED — engine AN TOÀN (KHÔNG dùng eval).
 * Hỗ trợ: sum, avg, add, subtract, multiply, divide, percentage.
 */
export function computeCalc(field: FormField, values: Record<string, any>): number {
  const cfg = field.calc;
  if (!cfg || !cfg.fields.length) return 0;
  const nums = cfg.fields.map((id) => toNumber(values[id]));
  const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
  switch (cfg.op) {
    case "sum":
    case "add":
      return round2(nums.reduce((a, b) => a + b, 0));
    case "avg":
      return round2(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
    case "multiply":
      return round2(nums.reduce((a, b) => a * b, 1));
    case "subtract":
      return round2(nums.slice(1).reduce((a, b) => a - b, nums[0] ?? 0));
    case "divide": {
      const [a, b] = nums;
      return b ? round2(a / b) : 0;
    }
    case "percentage": {
      const [a, b] = nums;
      return b ? round2((a / b) * 100) : 0;
    }
    default:
      return 0;
  }
}

/** Danh sách tab (unique) theo thứ tự xuất hiện; section không tab -> "Chung". */
export function schemaTabs(schema: FormSchema): string[] {
  const tabs: string[] = [];
  for (const s of schema.sections) {
    const t = s.tab?.trim() || "Chung";
    if (!tabs.includes(t)) tabs.push(t);
  }
  return tabs;
}
