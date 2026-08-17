// =============================================================================
// Cấu hình điều hướng (sidebar) + lọc theo QUYỀN của phiên (permission-based).
// Mỗi mục gắn `perm` = permission code (hoặc mảng any-of) mà module CẦN để dùng.
// UI chỉ render mục khi phiên có quyền → phản ánh đúng backend (nguồn sự thật).
// KHÔNG map theo tên vai trò; backend guard vẫn quyết định truy cập thật.
// =============================================================================
import {
  Warehouse, LayoutDashboard, FolderKanban, Users, Package, MapPin,
  PackagePlus, ScanBarcode, Boxes, Wrench, Gauge, ClipboardList, PackageMinus,
  ShieldCheck, Hammer, BarChart3, CalendarDays, HeartPulse, ListTodo, Building2,
  Cpu, ScrollText, ShoppingBag, FileText, FileSpreadsheet, BookOpen, Tag,
  Megaphone, Receipt, Wallet, Settings, MessageCircleHeart, Images, Upload,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Quyền cần để THẤY & DÙNG module. Mảng = any-of (có 1 quyền là đủ). Bỏ trống = mọi phiên. */
  perm?: string | string[];
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

// -----------------------------------------------------------------------------
// IA-PH1 — sắp xếp lại theo HÀNH TRÌNH KHÁCH HÀNG (regroup + rename thuần).
// KHÔNG đổi route/permission của bất kỳ item nào; chỉ đổi nhóm/thứ tự/nhãn.
//   * "Phác đồ" → "Kế hoạch điều trị" (tách khỏi Protocol master).
//   * "Chăm sóc khách hàng" → "CSKH & Follow-up".
//   * "Hình ảnh & Đánh giá" → "Thư viện ảnh & Đánh giá".
//   * "Dịch vụ" MOVE sang Thư viện chuyên môn (sibling với Protocol).
//   * "Bảng giá" + "Giá sàn" MOVE sang "Giá & Chính sách"; Marketing thành group riêng.
// -----------------------------------------------------------------------------
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [
      { href: "/crm", label: "Tổng quan", icon: LayoutDashboard, perm: "booking.read" },
    ],
  },
  {
    title: "Khách hàng & Hành trình",
    items: [
      { href: "/customers", label: "Khách hàng", icon: Users, perm: "customer.read" },
      { href: "/bookings", label: "Lịch hẹn", icon: CalendarDays, perm: "booking.read" },
      { href: "/treatment-plans", label: "Kế hoạch điều trị", icon: HeartPulse, perm: "treatment.read" },
      { href: "/before-after", label: "Thư viện ảnh & Đánh giá", icon: Images, perm: "customer.read" },
      { href: "/proposals", label: "Báo giá", icon: FileSpreadsheet, perm: "proposal.read" },
      // Tài chính / lập hóa đơn — gate theo quyền NGHIỆP VỤ (write), không theo read chung.
      { href: "/invoices", label: "Hóa đơn", icon: Receipt, perm: "invoice.write" },
      { href: "/payments", label: "Thanh toán", icon: Wallet, perm: "payment.write" },
      { href: "/followups", label: "CSKH & Follow-up", icon: MessageCircleHeart, perm: ["followup.apply", "followup.write", "task.write"] },
      { href: "/tasks", label: "Công việc", icon: ListTodo, perm: "task.write" },
    ],
  },
  {
    title: "Thư viện chuyên môn",
    items: [
      { href: "/services", label: "Dịch vụ", icon: Sparkles, perm: "service.read" },
      { href: "/protocols", label: "Protocol", icon: ScrollText, perm: "library.read" },
      { href: "/technologies", label: "Công nghệ", icon: Cpu, perm: "library.read" },
      { href: "/brands", label: "Thương hiệu", icon: Building2, perm: "library.read" },
      { href: "/catalog", label: "Sản phẩm", icon: ShoppingBag, perm: "library.read" },
      { href: "/form-templates", label: "Biểu mẫu", icon: FileText, perm: "library.read" },
      { href: "/care-instructions", label: "Hướng dẫn chăm sóc", icon: BookOpen, perm: "library.read" },
    ],
  },
  {
    title: "Giá & Chính sách",
    items: [
      { href: "/pricing", label: "Bảng giá", icon: Tag, perm: "price.write" },
      { href: "/price-floor", label: "Giá sàn", icon: Gauge, perm: ["pricefloor.read", "finance.read"] },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/marketing", label: "Marketing", icon: Megaphone, perm: "marketing.read" },
    ],
  },
  {
    title: "Kho & Vật tư",
    items: [
      { href: "/materials", label: "Kho vật tư sử dụng", icon: Boxes, perm: "customer.read" },
      { href: "/customer-materials", label: "Vật tư khách hàng", icon: Package, perm: "customer.read" },
      { href: "/material-usages", label: "Lịch sử sử dụng", icon: ClipboardList, perm: "customer.read" },
      { href: "/materials/report", label: "Báo cáo vật tư", icon: BarChart3, perm: "customer.read" },
    ],
  },
  {
    title: "Vận hành & Hệ thống",
    items: [
      { href: "/employees", label: "Nhân sự", icon: Users, perm: "staff.read" },
      { href: "/import-customers", label: "Nhập khách hàng", icon: Upload, perm: "customer.write" },
      { href: "/users", label: "Quản trị người dùng", icon: ShieldCheck, perm: "user.manage" },
      { href: "/settings", label: "Cài đặt", icon: Settings, perm: "setting.write" },
    ],
  },
  {
    title: "Kho THNG",
    items: [
      { href: "/dashboard", label: "Tổng quan kho", icon: Gauge, perm: "warehouse.read" },
      { href: "/inventory", label: "Tồn kho", icon: Boxes, perm: "warehouse.read" },
      { href: "/inbound", label: "Nhập kho", icon: PackagePlus, perm: "inbound.write" },
      { href: "/outbound", label: "Xuất kho", icon: PackageMinus, perm: ["outbound.write", "outbound.approve"] },
      { href: "/work-orders", label: "Lắp ráp", icon: Wrench, perm: "workorder.write" },
      { href: "/warranty", label: "Bảo hành / RMA", icon: ShieldCheck, perm: "warranty.write" },
      { href: "/disassembly", label: "Rã máy", icon: Hammer, perm: "disassembly.approve" },
      { href: "/stock-counts", label: "Kiểm kê", icon: ClipboardList, perm: ["stockcount.approve", "warehouse.write"] },
      { href: "/serials", label: "Serial", icon: ScanBarcode, perm: "warehouse.read" },
      { href: "/reports", label: "Báo cáo", icon: BarChart3, perm: "warehouse.read" },
      { href: "/warehouses", label: "Danh mục kho", icon: Warehouse, perm: "warehouse.read" },
      { href: "/bins", label: "Vị trí kệ", icon: MapPin, perm: "bin.read" },
      { href: "/projects", label: "Dự án", icon: FolderKanban, perm: "project.read" },
      { href: "/partners", label: "NCC / Đối tác", icon: Users, perm: "partner.read" },
      { href: "/products", label: "Sản phẩm", icon: Package, perm: "product.read" },
    ],
  },
];

/** Phiên có được thấy 1 mục không: bỏ trống perm → luôn thấy; mảng → any-of. */
export function canSeeNavItem(item: NavItem, permissions: Iterable<string>): boolean {
  if (!item.perm) return true;
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  const req = Array.isArray(item.perm) ? item.perm : [item.perm];
  return req.some((p) => set.has(p));
}

/**
 * Lọc nav theo quyền của phiên. Nhóm không còn mục nào → bỏ khỏi kết quả
 * (không render tiêu đề nhóm rỗng). `hideWarehouse` ẩn cả nhóm Kho THNG (env).
 */
export function visibleNavGroups(permissions: Iterable<string>, opts?: { hideWarehouse?: boolean }): NavGroup[] {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return NAV_GROUPS
    .filter((g) => !(g.title === "Kho THNG" && opts?.hideWarehouse))
    .map((g) => ({ title: g.title, items: g.items.filter((it) => canSeeNavItem(it, set)) }))
    .filter((g) => g.items.length > 0);
}
