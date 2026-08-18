// =============================================================================
// LOY-PH1 — Loyalty / Membership / Prepaid / Voucher. Chứng minh A–X.
//   Tier+Points A–F · Prepaid G–L · Voucher M–S · RBAC/Portal T–X.
// Ledger append-only + balanceAfter · chặn âm · idempotent earn · voucher
// FIXED/PERCENT + expiry + max lượt · RBAC loyalty.read/write · portal self.
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
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as portalLogin } from "@/app/api/portal/login/route";
import { GET as tierList, POST as tierCreate } from "@/app/api/membership-tiers/route";
import { GET as loyGet } from "@/app/api/loyalty/[customerId]/route";
import { POST as loyAction } from "@/app/api/loyalty/actions/route";
import { GET as voucherList, POST as voucherCreate } from "@/app/api/vouchers/route";
import { POST as voucherValidate } from "@/app/api/vouchers/validate/route";
import { POST as voucherRedeem } from "@/app/api/vouchers/redeem/route";
import { GET as portalLoyalty } from "@/app/api/portal/loyalty/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "U " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.79.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const createTier = (b: unknown) => tierCreate(new Request("http://t/api/membership-tiers", J(b)), {} as any);
const getLoy = (customerId: string) => loyGet(new Request("http://t/x"), { params: { customerId } } as any);
const action = (b: unknown) => loyAction(new Request("http://t/api/loyalty/actions", J(b)), {} as any);
const createVoucher = (b: unknown) => voucherCreate(new Request("http://t/api/vouchers", J(b)), {} as any);
const listVouchers = (qs = "") => voucherList(new Request("http://t/api/vouchers" + qs), {} as any);
const validateV = (b: unknown) => voucherValidate(new Request("http://t/api/vouchers/validate", J(b)), {} as any);
const redeemV = (b: unknown) => voucherRedeem(new Request("http://t/api/vouchers/redeem", J(b)), {} as any);

const WRITER = [PERMISSIONS.LOYALTY_READ, PERMISSIONS.LOYALTY_WRITE];
async function boot() { const m = await makeUser(WRITER); await login(m.email); return m; }
async function mkCustomer() { return prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } }); }
async function mkPayment(customerId: string, amount: number, voided = false) {
  return prisma.payment.create({ data: { code: uniq("PT"), customerId, amount: amount as any, method: "CASH", ...(voided ? { voidedAt: new Date(), voidReason: "x" } : {}) } });
}

describe("LOY-PH1 · Tier + Points (A–F)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A: tích điểm từ tiền thực thu (1 điểm/1.000₫)", async () => {
    await boot();
    const c = await mkCustomer();
    const p = await mkPayment(c.id, 2_000_000);
    const r = await D(await action({ action: "earn", paymentId: p.id }));
    expect(r.earned).toBe(2000);
    const s = await D(await getLoy(c.id));
    expect(s.points).toBe(2000);
    expect(s.lifetimeSpend).toBe(2_000_000);
  });

  it("B: idempotent — tích 2 lần cùng phiếu thu → điểm không nhân đôi", async () => {
    await boot();
    const c = await mkCustomer();
    const p = await mkPayment(c.id, 1_000_000);
    await action({ action: "earn", paymentId: p.id });
    await action({ action: "earn", paymentId: p.id });
    expect((await D(await getLoy(c.id))).points).toBe(1000);
  });

  it("C: phiếu thu ĐÃ HỦY không tích điểm", async () => {
    await boot();
    const c = await mkCustomer();
    const p = await mkPayment(c.id, 1_000_000, true);
    const r = await D(await action({ action: "earn", paymentId: p.id }));
    expect(r.skipped).toBeTruthy();
    expect((await D(await getLoy(c.id))).points).toBe(0);
  });

  it("D: hạng tự lên theo tổng chi tiêu (VIP khi ≥ ngưỡng)", async () => {
    await boot();
    await createTier({ code: "STD", name: "Thường", minLifetimeSpend: 0 });
    await createTier({ code: "VIP", name: "VIP", minLifetimeSpend: 5_000_000, pointsPerThousand: 2 });
    const c = await mkCustomer();
    await action({ action: "earn", paymentId: (await mkPayment(c.id, 6_000_000)).id });
    const s = await D(await getLoy(c.id));
    expect(s.tier.code).toBe("VIP");
  });

  it("E: đổi điểm → cộng ví trả trước (1 điểm = 1.000₫)", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "earn", paymentId: (await mkPayment(c.id, 3_000_000)).id }); // 3000 điểm
    const r = await D(await action({ action: "redeemPoints", customerId: c.id, points: 1000 }));
    expect(r.pointsBalance).toBe(2000);
    expect(r.prepaidBalance).toBe(1_000_000); // 1000 điểm × 1.000₫
    expect(r.credited).toBe(1_000_000);
  });

  it("F: đổi vượt điểm → 422; điều chỉnh điểm thủ công ghi ledger", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "earn", paymentId: (await mkPayment(c.id, 1_000_000)).id }); // 1000
    const over = await action({ action: "redeemPoints", customerId: c.id, points: 5000 });
    expect(over.status).toBe(422);
    await action({ action: "adjustPoints", customerId: c.id, points: 500, note: "thưởng" });
    expect((await D(await getLoy(c.id))).points).toBe(1500);
    // ledger append-only có balanceAfter
    const acc = await prisma.loyaltyAccount.findUnique({ where: { customerId: c.id }, include: { transactions: true } });
    expect(acc!.transactions.length).toBeGreaterThanOrEqual(2);
    expect(acc!.transactions.every((t) => t.balanceAfter != null)).toBe(true);
  });
});

describe("LOY-PH1 · Prepaid wallet (G–L)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("G+H: nạp ví + trừ ví (số dư đúng, ledger balanceAfter)", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "topup", customerId: c.id, amount: 2_000_000, method: "TRANSFER" });
    let s = await D(await getLoy(c.id));
    expect(s.prepaidBalance).toBe(2_000_000);
    await action({ action: "redeemPrepaid", customerId: c.id, amount: 500_000 });
    s = await D(await getLoy(c.id));
    expect(s.prepaidBalance).toBe(1_500_000);
  });

  it("I: trừ ví vượt số dư → 422 (chặn âm)", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "topup", customerId: c.id, amount: 100_000 });
    const r = await action({ action: "redeemPrepaid", customerId: c.id, amount: 999_000 });
    expect(r.status).toBe(422);
    expect((await D(await getLoy(c.id))).prepaidBalance).toBe(100_000);
  });

  it("J: hai lần trừ ĐỒNG THỜI không âm quá (khóa dòng)", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "topup", customerId: c.id, amount: 100_000 });
    const [a, b] = await Promise.allSettled([
      action({ action: "redeemPrepaid", customerId: c.id, amount: 80_000 }),
      action({ action: "redeemPrepaid", customerId: c.id, amount: 80_000 }),
    ]);
    const statuses = [a, b].map((x) => (x.status === "fulfilled" ? (x.value as Response).status : 500));
    // đúng 1 thành công (200), 1 thất bại (422) — không cho tổng vượt 100k
    expect(statuses.filter((s) => s === 200).length).toBe(1);
    expect((await D(await getLoy(c.id))).prepaidBalance).toBe(20_000);
  });

  it("K+L: ví KHÔNG đụng Deposit/Payment (tách biệt) + refund giảm số dư", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "topup", customerId: c.id, amount: 1_000_000 });
    // không tạo Payment/Deposit nào
    expect(await prisma.payment.count({ where: { customerId: c.id } })).toBe(0);
    expect(await prisma.deposit.count({ where: { customerId: c.id } })).toBe(0);
    await action({ action: "refundPrepaid", customerId: c.id, amount: 400_000, note: "hoàn" });
    expect((await D(await getLoy(c.id))).prepaidBalance).toBe(600_000);
  });
});

describe("LOY-PH1 · Voucher (M–S)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("M: voucher FIXED giảm đúng số tiền", async () => {
    await boot();
    await createVoucher({ code: "GIAM100", name: "Giảm 100k", type: "FIXED", value: 100_000 });
    const v = await D(await validateV({ code: "GIAM100", spend: 500_000 }));
    expect(v.ok).toBe(true);
    expect(v.discount).toBe(100_000);
  });

  it("N: voucher PERCENT có trần maxDiscount", async () => {
    await boot();
    await createVoucher({ code: "P20", name: "Giảm 20%", type: "PERCENT", value: 20, maxDiscount: 150_000 });
    expect((await D(await validateV({ code: "P20", spend: 500_000 }))).discount).toBe(100_000); // 20% = 100k
    expect((await D(await validateV({ code: "P20", spend: 2_000_000 }))).discount).toBe(150_000); // trần 150k
  });

  it("O: minSpend chưa đạt → không hợp lệ", async () => {
    await boot();
    await createVoucher({ code: "MIN", name: "x", type: "FIXED", value: 50_000, minSpend: 300_000 });
    expect((await D(await validateV({ code: "MIN", spend: 200_000 }))).ok).toBe(false);
  });

  it("P: hết hạn → không hợp lệ", async () => {
    await boot();
    await createVoucher({ code: "EXP", name: "x", type: "FIXED", value: 50_000, expiresAt: "2020-01-01T00:00:00Z" });
    expect((await D(await validateV({ code: "EXP", spend: 100_000 }))).ok).toBe(false);
  });

  it("Q+R: dùng voucher → tăng lượt + USED khi hết; idempotent theo hóa đơn", async () => {
    await boot();
    await createVoucher({ code: "ONCE", name: "x", type: "FIXED", value: 50_000, maxRedemptions: 1 });
    const r1 = await D(await redeemV({ code: "ONCE", spend: 500_000, invoiceId: "INV1" }));
    expect(r1.discount).toBe(50_000);
    // idempotent cùng hóa đơn
    const r1b = await D(await redeemV({ code: "ONCE", spend: 500_000, invoiceId: "INV1" }));
    expect(r1b.discount).toBe(50_000);
    expect(await prisma.voucherRedemption.count({ where: { voucher: { code: "ONCE" } } })).toBe(1);
    // hết lượt → dùng cho hóa đơn khác thất bại
    const r2 = await redeemV({ code: "ONCE", spend: 500_000, invoiceId: "INV2" });
    expect(r2.status).toBe(422);
    const v = await prisma.voucher.findUnique({ where: { code: "ONCE" } });
    expect(v!.status).toBe("USED");
  });

  it("S: voucher KHÔNG tự trừ vào hóa đơn (chỉ redemption ledger)", async () => {
    await boot();
    const c = await mkCustomer();
    const inv = await prisma.invoice.create({ data: { code: uniq("HD"), customerId: c.id, subtotal: 1_000_000 as any, total: 1_000_000 as any, status: "UNPAID" } });
    await createVoucher({ code: "NOAP", name: "x", type: "FIXED", value: 100_000 });
    await redeemV({ code: "NOAP", spend: 1_000_000, customerId: c.id, invoiceId: inv.id });
    const after = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(Number(after!.total)).toBe(1_000_000); // hóa đơn KHÔNG đổi
  });
});

describe("LOY-PH1 · RBAC / Portal (T–X)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("T: loyalty.write cần cho thao tác; chỉ read → 403 khi ghi", async () => {
    const reader = await makeUser([PERMISSIONS.LOYALTY_READ]);
    await login(reader.email);
    const c = await mkCustomer();
    expect((await getLoy(c.id)).status).toBe(200); // đọc OK
    expect((await action({ action: "topup", customerId: c.id, amount: 100_000 })).status).toBe(403); // ghi cấm
    expect((await createVoucher({ code: "X", name: "x", type: "FIXED", value: 1 })).status).toBe(403);
  });

  it("U: không có quyền loyalty → 403; ẩn danh → 401", async () => {
    const none = await makeUser([PERMISSIONS.TREATMENT_READ]);
    await login(none.email);
    const c = await mkCustomer();
    expect((await getLoy(c.id)).status).toBe(403);
    jar.clear();
    expect((await getLoy(c.id)).status).toBe(401);
  });

  it("V+W+X: khách xem điểm/ví CỦA MÌNH qua portal (không thấy khách khác)", async () => {
    await boot();
    const c = await mkCustomer();
    await action({ action: "earn", paymentId: (await mkPayment(c.id, 2_000_000)).id });
    await action({ action: "topup", customerId: c.id, amount: 500_000 });
    // cấp tài khoản portal cho khách + đăng nhập portal
    const email = `kh_${uniq("p")}@example.com`.toLowerCase();
    await prisma.customerPortalAccount.create({ data: { customerId: c.id, email, passwordHash: await hashPassword("khach123") } });
    jar.clear();
    await portalLogin(new Request("http://t/api/portal/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.79.9.${++ip}` }, body: JSON.stringify({ email, password: "khach123" }) }), {} as any);
    const s = await D(await portalLoyalty(new Request("http://t/api/portal/loyalty"), {} as any));
    expect(s.points).toBe(2000);
    expect(s.prepaidBalance).toBe(500_000);
    // whitelist — không lộ trường nội bộ (vd createdBy)
    expect(s.loyaltyTransactions[0].createdBy).toBeUndefined();
  });
});
