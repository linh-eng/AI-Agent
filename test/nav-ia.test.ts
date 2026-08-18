// =============================================================================
// IA-PH1 — Regroup + rename thuần (LOW-RISK). Chứng minh:
//   * Nhóm & thứ tự target đúng · Dịch vụ↔Protocol sibling · nhãn mới ·
//   * ROUTE & PERMISSION từng item BẤT BIẾN (byte-for-byte so baseline) ·
//   * active-route behavior detail pages · warehouse env gating · union quyền.
// KHÔNG đụng backend/permission — chỉ NAV_GROUPS.
// =============================================================================
import { describe, it, expect } from "vitest";
import { NAV_GROUPS, visibleNavGroups, canSeeNavItem } from "@/lib/nav";
import { ROLE_PERMISSIONS, ROLES } from "@/lib/rbac";

// IA-PH2 — nav có thể lồng cấp (parent.children). Duyệt đệ quy để lấy leaf.
type Item = (typeof NAV_GROUPS)[number]["items"][number];
const flatten = (items: readonly Item[]): Item[] =>
  items.flatMap((it) => (it.children ? flatten(it.children as readonly Item[]) : [it]));
const allItems = NAV_GROUPS.flatMap((g) => flatten(g.items));
const byHref = new Map(allItems.map((it) => [it.href, it] as const));
const groupOf = (href: string) => NAV_GROUPS.find((g) => flatten(g.items).some((it) => it.href === href))?.title;

// BASELINE (trước IA-PH1) — route → permission. IA-PH1 KHÔNG được đổi các cặp này.
const BASELINE_PERM: Record<string, string | string[]> = {
  "/crm": "booking.read", "/customers": "customer.read", "/bookings": "booking.read",
  "/treatment-plans": "treatment.read", "/before-after": "customer.read", "/proposals": "proposal.read",
  "/invoices": "invoice.write", "/payments": "payment.write", "/followups": ["followup.apply", "followup.write", "task.write"],
  "/tasks": "task.write", "/services": "service.read", "/protocols": "library.read", "/technologies": "library.read",
  "/brands": "library.read", "/catalog": "library.read", "/form-templates": "library.read", "/care-instructions": "library.read",
  "/pricing": "price.write", "/price-floor": ["pricefloor.read", "finance.read"], "/marketing": "marketing.read",
  "/materials": "customer.read", "/customer-materials": "customer.read", "/material-usages": "customer.read", "/materials/report": "customer.read",
  "/employees": "staff.read", "/import-customers": "customer.write", "/users": "user.manage", "/settings": "setting.write",
};
// Warehouse routes giữ warehouse perms (không liệt kê từng cái — kiểm nhóm Kho THNG bên dưới).

describe("IA-PH1 · Regroup + rename (LOW-RISK nav-only)", () => {
  it("A · thứ tự nhóm target đúng (spa) + Kho THNG cuối", () => {
    expect(NAV_GROUPS.map((g) => g.title)).toEqual([
      "Tổng quan", "Khách hàng & Hành trình", "Thư viện chuyên môn", "Giá & Chính sách",
      "Marketing", "Kho & Vật tư", "Vận hành & Hệ thống", "Kho THNG",
    ]);
  });

  it("B+C · Dịch vụ ở Thư viện chuyên môn, sibling với Protocol (cùng nhóm)", () => {
    expect(groupOf("/services")).toBe("Thư viện chuyên môn");
    expect(groupOf("/protocols")).toBe("Thư viện chuyên môn");
  });

  it("D+G+I · nhãn rename đúng", () => {
    expect(byHref.get("/treatment-plans")?.label).toBe("Kế hoạch điều trị");
    expect(byHref.get("/followups")?.label).toBe("CSKH & Follow-up");
    expect(byHref.get("/before-after")?.label).toBe("Thư viện ảnh & Đánh giá");
    // Protocol KHÔNG đổi tên
    expect(byHref.get("/protocols")?.label).toBe("Protocol");
  });

  it("E · Bảng giá + Giá sàn ở 'Giá & Chính sách'", () => {
    expect(groupOf("/pricing")).toBe("Giá & Chính sách");
    expect(groupOf("/price-floor")).toBe("Giá & Chính sách");
  });

  it("F · Marketing là group riêng (1 mục)", () => {
    const g = NAV_GROUPS.find((x) => x.title === "Marketing");
    expect(g?.items.map((i) => i.href)).toEqual(["/marketing"]);
  });

  it("H · Công việc GIỮ global (Khách hàng & Hành trình), chưa merge vào CSKH", () => {
    expect(groupOf("/tasks")).toBe("Khách hàng & Hành trình");
    expect(groupOf("/tasks")).not.toBe("Marketing");
  });

  it("J · PERMISSION từng item BẤT BIẾN (byte-for-byte so baseline)", () => {
    for (const [href, perm] of Object.entries(BASELINE_PERM)) {
      expect(byHref.get(href)?.perm).toEqual(perm);
    }
  });

  it("K · ROUTE bất biến cho item IA-PH1 + CHỈ thêm 2 route workspace IA-PH2", () => {
    // Leaf href (đệ quy children) của các nhóm spa. IA-PH2 chỉ THÊM 2 route pricing
    // toàn cục; mọi route IA-PH1 (kể cả /invoices, /payments nay lồng cấp) giữ nguyên.
    const spaHrefs = NAV_GROUPS.filter((g) => g.title !== "Kho THNG")
      .flatMap((g) => flatten(g.items).map((i) => i.href))
      .filter((h): h is string => !!h)
      .sort();
    const expected = [...Object.keys(BASELINE_PERM), "/service-costings", "/recommended-prices", "/attendance", "/performance"].sort();
    expect(spaHrefs).toEqual(expected);
  });

  it("L · warehouse env gating BẤT BIẾN: hideWarehouse ẩn nhóm Kho THNG", () => {
    const admin = ROLE_PERMISSIONS[ROLES.ADMIN];
    expect(visibleNavGroups(admin).map((g) => g.title)).toContain("Kho THNG");
    expect(visibleNavGroups(admin, { hideWarehouse: true }).map((g) => g.title)).not.toContain("Kho THNG");
  });

  it("M · unauthorized item vẫn ẩn (permission-based)", () => {
    // Người chỉ có customer.read: thấy Khách hàng, KHÔNG thấy Bảng giá (price.write)
    expect(canSeeNavItem(byHref.get("/customers")!, ["customer.read"])).toBe(true);
    expect(canSeeNavItem(byHref.get("/pricing")!, ["customer.read"])).toBe(false);
    // any-of: Giá sàn cần pricefloor.read HOẶC finance.read
    expect(canSeeNavItem(byHref.get("/price-floor")!, ["finance.read"])).toBe(true);
    expect(canSeeNavItem(byHref.get("/price-floor")!, ["customer.read"])).toBe(false);
  });

  it("N · multi-role UNION: quyền hợp nhất → thấy đủ item của mọi vai trò", () => {
    const union = new Set<string>([...ROLE_PERMISSIONS[ROLES.SPECIALIST], ...ROLE_PERMISSIONS[ROLES.CASHIER]]);
    // Thu nhãn đệ quy (parent nested "Hóa đơn & Thanh toán" → children Hóa đơn/Thanh toán).
    const labels = new Set(visibleNavGroups(union).flatMap((g) => flatten(g.items as any).map((i) => i.label)));
    expect(labels.has("Kế hoạch điều trị")).toBe(true); // SPECIALIST (treatment.read)
    expect(labels.has("Hóa đơn")).toBe(true);           // CASHIER (invoice.write) — nested child
    expect(labels.has("Giá sàn")).toBe(true);           // CASHIER (pricefloor.read)
  });

  it("O · active-route: detail page vẫn highlight parent (logic app-shell)", () => {
    // Bản sao logic active của app-shell: pathname === href || pathname.startsWith(href + "/")
    const isActive = (href: string, pathname: string) => pathname === href || pathname.startsWith(href + "/");
    expect(isActive("/services", "/services/abc/costing")).toBe(true);
    expect(isActive("/services", "/services/abc/recommended-price")).toBe(true);
    expect(isActive("/protocols", "/protocols/xyz/pricing")).toBe(true);
    expect(isActive("/customers", "/customers/123")).toBe(true);
    expect(isActive("/services", "/protocols/xyz")).toBe(false);
  });
});
