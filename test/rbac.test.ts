import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, PERMISSIONS, can, ROLES } from "@/lib/rbac";
import { canSeeFinance, maskFinance } from "@/lib/clinic";

function sessionWith(perms: string[]) {
  return { userId: "u", email: "e", name: "n", roles: [], permissions: perms } as any;
}

describe("RBAC — dữ liệu tài chính nhạy cảm", () => {
  it("MANAGER/CASHIER/BOD có finance.read; RECEPTION/CSKH/SPECIALIST KHÔNG", () => {
    const has = (role: string) => ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS].includes(PERMISSIONS.FINANCE_READ);
    expect(has(ROLES.MANAGER)).toBe(true);
    expect(has(ROLES.CASHIER)).toBe(true);
    expect(has(ROLES.BOD)).toBe(true);
    expect(has(ROLES.RECEPTION)).toBe(false);
    expect(has(ROLES.CUSTOMER_CARE)).toBe(false);
    expect(has(ROLES.SPECIALIST)).toBe(false);
  });

  it("can() kiểm tra quyền chính xác", () => {
    expect(can([PERMISSIONS.FINANCE_READ], PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(can([PERMISSIONS.CUSTOMER_READ], PERMISSIONS.FINANCE_READ)).toBe(false);
  });

  it("canSeeFinance theo permission phiên", () => {
    expect(canSeeFinance(sessionWith([PERMISSIONS.FINANCE_READ]))).toBe(true);
    expect(canSeeFinance(sessionWith([PERMISSIONS.CUSTOMER_READ]))).toBe(false);
    expect(canSeeFinance(null)).toBe(false);
  });

  it("maskFinance che trường nhạy cảm khi không có quyền", () => {
    const row = { name: "SP", cost: 350000, sellingPrice: 1200000 };
    const masked = maskFinance({ ...row }, false, ["cost"]);
    expect(masked.cost).toBeNull();
    expect(masked.sellingPrice).toBe(1200000); // giá bán vẫn hiển thị
    const visible = maskFinance({ ...row }, true, ["cost"]);
    expect(visible.cost).toBe(350000);
  });

  it("SPECIALIST không có quyền xem/ghi tài chính nhưng có treatment/protocol", () => {
    const p = ROLE_PERMISSIONS[ROLES.SPECIALIST];
    expect(p.includes(PERMISSIONS.TREATMENT_WRITE)).toBe(true);
    expect(p.includes(PERMISSIONS.PROTOCOL_WRITE)).toBe(true);
    expect(p.includes(PERMISSIONS.PAYMENT_READ)).toBe(false);
    expect(p.includes(PERMISSIONS.PRICE_WRITE)).toBe(false);
  });
});
