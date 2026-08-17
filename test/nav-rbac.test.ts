// =============================================================================
// Mục 15 (N) — Sidebar/menu render theo PERMISSION của phiên (permission-based,
// KHÔNG theo tên vai trò). Kiểm bằng ROLE_PERMISSIONS (nguồn sự thật) → menu hiện.
// Backend guard vẫn là source of truth (đã chứng minh ở rbac-matrix.test.ts).
// =============================================================================
import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, ROLES } from "@/lib/rbac";
import { visibleNavGroups, canSeeNavItem, NAV_GROUPS } from "@/lib/nav";

/** Thu nhãn đệ quy (parent nested + leaf) — IA-PH2 có "Hóa đơn & Thanh toán" lồng cấp. */
function labelsDeep(items: { label: string; children?: { label: string; children?: unknown[] }[] }[]): string[] {
  return items.flatMap((it) => (it.children ? labelsDeep(it.children as never) : [it.label]));
}
/** Tập nhãn menu mà 1 vai trò nhìn thấy (không ẩn nhóm Kho THNG để kiểm cả cluster). */
function menuFor(role: string): Set<string> {
  const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  const groups = visibleNavGroups(perms);
  return new Set(groups.flatMap((g) => labelsDeep(g.items as never)));
}
function groupsFor(role: string): string[] {
  const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return visibleNavGroups(perms).map((g) => g.title);
}

describe("Mục 15 · Sidebar permission-based (N)", () => {
  it("CSKH: KHÔNG thấy Hóa đơn/Thanh toán/Bảng giá/Giá sàn/Marketing/Quản trị user; CÓ core CSKH", () => {
    const m = menuFor(ROLES.CUSTOMER_CARE);
    for (const hidden of ["Hóa đơn", "Thanh toán", "Bảng giá", "Giá sàn", "Marketing", "Quản trị người dùng", "Cài đặt"]) {
      expect(m.has(hidden)).toBe(false);
    }
    for (const shown of ["Khách hàng", "Lịch hẹn", "Kế hoạch điều trị", "CSKH & Follow-up", "Công việc"]) {
      expect(m.has(shown)).toBe(true);
    }
  });

  it("Chuyên viên: KHÔNG thấy finance/billing/marketing/user; CÓ Phác đồ", () => {
    const m = menuFor(ROLES.SPECIALIST);
    for (const hidden of ["Hóa đơn", "Thanh toán", "Bảng giá", "Giá sàn", "Marketing", "Quản trị người dùng"]) {
      expect(m.has(hidden)).toBe(false);
    }
    expect(m.has("Kế hoạch điều trị")).toBe(true);
    expect(m.has("Khách hàng")).toBe(true);
  });

  it("Lễ tân: CÓ Hóa đơn/Thanh toán/Giá sàn (pricefloor.read); KHÔNG Bảng giá/Marketing/Quản trị user", () => {
    const m = menuFor(ROLES.RECEPTION);
    expect(m.has("Hóa đơn")).toBe(true);      // invoice.write
    expect(m.has("Thanh toán")).toBe(true);   // payment.write
    expect(m.has("Giá sàn")).toBe(true);      // pricefloor.read
    expect(m.has("Bảng giá")).toBe(false);    // không price.write
    expect(m.has("Marketing")).toBe(false);   // không marketing.read
    expect(m.has("Quản trị người dùng")).toBe(false);
  });

  it("Thu ngân: CÓ Hóa đơn/Thanh toán/Bảng giá/Giá sàn; KHÔNG Marketing/Quản trị user", () => {
    const m = menuFor(ROLES.CASHIER);
    for (const shown of ["Hóa đơn", "Thanh toán", "Bảng giá", "Giá sàn"]) expect(m.has(shown)).toBe(true);
    expect(m.has("Marketing")).toBe(false);
    expect(m.has("Quản trị người dùng")).toBe(false);
  });

  it("Marketing: CÓ Marketing + Giá sàn (finance.read); KHÔNG Hóa đơn/Thanh toán/Quản trị user", () => {
    const m = menuFor(ROLES.MARKETING);
    expect(m.has("Marketing")).toBe(true);    // marketing.read
    expect(m.has("Giá sàn")).toBe(true);      // finance.read (ROI) → thấy ngưỡng
    expect(m.has("Hóa đơn")).toBe(false);     // không invoice.write
    expect(m.has("Thanh toán")).toBe(false);  // không payment.write
    expect(m.has("Quản trị người dùng")).toBe(false);
  });

  it("Quản lý: CÓ toàn bộ nghiệp vụ+tài chính; KHÔNG Quản trị user (thiếu user.manage)", () => {
    const m = menuFor(ROLES.MANAGER);
    for (const shown of ["Hóa đơn", "Thanh toán", "Bảng giá", "Giá sàn", "Marketing", "Cài đặt"]) expect(m.has(shown)).toBe(true);
    expect(m.has("Quản trị người dùng")).toBe(false); // user.manage chỉ Admin
  });

  it("Admin: CÓ Quản trị người dùng + toàn bộ", () => {
    const m = menuFor(ROLES.ADMIN);
    expect(m.has("Quản trị người dùng")).toBe(true);
    expect(m.has("Hóa đơn")).toBe(true);
    expect(m.has("Tồn kho")).toBe(true); // Admin có warehouse perms
  });

  it("Vai trò spa KHÔNG thấy cụm Kho THNG (thiếu warehouse perms)", () => {
    for (const role of [ROLES.MANAGER, ROLES.RECEPTION, ROLES.CUSTOMER_CARE, ROLES.SPECIALIST, ROLES.CASHIER, ROLES.MARKETING]) {
      const m = menuFor(role);
      for (const wh of ["Tồn kho", "Nhập kho", "Xuất kho", "Lắp ráp", "Serial"]) expect(m.has(wh)).toBe(false);
      expect(groupsFor(role)).not.toContain("Kho THNG"); // nhóm rỗng bị bỏ
    }
  });

  it("canSeeNavItem: any-of (mảng perm) + bỏ trống = luôn thấy", () => {
    expect(canSeeNavItem({ href: "/x", label: "X", icon: NAV_GROUPS[0].items[0].icon, perm: ["a", "b"] }, ["b"])).toBe(true);
    expect(canSeeNavItem({ href: "/x", label: "X", icon: NAV_GROUPS[0].items[0].icon, perm: ["a", "b"] }, ["c"])).toBe(false);
    expect(canSeeNavItem({ href: "/x", label: "X", icon: NAV_GROUPS[0].items[0].icon }, [])).toBe(true);
  });

  it("Nhóm rỗng bị loại: vai trò rác (0 quyền) → 0 nhóm menu", () => {
    expect(visibleNavGroups([]).length).toBe(0);
  });
});
