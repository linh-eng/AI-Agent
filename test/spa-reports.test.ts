// =============================================================================
// BÁO CÁO SPA — doanh thu = payment CHƯA HỦY + deposit ĐÃ PHÂN BỔ; công nợ = total −
// đã trả; mask tài chính theo finance.read; RBAC (booking.read đọc, non-finance = null).
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { buildSpaReport } from "@/lib/spa-reports";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as reportRoute } from "@/app/api/spa-reports/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "U " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.90.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const getReport = () => reportRoute(new Request("http://t/api/spa-reports"), {} as any);

async function seedFinance() {
  const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH Nợ", isActive: true } });
  const inv = await prisma.invoice.create({ data: { code: uniq("HD"), customerId: cust.id, status: "PARTIAL", total: 1_000_000 as any } });
  // Phiếu thu hợp lệ 600k + phiếu ĐÃ HỦY 400k (không tính doanh thu, không giảm nợ)
  await prisma.payment.create({ data: { code: uniq("PT"), customerId: cust.id, invoiceId: inv.id, amount: 600_000 as any, method: "CASH" } });
  await prisma.payment.create({ data: { code: uniq("PT"), customerId: cust.id, invoiceId: inv.id, amount: 400_000 as any, method: "CASH", voidedAt: new Date(), voidReason: "thu nhầm" } });
  return { cust, inv };
}

describe("Báo cáo Spa", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A: doanh thu = phiếu thu CHƯA HỦY (loại phiếu đã hủy); công nợ = total − đã trả", async () => {
    await seedFinance();
    const r = await buildSpaReport();
    expect(r.kpi.revenueMonth).toBe(600_000);   // chỉ 600k, KHÔNG cộng 400k đã hủy
    expect(r.kpi.revenueYear).toBe(600_000);
    expect(r.kpi.totalOutstanding).toBe(400_000); // 1.000.000 − 600.000
    expect(r.debtByCustomer!.length).toBe(1);
    expect(r.debtByCustomer![0].outstanding).toBe(400_000);
    expect(r.kpi.openInvoices).toBe(1);
  });

  it("B: deposit ĐÃ PHÂN BỔ cộng vào doanh thu + giảm công nợ", async () => {
    const { cust, inv } = await seedFinance();
    await prisma.deposit.create({ data: { code: uniq("DC"), customerId: cust.id, invoiceId: inv.id, amount: 250_000 as any, method: "CASH", status: "ALLOCATED", allocatedAt: new Date() } });
    const r = await buildSpaReport();
    expect(r.kpi.revenueMonth).toBe(850_000);      // 600k payment + 250k deposit allocated
    expect(r.kpi.totalOutstanding).toBe(150_000);  // 1.000.000 − 850.000
  });

  it("C: route — người có finance.read thấy số tiền", async () => {
    await seedFinance();
    const u = await makeUser([PERMISSIONS.BOOKING_READ, PERMISSIONS.FINANCE_READ]); await login(u.email);
    const d = await D(await getReport());
    expect(d.kpi.revenueMonth).toBe(600_000);
    expect(d.kpi.totalOutstanding).toBe(400_000);
    expect(Array.isArray(d.debtByCustomer)).toBe(true);
    expect(Array.isArray(d.revenueSeries)).toBe(true);
  });

  it("D: route — KHÔNG finance.read → số tài chính = null (mask ở server), giữ số đếm", async () => {
    await seedFinance();
    const u = await makeUser([PERMISSIONS.BOOKING_READ]); await login(u.email);
    const d = await D(await getReport());
    expect(d.kpi.revenueMonth).toBeNull();
    expect(d.kpi.revenueYear).toBeNull();
    expect(d.kpi.totalOutstanding).toBeNull();
    expect(d.revenueSeries).toBeNull();
    expect(d.debtByCustomer).toBeNull();
    expect(d.paymentsByMethod).toBeNull();
    expect(typeof d.kpi.openInvoices).toBe("number"); // số đếm vận hành vẫn có
  });

  it("E: RBAC — thiếu booking.read → 403; ẩn danh → 401", async () => {
    const u = await makeUser([PERMISSIONS.PRICE_WRITE]); await login(u.email); // có phiên nhưng KHÔNG có booking.read
    expect((await getReport()).status).toBe(403);
    jar.clear(); // ẩn danh (không cookie phiên)
    expect((await getReport()).status).toBe(401);
  });
});
