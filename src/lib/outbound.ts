// =============================================================================
// Nghiệp vụ XUẤT (M6–M8) — cấu hình cho từng mã loại X1..X11.
// =============================================================================
import type { SerialStatus } from "@prisma/client";

export type OutboundTypeCode =
  | "X1" | "X2" | "X3" | "X4" | "X5" | "X6" | "X7" | "X8" | "X9" | "X10" | "X11";

export interface OutboundTypeConfig {
  code: OutboundTypeCode;
  label: string;
  requiresCustomer: boolean;
  requiresProject: boolean;
  /// Trạng thái serial sau khi xuất
  targetStatus: SerialStatus;
}

export const OUTBOUND_TYPES: Record<OutboundTypeCode, OutboundTypeConfig> = {
  X1: { code: "X1", label: "Bán thương mại", requiresCustomer: true, requiresProject: false, targetStatus: "SOLD" },
  X2: { code: "X2", label: "Giao hàng dự án", requiresCustomer: false, requiresProject: true, targetStatus: "SOLD" },
  X3: { code: "X3", label: "Xuất linh kiện lắp ráp", requiresCustomer: false, requiresProject: false, targetStatus: "WIP" },
  X4: { code: "X4", label: "Gửi bảo hành hãng", requiresCustomer: false, requiresProject: false, targetStatus: "AT_VENDOR" },
  X5: { code: "X5", label: "Trả máy BH cho khách", requiresCustomer: true, requiresProject: false, targetStatus: "SOLD" },
  X6: { code: "X6", label: "Trả máy sửa chữa", requiresCustomer: true, requiresProject: false, targetStatus: "SOLD" },
  X7: { code: "X7", label: "Trả hàng lỗi NCC", requiresCustomer: false, requiresProject: false, targetStatus: "AT_VENDOR" },
  X8: { code: "X8", label: "Demo / mượn / thuê", requiresCustomer: true, requiresProject: false, targetStatus: "RENTED" },
  X9: { code: "X9", label: "Chuyển kho", requiresCustomer: false, requiresProject: false, targetStatus: "IN_STOCK" },
  X10: { code: "X10", label: "Hủy / thanh lý", requiresCustomer: false, requiresProject: false, targetStatus: "SCRAPPED" },
  X11: { code: "X11", label: "Điều chỉnh kiểm kê", requiresCustomer: false, requiresProject: false, targetStatus: "SCRAPPED" },
};

export const OUTBOUND_TYPE_LIST = Object.values(OUTBOUND_TYPES);

export function getOutboundConfig(code: string): OutboundTypeConfig | undefined {
  return OUTBOUND_TYPES[code as OutboundTypeCode];
}
