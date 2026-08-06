// =============================================================================
// Danh mục kho cố định A1 (mục 3a).
// Quy tắc cứng: K-HH, K-BH-KH, K-BH-NCC, K-SC, K-TL KHÔNG tính vào tồn khả dụng.
// =============================================================================

export interface WarehouseDef {
  code: string;
  name: string;
  description: string;
  countsAsAvailable: boolean;
}

export const WAREHOUSE_CATALOG: WarehouseDef[] = [
  { code: "K-TM", name: "Thương mại", description: "Hàng thương mại sẵn bán", countsAsAvailable: true },
  { code: "K-DA", name: "Dự án", description: "Hàng gắn dự án — khóa theo mã dự án", countsAsAvailable: true },
  { code: "K-TAM", name: "Tạm lắp ráp/tháo dỡ (WIP)", description: "Kho WIP trong quá trình lắp ráp/tháo dỡ", countsAsAvailable: false },
  { code: "K-BH-KH", name: "Bảo hành nhận từ khách", description: "Máy khách gửi bảo hành", countsAsAvailable: false },
  { code: "K-BH-NCC", name: "Đang ở NCC/hãng", description: "Hàng đang gửi bảo hành ở NCC/hãng", countsAsAvailable: false },
  { code: "K-SC", name: "Sửa chữa có phí", description: "Hàng đang sửa chữa có phí", countsAsAvailable: false },
  { code: "K-HH", name: "Thiết bị hư hỏng/chờ xử lý", description: "Hàng hư hỏng chờ hướng xử lý (SLA 15 ngày)", countsAsAvailable: false },
  { code: "K-LK", name: "Linh kiện & phụ kiện", description: "Linh kiện, phụ kiện phục vụ lắp ráp/sửa chữa", countsAsAvailable: true },
  { code: "K-TMAY", name: "Hàng tháo máy/tân trang", description: "Linh kiện thu hồi sau tháo dỡ, có grade A/B/C", countsAsAvailable: true },
  { code: "K-DEMO", name: "Demo/cho mượn/cho thuê", description: "Hàng demo, cho mượn, cho thuê", countsAsAvailable: true },
  { code: "K-SW", name: "Bản quyền phần mềm", description: "License phần mềm bản quyền", countsAsAvailable: true },
  { code: "K-TL", name: "Thanh lý/chờ hủy", description: "Hàng chờ thanh lý/hủy", countsAsAvailable: false },
];

/** Các kho KHÔNG tính vào tồn khả dụng bán (quy tắc cứng mục 3a). */
export const NON_AVAILABLE_WAREHOUSE_CODES = WAREHOUSE_CATALOG.filter(
  (w) => !w.countsAsAvailable
).map((w) => w.code);
