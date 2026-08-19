// =============================================================================
// Nhập liệu hàng loạt bằng Excel (.xlsx) cho: Sản phẩm, Tài sản, Nhập kho, Xuất kho.
//  - SPECS: khai báo cột (dùng chung để SINH form mẫu + ĐỌC/kiểm tra khi nhập).
//  - buildTemplate: tạo file .xlsx mẫu (sheet dữ liệu trống + sheet Hướng dẫn có ví dụ).
//  - importX: đọc từng dòng, tra cứu tham chiếu theo mã/tên, tái dùng đúng service tạo
//    phiếu (createReceipt/createIssue giữ FEFO + sinh lô + bút toán), báo lỗi theo dòng.
// =============================================================================
import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { productCreateSchema, assetCreateSchema } from "./validation";
import { createReceipt } from "./inbound-service";
import { createIssue } from "./outbound-service";
import { nextAssetCode } from "./codes";

export type Entity = "product" | "asset" | "inbound" | "outbound";

interface Col {
  key: string;
  header: string;
  example: string | number;
  required?: boolean;
  note?: string;
}
interface Spec {
  label: string;
  sheet: string;
  perm: string; // quyền cần để nhập
  grouped?: boolean; // phiếu nhiều dòng (gộp theo cột "group")
  cols: Col[];
  guide: string[];
}

export interface ImportError {
  row: string; // số dòng Excel hoặc mã phiếu
  message: string;
}
export interface ImportResult {
  created: number;
  total: number;
  errors: ImportError[];
}

// ---------------------------------------------------------------------------
// Khai báo cột cho từng loại
// ---------------------------------------------------------------------------
export const SPECS: Record<Entity, Spec> = {
  product: {
    label: "Sản phẩm",
    sheet: "SanPham",
    perm: "product.write",
    cols: [
      { key: "sku", header: "Mã SKU", example: "SR-VITC-30", required: true },
      { key: "name", header: "Tên sản phẩm", example: "Serum Vitamin C 30ml", required: true },
      { key: "categoryCode", header: "Nhóm hàng", example: "SKINCARE", note: "Mã hoặc tên nhóm hàng đã có trong hệ thống" },
      { key: "brand", header: "Thương hiệu", example: "Dermalogica" },
      { key: "trackingMode", header: "Chế độ tồn", example: "LOT", note: "LOT (theo lô) hoặc QUANTITY (số lượng)" },
      { key: "requiresExpiry", header: "Theo dõi HSD", example: "Có", note: "Có / Không" },
      { key: "isTester", header: "Hàng tester", example: "Không", note: "Có / Không" },
      { key: "uom", header: "Đơn vị tính", example: "Chai" },
      { key: "minStock", header: "Định mức tồn", example: 10 },
      { key: "expiryAlertDays", header: "Ngưỡng cảnh báo HSD (ngày)", example: 60 },
      { key: "barcode", header: "Mã vạch", example: "" },
      { key: "note", header: "Ghi chú", example: "" },
    ],
    guide: [
      "Mỗi dòng là 1 sản phẩm. Không xóa dòng tiêu đề.",
      "Nhóm hàng / Thương hiệu phải đã tồn tại trong hệ thống (nhập theo mã hoặc tên).",
      "Chế độ tồn: LOT = quản lý theo lô + HSD; QUANTITY = chỉ theo số lượng.",
      "Số (định mức, ngày cảnh báo) nhập số thường, không dấu chấm/phẩy phân cách.",
    ],
  },
  asset: {
    label: "Tài sản / Thiết bị",
    sheet: "TaiSan",
    perm: "asset.write",
    cols: [
      { key: "productSku", header: "Mã SKU thiết bị", example: "MAY-XONGHOI", required: true, note: "SKU của sản phẩm loại thiết bị đã có" },
      { key: "serialNumber", header: "Số serial", example: "XH-2024-001" },
      { key: "status", header: "Trạng thái", example: "IN_USE", note: "IN_STOCK / IN_USE / MAINTENANCE / RETIRED" },
      { key: "warehouseCode", header: "Kho", example: "KHO-TONG", note: "Mã hoặc tên kho" },
      { key: "supplierCode", header: "Nhà cung cấp", example: "NCC-SPAPRO", note: "Mã hoặc tên NCC" },
      { key: "location", header: "Vị trí đặt", example: "Phòng trị liệu 1" },
      { key: "purchaseDate", header: "Ngày mua", example: "2024-01-15", note: "yyyy-mm-dd hoặc dd/mm/yyyy" },
      { key: "warrantyUntil", header: "Hạn bảo hành", example: "2026-01-15" },
      { key: "cost", header: "Nguyên giá", example: 25000000 },
      { key: "salvageValue", header: "Giá trị thu hồi", example: 2000000 },
      { key: "depreciationStart", header: "Bắt đầu khấu hao", example: "2024-01-15" },
      { key: "depreciationMonths", header: "Số tháng khấu hao", example: 60 },
      { key: "depreciationMethod", header: "PP khấu hao", example: "STRAIGHT_LINE", note: "STRAIGHT_LINE / DECLINING / UNITS" },
      { key: "depreciationTotalUnits", header: "Tổng sản lượng ước tính", example: "" },
      { key: "warrantyVendor", header: "Đơn vị bảo hành", example: "Cty An Phát" },
      { key: "warrantyMonths", header: "Thời gian BH (tháng)", example: 24 },
      { key: "maintenanceCycleMonths", header: "Chu kỳ bảo trì (tháng)", example: 6 },
      { key: "contractValue", header: "Giá trị hợp đồng", example: 25000000 },
      { key: "managementType", header: "Hình thức quản lý", example: "CONTRACT", note: "DEBT / INVOICE / CONTRACT" },
      { key: "note", header: "Ghi chú", example: "" },
    ],
    guide: [
      "Mỗi dòng là 1 thiết bị/tài sản (theo serial). Mã tài sản tự sinh.",
      "Mã SKU thiết bị phải là sản phẩm đã tạo trong Danh mục sản phẩm.",
      "Các cột khấu hao/bảo hành/hợp đồng có thể để trống nếu chưa quản lý.",
      "Ngày nhập dạng yyyy-mm-dd (2024-01-15) hoặc dd/mm/yyyy (15/01/2024).",
    ],
  },
  inbound: {
    label: "Nhập kho",
    sheet: "NhapKho",
    perm: "inbound.write",
    grouped: true,
    cols: [
      { key: "group", header: "Mã phiếu (gộp dòng)", example: "PN-A", required: true, note: "Các dòng cùng mã = 1 phiếu nhập" },
      { key: "supplierCode", header: "Nhà cung cấp", example: "NCC-COSMEDIX", required: true, note: "Mã hoặc tên NCC" },
      { key: "warehouseCode", header: "Kho nhập", example: "KHO-TONG", required: true },
      { key: "note", header: "Ghi chú phiếu", example: "" },
      { key: "productSku", header: "Mã SKU", example: "SR-VITC-30", required: true },
      { key: "batchCode", header: "Mã lô", example: "LOT-VITC-A", note: "Bắt buộc nếu sản phẩm theo lô (LOT)" },
      { key: "expiryDate", header: "HSD", example: "2026-06-30", note: "Bắt buộc nếu sản phẩm yêu cầu HSD" },
      { key: "mfgDate", header: "Ngày sản xuất", example: "" },
      { key: "quantity", header: "Số lượng", example: 40, required: true },
      { key: "unitCost", header: "Giá vốn", example: 180000 },
    ],
    guide: [
      "MỖI DÒNG là 1 dòng hàng. Các dòng có cùng 'Mã phiếu (gộp dòng)' sẽ gộp thành 1 phiếu nhập.",
      "Nhà cung cấp / Kho / Ghi chú lấy theo dòng ĐẦU TIÊN của mỗi mã phiếu.",
      "Sản phẩm theo lô bắt buộc có Mã lô; sản phẩm yêu cầu HSD bắt buộc có HSD.",
      "Ghi sổ ngay khi nhập: tự sinh/cộng lô + bút toán nhập kho.",
    ],
  },
  outbound: {
    label: "Xuất kho",
    sheet: "XuatKho",
    perm: "outbound.write",
    grouped: true,
    cols: [
      { key: "group", header: "Mã phiếu (gộp dòng)", example: "PX-A", required: true, note: "Các dòng cùng mã = 1 phiếu xuất" },
      { key: "warehouseCode", header: "Kho xuất", example: "KHO-TONG", required: true },
      { key: "issueType", header: "Loại xuất", example: "SALE", required: true, note: "SALE / INTERNAL_USE / DISPOSAL / ADJUSTMENT" },
      { key: "customerName", header: "Khách hàng", example: "" },
      { key: "note", header: "Ghi chú phiếu", example: "" },
      { key: "productSku", header: "Mã SKU", example: "SR-VITC-30", required: true },
      { key: "quantity", header: "Số lượng", example: 2, required: true },
    ],
    guide: [
      "MỖI DÒNG là 1 dòng hàng. Các dòng cùng 'Mã phiếu (gộp dòng)' gộp thành 1 phiếu xuất.",
      "Kho / Loại xuất / Khách hàng / Ghi chú lấy theo dòng ĐẦU TIÊN của mỗi mã phiếu.",
      "Hệ thống tự phân bổ lô theo FEFO (hết hạn trước xuất trước); chặn xuất vượt tồn.",
      "Loại xuất: SALE=bán, INTERNAL_USE=dùng nội bộ, DISPOSAL=hủy, ADJUSTMENT=điều chỉnh.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Ép kiểu giá trị ô Excel
// ---------------------------------------------------------------------------
const str = (v: any): string => (v == null ? "" : String(v).trim());
function num(v: any): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d,.-]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return isNaN(n) ? undefined : n;
}
function bool(v: any): boolean {
  const s = str(v).toLowerCase();
  return ["có", "co", "x", "true", "1", "yes", "y"].includes(s);
}
function toISODate(v: any): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = str(v);
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}
function mapEnum(v: any, map: Record<string, string>): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const up = s.toUpperCase();
  const known = Object.values(map);
  if (known.includes(up)) return up;
  const low = s.toLowerCase();
  return map[low];
}
const TRACKING = { "theo lô": "LOT", "lô": "LOT", "lo": "LOT", "số lượng": "QUANTITY", "so luong": "QUANTITY", lot: "LOT", quantity: "QUANTITY" } as Record<string, string>;
const STATUS = { "trong kho": "IN_STOCK", "đang dùng": "IN_USE", "bảo trì": "MAINTENANCE", "thanh lý": "RETIRED" } as Record<string, string>;
const METHOD = { "đường thẳng": "STRAIGHT_LINE", "số dư giảm dần": "DECLINING", "theo sản lượng": "UNITS" } as Record<string, string>;
const MANAGE = { "công nợ": "DEBT", "hóa đơn": "INVOICE", "hợp đồng": "CONTRACT" } as Record<string, string>;
const ISSUE = { "bán": "SALE", "bán hàng": "SALE", "nội bộ": "INTERNAL_USE", "dùng nội bộ": "INTERNAL_USE", "hủy": "DISPOSAL", "điều chỉnh": "ADJUSTMENT" } as Record<string, string>;

// ---------------------------------------------------------------------------
// Sinh form mẫu (.xlsx)
// ---------------------------------------------------------------------------
export function buildTemplate(entity: Entity): Buffer {
  const spec = SPECS[entity];
  const header = spec.cols.map((c) => c.header + (c.required ? " *" : ""));
  const ws = XLSX.utils.aoa_to_sheet([header]);
  ws["!cols"] = spec.cols.map((c) => ({ wch: Math.max(14, c.header.length + 2) }));

  const guide: (string | number)[][] = [
    [`FORM MẪU NHẬP LIỆU — ${spec.label.toUpperCase()}`],
    [""],
    ...spec.guide.map((g) => [g]),
    [""],
    ["Cột", "Bắt buộc", "Ví dụ", "Ghi chú"],
    ...spec.cols.map((c) => [c.header, c.required ? "Có" : "", c.example, c.note ?? ""]),
  ];
  const gws = XLSX.utils.aoa_to_sheet(guide);
  gws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 52 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.sheet);
  XLSX.utils.book_append_sheet(wb, gws, "Hướng dẫn");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ---------------------------------------------------------------------------
// Đọc file -> danh sách bản ghi theo key nội bộ (map từ tiêu đề)
// ---------------------------------------------------------------------------
function normHeader(h: string): string {
  return str(h).replace(/\*+\s*$/, "").trim().toLowerCase();
}
export function parseRows(entity: Entity, buf: Buffer): Record<string, any>[] {
  const spec = SPECS[entity];
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
  const byHeader = new Map<string, string>(); // normalized header -> key
  for (const c of spec.cols) byHeader.set(normHeader(c.header), c.key);
  return raw.map((r) => {
    const out: Record<string, any> = {};
    for (const [h, v] of Object.entries(r)) {
      const key = byHeader.get(normHeader(h));
      if (key) out[key] = v;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Bảng tra cứu tham chiếu (mã hoặc tên)
// ---------------------------------------------------------------------------
async function lookups() {
  const [cats, whs, sups, prods] = await Promise.all([
    prisma.category.findMany({ select: { id: true, code: true, name: true } }),
    prisma.warehouse.findMany({ select: { id: true, code: true, name: true } }),
    prisma.supplier.findMany({ select: { id: true, code: true, name: true } }),
    prisma.product.findMany({ select: { id: true, sku: true, trackingMode: true, requiresExpiry: true } }),
  ]);
  const idx = (rows: { id: string; code?: string; name?: string }[]) => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.code) m.set(r.code.trim().toLowerCase(), r.id);
      if (r.name) m.set(r.name.trim().toLowerCase(), r.id);
    }
    return m;
  };
  const prodMap = new Map<string, { id: string; trackingMode: string; requiresExpiry: boolean }>();
  for (const p of prods) prodMap.set(p.sku.trim().toLowerCase(), { id: p.id, trackingMode: p.trackingMode, requiresExpiry: p.requiresExpiry });
  return { cat: idx(cats), wh: idx(whs), sup: idx(sups), prod: prodMap };
}

// ---------------------------------------------------------------------------
// Nhập Sản phẩm
// ---------------------------------------------------------------------------
export async function importProducts(rows: Record<string, any>[], _userId: string): Promise<ImportResult> {
  const lk = await lookups();
  const errors: ImportError[] = [];
  let created = 0;
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = String(i + 2);
    if (!str(r.sku) && !str(r.name)) continue; // dòng trống
    total++;
    try {
      let categoryId: string | undefined;
      const catRef = str(r.categoryCode);
      if (catRef) {
        categoryId = lk.cat.get(catRef.toLowerCase());
        if (!categoryId) throw new Error(`Không tìm thấy nhóm hàng "${catRef}"`);
      }
      const input = productCreateSchema.parse({
        sku: str(r.sku),
        name: str(r.name),
        barcode: str(r.barcode) || undefined,
        brand: str(r.brand) || undefined,
        categoryId,
        trackingMode: mapEnum(r.trackingMode, TRACKING) ?? "LOT",
        requiresExpiry: bool(r.requiresExpiry),
        isTester: bool(r.isTester),
        uom: str(r.uom) || "Cái",
        minStock: num(r.minStock) ?? null,
        expiryAlertDays: num(r.expiryAlertDays) ?? null,
        note: str(r.note) || undefined,
      });
      const exists = await prisma.product.findFirst({ where: { OR: [{ sku: input.sku }, ...(input.barcode ? [{ barcode: input.barcode }] : [])] }, select: { id: true } });
      if (exists) throw new Error(`Mã SKU/mã vạch đã tồn tại`);
      await prisma.product.create({ data: input });
      created++;
    } catch (e: any) {
      errors.push({ row: line, message: firstMsg(e) });
    }
  }
  return { created, total, errors };
}

// ---------------------------------------------------------------------------
// Nhập Tài sản / Thiết bị
// ---------------------------------------------------------------------------
export async function importAssets(rows: Record<string, any>[], _userId: string): Promise<ImportResult> {
  const lk = await lookups();
  const errors: ImportError[] = [];
  let created = 0;
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = String(i + 2);
    if (!str(r.productSku) && !str(r.serialNumber)) continue;
    total++;
    try {
      const skuRef = str(r.productSku);
      const prod = lk.prod.get(skuRef.toLowerCase());
      if (!prod) throw new Error(`Không tìm thấy sản phẩm SKU "${skuRef}"`);
      let warehouseId: string | undefined;
      if (str(r.warehouseCode)) {
        warehouseId = lk.wh.get(str(r.warehouseCode).toLowerCase());
        if (!warehouseId) throw new Error(`Không tìm thấy kho "${str(r.warehouseCode)}"`);
      }
      let supplierId: string | undefined;
      if (str(r.supplierCode)) {
        supplierId = lk.sup.get(str(r.supplierCode).toLowerCase());
        if (!supplierId) throw new Error(`Không tìm thấy NCC "${str(r.supplierCode)}"`);
      }
      const input = assetCreateSchema.parse({
        productId: prod.id,
        serialNumber: str(r.serialNumber) || undefined,
        status: mapEnum(r.status, STATUS) ?? "IN_STOCK",
        warehouseId,
        supplierId,
        location: str(r.location) || undefined,
        purchaseDate: toISODate(r.purchaseDate),
        warrantyUntil: toISODate(r.warrantyUntil),
        cost: num(r.cost) ?? null,
        salvageValue: num(r.salvageValue) ?? null,
        depreciationStart: toISODate(r.depreciationStart),
        depreciationMonths: num(r.depreciationMonths) ?? null,
        depreciationMethod: (mapEnum(r.depreciationMethod, METHOD) as any) ?? null,
        depreciationTotalUnits: num(r.depreciationTotalUnits) ?? null,
        warrantyVendor: str(r.warrantyVendor) || undefined,
        warrantyMonths: num(r.warrantyMonths) ?? null,
        maintenanceCycleMonths: num(r.maintenanceCycleMonths) ?? null,
        contractValue: num(r.contractValue) ?? null,
        managementType: (mapEnum(r.managementType, MANAGE) as any) ?? null,
        note: str(r.note) || undefined,
      });
      const code = await nextAssetCode();
      const { serialNumber } = input;
      if (serialNumber) {
        const dup = await prisma.asset.findFirst({ where: { serialNumber }, select: { id: true } });
        if (dup) throw new Error(`Số serial "${serialNumber}" đã tồn tại`);
      }
      await prisma.asset.create({
        data: {
          code,
          productId: input.productId,
          serialNumber: input.serialNumber,
          warehouseId: input.warehouseId,
          status: input.status,
          location: input.location,
          purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
          warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : null,
          supplierId: input.supplierId,
          note: input.note,
          cost: input.cost ?? null,
          salvageValue: input.salvageValue ?? null,
          depreciationStart: input.depreciationStart ? new Date(input.depreciationStart) : null,
          depreciationMonths: input.depreciationMonths ?? null,
          depreciationMethod: input.depreciationMethod ?? null,
          depreciationTotalUnits: input.depreciationTotalUnits ?? null,
          warrantyVendor: input.warrantyVendor,
          warrantyMonths: input.warrantyMonths ?? null,
          maintenanceCycleMonths: input.maintenanceCycleMonths ?? null,
          contractValue: input.contractValue ?? null,
          managementType: input.managementType ?? null,
        },
      });
      created++;
    } catch (e: any) {
      errors.push({ row: line, message: firstMsg(e) });
    }
  }
  return { created, total, errors };
}

// ---------------------------------------------------------------------------
// Gộp dòng theo cột "group"
// ---------------------------------------------------------------------------
function groupRows(rows: Record<string, any>[]): Map<string, { first: number; items: { i: number; r: Record<string, any> }[] }> {
  const g = new Map<string, { first: number; items: { i: number; r: Record<string, any> }[] }>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = str(r.group);
    if (!key) continue;
    if (!g.has(key)) g.set(key, { first: i, items: [] });
    g.get(key)!.items.push({ i, r });
  }
  return g;
}

// ---------------------------------------------------------------------------
// Nhập kho (phiếu nhiều dòng)
// ---------------------------------------------------------------------------
export async function importReceipts(rows: Record<string, any>[], userId: string): Promise<ImportResult> {
  const lk = await lookups();
  const groups = groupRows(rows);
  const errors: ImportError[] = [];
  let created = 0;
  for (const [key, grp] of groups) {
    const head = grp.items[0].r;
    try {
      const supplierId = lk.sup.get(str(head.supplierCode).toLowerCase());
      if (!supplierId) throw new Error(`Không tìm thấy NCC "${str(head.supplierCode)}"`);
      const warehouseId = lk.wh.get(str(head.warehouseCode).toLowerCase());
      if (!warehouseId) throw new Error(`Không tìm thấy kho "${str(head.warehouseCode)}"`);
      const items = grp.items.map(({ r }) => {
        const prod = lk.prod.get(str(r.productSku).toLowerCase());
        if (!prod) throw new Error(`Dòng SKU "${str(r.productSku)}" không tồn tại`);
        const quantity = num(r.quantity);
        if (!quantity || quantity <= 0) throw new Error(`SKU "${str(r.productSku)}" thiếu số lượng`);
        return {
          productId: prod.id,
          batchCode: str(r.batchCode) || null,
          expiryDate: toISODate(r.expiryDate) ?? null,
          mfgDate: toISODate(r.mfgDate) ?? null,
          quantity,
          unitCost: num(r.unitCost) ?? null,
        };
      });
      await createReceipt({ supplierId, warehouseId, note: str(head.note) || null, items }, userId);
      created++;
    } catch (e: any) {
      errors.push({ row: `Phiếu ${key}`, message: firstMsg(e) });
    }
  }
  return { created, total: groups.size, errors };
}

// ---------------------------------------------------------------------------
// Xuất kho (phiếu nhiều dòng, FEFO)
// ---------------------------------------------------------------------------
export async function importIssues(rows: Record<string, any>[], userId: string): Promise<ImportResult> {
  const lk = await lookups();
  const groups = groupRows(rows);
  const errors: ImportError[] = [];
  let created = 0;
  for (const [key, grp] of groups) {
    const head = grp.items[0].r;
    try {
      const warehouseId = lk.wh.get(str(head.warehouseCode).toLowerCase());
      if (!warehouseId) throw new Error(`Không tìm thấy kho "${str(head.warehouseCode)}"`);
      const issueType = mapEnum(head.issueType, ISSUE) ?? "SALE";
      const items = grp.items.map(({ r }) => {
        const prod = lk.prod.get(str(r.productSku).toLowerCase());
        if (!prod) throw new Error(`Dòng SKU "${str(r.productSku)}" không tồn tại`);
        const quantity = num(r.quantity);
        if (!quantity || quantity <= 0) throw new Error(`SKU "${str(r.productSku)}" thiếu số lượng`);
        return { productId: prod.id, quantity, batchId: null };
      });
      await createIssue({ warehouseId, issueType: issueType as any, customerName: str(head.customerName) || null, note: str(head.note) || null, items }, userId);
      created++;
    } catch (e: any) {
      errors.push({ row: `Phiếu ${key}`, message: firstMsg(e) });
    }
  }
  return { created, total: groups.size, errors };
}

function firstMsg(e: any): string {
  if (e?.issues?.length) return e.issues[0].message + (e.issues[0].path?.length ? ` (${e.issues[0].path.join(".")})` : "");
  if (e?.errors?.length) return e.errors[0].message;
  return e?.message ?? "Lỗi không xác định";
}

export async function runImport(entity: Entity, rows: Record<string, any>[], userId: string): Promise<ImportResult> {
  if (entity === "product") return importProducts(rows, userId);
  if (entity === "asset") return importAssets(rows, userId);
  if (entity === "inbound") return importReceipts(rows, userId);
  return importIssues(rows, userId);
}
