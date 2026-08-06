// =============================================================================
// Nghiệp vụ NHẬP (M1) — cấu hình cho từng mã loại nghiệp vụ N1..N12:
//   * kho đích mặc định (theo danh mục A1)
//   * checklist chứng từ bắt buộc (bung ra khi chọn loại phiếu)
//   * cờ có tạo tồn/serial khi nhận hàng hay không
// Nguồn sự thật dùng chung cho API (kiểm) và UI (hiển thị checklist).
// =============================================================================

export type InboundTypeCode =
  | "N1" | "N2" | "N3" | "N4" | "N5" | "N6"
  | "N7" | "N8" | "N9" | "N10" | "N11" | "N12";

/** Các chứng từ có thể yêu cầu. */
export type DocRequirement =
  | "supplier" // NCC
  | "po" // PO/HĐ mua
  | "invoice" // hóa đơn GTGT
  | "projectOrCommercial" // mã dự án hoặc cờ hàng thương mại
  | "origin" // CO/CQ, tờ khai HQ, xuất xứ
  | "vendorWarranty" // hạn BH hãng + mốc bắt đầu
  | "customerInvoiceRef" // đối chiếu hóa đơn bán gốc (BH từ khách)
  | "conditionPhotos"; // biên bản tình trạng + ảnh

export interface InboundTypeConfig {
  code: InboundTypeCode;
  label: string;
  /** Mã kho đích mặc định (A1). null = xác định theo ngữ cảnh (vd chuyển kho). */
  destinationWarehouseCode: string | null;
  requiredDocs: DocRequirement[];
  /** Có sinh serial/lot/tồn khi nhận hàng không. */
  createsInventory: boolean;
  note?: string;
}

export const INBOUND_TYPES: Record<InboundTypeCode, InboundTypeConfig> = {
  N1: {
    code: "N1",
    label: "Mua mới",
    destinationWarehouseCode: "K-TM",
    requiredDocs: ["supplier", "po", "invoice", "projectOrCommercial", "origin", "vendorWarranty"],
    createsInventory: true,
  },
  N2: {
    code: "N2",
    label: "Hàng dự án",
    destinationWarehouseCode: "K-DA",
    requiredDocs: ["supplier", "po", "invoice", "projectOrCommercial", "origin", "vendorWarranty"],
    createsInventory: true,
    note: "Hàng vào K-DA tự khóa theo mã dự án.",
  },
  N3: {
    code: "N3",
    label: "Bảo hành từ khách",
    destinationWarehouseCode: "K-BH-KH",
    requiredDocs: ["customerInvoiceRef", "conditionPhotos"],
    createsInventory: false,
    note: "Đối chiếu serial với hóa đơn bán gốc; kiểm tem niêm phong.",
  },
  N4: {
    code: "N4",
    label: "Bảo hành NCC/hãng trả về",
    destinationWarehouseCode: "K-BH-KH",
    requiredDocs: ["supplier", "conditionPhotos"],
    createsInventory: false,
    note: "Serial cũ -> REPLACED nếu là hàng thay thế; cập nhật as-built BOM.",
  },
  N5: {
    code: "N5",
    label: "Sửa chữa có phí",
    destinationWarehouseCode: "K-SC",
    requiredDocs: ["customerInvoiceRef", "conditionPhotos"],
    createsInventory: false,
  },
  N6: {
    code: "N6",
    label: "Thiết bị hư hỏng",
    destinationWarehouseCode: "K-HH",
    requiredDocs: ["conditionPhotos"],
    createsInventory: false,
    note: "Chốt hướng xử lý trong 15 ngày (SLA K-HH).",
  },
  N7: {
    code: "N7",
    label: "Thành phẩm sau lắp ráp",
    destinationWarehouseCode: "K-TM",
    requiredDocs: [],
    createsInventory: true,
    note: "Sinh từ Work Order (M4).",
  },
  N8: {
    code: "N8",
    label: "Linh kiện sau tháo dỡ",
    destinationWarehouseCode: "K-TMAY",
    requiredDocs: [],
    createsInventory: true,
    note: "Sinh từ lệnh rã máy (M10), có grade A/B/C.",
  },
  N9: {
    code: "N9",
    label: "Khách trả/đổi",
    destinationWarehouseCode: "K-TM",
    requiredDocs: ["customerInvoiceRef", "conditionPhotos"],
    createsInventory: true,
  },
  N10: {
    code: "N10",
    label: "Thu hồi demo/thuê",
    destinationWarehouseCode: "K-DEMO",
    requiredDocs: ["conditionPhotos"],
    createsInventory: true,
  },
  N11: {
    code: "N11",
    label: "Chuyển kho",
    destinationWarehouseCode: null,
    requiredDocs: [],
    createsInventory: false,
    note: "Kho đích chọn theo phiếu chuyển kho.",
  },
  N12: {
    code: "N12",
    label: "Khuyến mãi/hàng mượn NCC",
    destinationWarehouseCode: "K-TM",
    requiredDocs: ["supplier", "origin"],
    createsInventory: true,
  },
};

export const INBOUND_TYPE_LIST = Object.values(INBOUND_TYPES);

export const DOC_LABELS: Record<DocRequirement, string> = {
  supplier: "Nhà cung cấp (NCC)",
  po: "Số PO / HĐ mua",
  invoice: "Hóa đơn GTGT",
  projectOrCommercial: "Mã dự án hoặc hàng thương mại",
  origin: "Xuất xứ / CO / CQ / Tờ khai HQ",
  vendorWarranty: "Bảo hành hãng (mốc bắt đầu + hạn)",
  customerInvoiceRef: "Đối chiếu hóa đơn bán gốc",
  conditionPhotos: "Biên bản tình trạng + ảnh",
};

export function getInboundConfig(code: string): InboundTypeConfig | undefined {
  return INBOUND_TYPES[code as InboundTypeCode];
}
