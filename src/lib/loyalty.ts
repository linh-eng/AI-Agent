// =============================================================================
// LOY-PH1 — LOYALTY ENGINE (điểm · hạng · ví trả trước · voucher).
// Ledger APPEND-ONLY + `balanceAfter`; khóa dòng FOR UPDATE khi trừ (chống âm/đua);
// KHÔNG hard-delete; KHÔNG đổi Invoice/Payment/Deposit.
//
// QUYẾT ĐỊNH (owner-safe):
//  * Điểm TÍCH từ TIỀN THỰC THU (Payment chưa hủy), tỷ lệ theo hạng (pointsPerThousand)
//    hoặc mặc định. Idempotent theo paymentId.
//  * ĐỔI điểm → cộng VÍ TRẢ TRƯỚC theo REDEEM_RATE (1 điểm = 1.000₫ mặc định).
//  * Ví trả trước tách khỏi Deposit; trừ ví chặn âm. Voucher FIXED/PERCENT (trần + min).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { auditLog } from "./clinic";
import type { SessionPayload } from "./auth";

const now = () => new Date();
const num = (d: any): number => (d == null ? 0 : Number(d));
const actor = (s: SessionPayload) => s.name ?? s.email ?? null;

/** Cấu hình mặc định (tài liệu hóa; hạng có thể ghi đè tỷ lệ tích). */
export const DEFAULT_POINTS_PER_THOUSAND = 1; // 1 điểm / 1.000₫ tiền thực thu
export const REDEEM_RATE = 1000; // 1 điểm = 1.000₫ khi đổi sang ví trả trước

export class LoyaltyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function ensureLoyaltyAccount(customerId: string, tx: Prisma.TransactionClient = prisma) {
  const existing = await tx.loyaltyAccount.findUnique({ where: { customerId } });
  if (existing) return existing;
  return tx.loyaltyAccount.create({ data: { customerId } });
}
export async function ensurePrepaidAccount(customerId: string, tx: Prisma.TransactionClient = prisma) {
  const existing = await tx.prepaidAccount.findUnique({ where: { customerId } });
  if (existing) return existing;
  return tx.prepaidAccount.create({ data: { customerId } });
}

/** Suy hạng theo tổng chi tiêu — hạng cao nhất mà lifetimeSpend đạt ngưỡng. */
async function recomputeTier(accountId: string, lifetimeSpend: number, tx: Prisma.TransactionClient) {
  const tiers = await tx.membershipTier.findMany({ where: { isActive: true }, orderBy: { minLifetimeSpend: "desc" } });
  const match = tiers.find((t) => lifetimeSpend >= num(t.minLifetimeSpend));
  await tx.loyaltyAccount.update({ where: { id: accountId }, data: { tierId: match?.id ?? null } });
  return match ?? null;
}

// -----------------------------------------------------------------------------
// ĐIỂM — tích từ tiền thực thu (Payment chưa hủy), idempotent theo payment.
// -----------------------------------------------------------------------------
export async function earnPointsForPayment(session: SessionPayload, paymentId: string): Promise<{ earned: number } | { skipped: string }> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new LoyaltyError("Không tìm thấy phiếu thu", 404);
  if (p.voidedAt) return { skipped: "Phiếu thu đã hủy" };
  const amount = num(p.amount);
  if (amount <= 0) return { skipped: "Số tiền = 0" };

  return prisma.$transaction(async (tx) => {
    const acc = await ensureLoyaltyAccount(p.customerId, tx);
    // Idempotent: 1 phiếu thu chỉ tích 1 lần.
    const dup = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: `EARN:${paymentId}` } }).catch(() => null);
    if (dup) return { earned: dup.points };
    // tỷ lệ theo hạng hiện tại (nếu có) hoặc mặc định.
    const tier = acc.tierId ? await tx.membershipTier.findUnique({ where: { id: acc.tierId } }) : null;
    const rate = tier ? num(tier.pointsPerThousand) : DEFAULT_POINTS_PER_THOUSAND;
    const earned = Math.floor((amount / 1000) * rate);
    const newBalance = acc.pointsBalance + earned;
    const newLifetime = num(acc.lifetimeSpend) + amount;
    try {
      await tx.loyaltyTransaction.create({ data: { loyaltyAccountId: acc.id, type: "EARN", points: earned, balanceAfter: newBalance, sourceType: "PAYMENT", sourceId: paymentId, idempotencyKey: `EARN:${paymentId}`, createdBy: actor(session) } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { const ex = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey: `EARN:${paymentId}` } }); return { earned: ex?.points ?? 0 }; }
      throw e;
    }
    await tx.loyaltyAccount.update({ where: { id: acc.id }, data: { pointsBalance: newBalance, lifetimeSpend: new Prisma.Decimal(newLifetime) } });
    await recomputeTier(acc.id, newLifetime, tx);
    await auditLog({ userId: session.userId, action: "LOYALTY_POINTS_EARNED", entityType: "LoyaltyAccount", entityId: acc.id, changes: { paymentId, earned } });
    return { earned };
  });
}

/** Điều chỉnh điểm thủ công (dương/âm) — không hard-delete. */
export async function adjustPoints(session: SessionPayload, customerId: string, points: number, note: string): Promise<number> {
  if (!Number.isInteger(points) || points === 0) throw new LoyaltyError("Số điểm điều chỉnh không hợp lệ", 422);
  return prisma.$transaction(async (tx) => {
    const acc = await ensureLoyaltyAccount(customerId, tx);
    const newBalance = acc.pointsBalance + points;
    if (newBalance < 0) throw new LoyaltyError("Điểm không đủ để trừ", 422);
    await tx.loyaltyTransaction.create({ data: { loyaltyAccountId: acc.id, type: "ADJUST", points, balanceAfter: newBalance, sourceType: "MANUAL", note, createdBy: actor(session) } });
    await tx.loyaltyAccount.update({ where: { id: acc.id }, data: { pointsBalance: newBalance } });
    await auditLog({ userId: session.userId, action: "LOYALTY_POINTS_ADJUSTED", entityType: "LoyaltyAccount", entityId: acc.id, changes: { points, note } });
    return newBalance;
  });
}

/** ĐỔI điểm → cộng VÍ TRẢ TRƯỚC (giá trị lưu trữ). */
export async function redeemPointsToPrepaid(session: SessionPayload, customerId: string, points: number): Promise<{ pointsBalance: number; prepaidBalance: number; credited: number }> {
  if (!Number.isInteger(points) || points <= 0) throw new LoyaltyError("Số điểm đổi không hợp lệ", 422);
  return prisma.$transaction(async (tx) => {
    const acc = await ensureLoyaltyAccount(customerId, tx);
    if (acc.pointsBalance < points) throw new LoyaltyError("Không đủ điểm để đổi", 422);
    const credited = points * REDEEM_RATE;
    const newPoints = acc.pointsBalance - points;
    await tx.loyaltyTransaction.create({ data: { loyaltyAccountId: acc.id, type: "REDEEM", points: -points, balanceAfter: newPoints, sourceType: "REDEEM_TO_PREPAID", note: `Đổi ${points} điểm = ${credited}₫ vào ví`, createdBy: actor(session) } });
    await tx.loyaltyAccount.update({ where: { id: acc.id }, data: { pointsBalance: newPoints } });
    // cộng ví
    const pre = await ensurePrepaidAccount(customerId, tx);
    const locked = await tx.$queryRaw<{ balance: string }[]>`SELECT balance FROM prepaid_accounts WHERE id = ${pre.id} FOR UPDATE`;
    const bal = num(locked[0]?.balance) + credited;
    await tx.prepaidTransaction.create({ data: { prepaidAccountId: pre.id, type: "TOP_UP", amount: new Prisma.Decimal(credited), balanceAfter: new Prisma.Decimal(bal), sourceType: "LOYALTY_REDEEM", note: `Từ ${points} điểm`, createdBy: actor(session) } });
    await tx.prepaidAccount.update({ where: { id: pre.id }, data: { balance: new Prisma.Decimal(bal) } });
    await auditLog({ userId: session.userId, action: "LOYALTY_POINTS_REDEEMED", entityType: "LoyaltyAccount", entityId: acc.id, changes: { points, credited } });
    return { pointsBalance: newPoints, prepaidBalance: bal, credited };
  });
}

// -----------------------------------------------------------------------------
// VÍ TRẢ TRƯỚC — nạp/trừ với khóa dòng, chặn âm.
// -----------------------------------------------------------------------------
export async function topUpPrepaid(session: SessionPayload, customerId: string, amount: number, opts: { method?: string; note?: string } = {}): Promise<number> {
  if (amount <= 0) throw new LoyaltyError("Số tiền nạp phải > 0", 422);
  return prisma.$transaction(async (tx) => {
    const pre = await ensurePrepaidAccount(customerId, tx);
    const locked = await tx.$queryRaw<{ balance: string }[]>`SELECT balance FROM prepaid_accounts WHERE id = ${pre.id} FOR UPDATE`;
    const bal = num(locked[0]?.balance) + amount;
    await tx.prepaidTransaction.create({ data: { prepaidAccountId: pre.id, type: "TOP_UP", amount: new Prisma.Decimal(amount), balanceAfter: new Prisma.Decimal(bal), method: (opts.method as any) ?? "CASH", sourceType: "MANUAL", note: opts.note ?? null, createdBy: actor(session) } });
    await tx.prepaidAccount.update({ where: { id: pre.id }, data: { balance: new Prisma.Decimal(bal) } });
    await auditLog({ userId: session.userId, action: "PREPAID_TOPPED_UP", entityType: "PrepaidAccount", entityId: pre.id, changes: { amount } });
    return bal;
  });
}

export async function redeemPrepaid(session: SessionPayload, customerId: string, amount: number, opts: { invoiceId?: string; note?: string } = {}): Promise<number> {
  if (amount <= 0) throw new LoyaltyError("Số tiền trừ phải > 0", 422);
  return prisma.$transaction(async (tx) => {
    const pre = await ensurePrepaidAccount(customerId, tx);
    const locked = await tx.$queryRaw<{ balance: string }[]>`SELECT balance FROM prepaid_accounts WHERE id = ${pre.id} FOR UPDATE`;
    const cur = num(locked[0]?.balance);
    if (cur < amount) throw new LoyaltyError("Số dư ví không đủ", 422);
    const bal = cur - amount;
    await tx.prepaidTransaction.create({ data: { prepaidAccountId: pre.id, type: "REDEEM", amount: new Prisma.Decimal(-amount), balanceAfter: new Prisma.Decimal(bal), sourceType: opts.invoiceId ? "INVOICE" : "MANUAL", sourceId: opts.invoiceId ?? null, note: opts.note ?? null, createdBy: actor(session) } });
    await tx.prepaidAccount.update({ where: { id: pre.id }, data: { balance: new Prisma.Decimal(bal) } });
    await auditLog({ userId: session.userId, action: "PREPAID_REDEEMED", entityType: "PrepaidAccount", entityId: pre.id, changes: { amount, invoiceId: opts.invoiceId ?? null } });
    return bal;
  });
}

export async function refundPrepaid(session: SessionPayload, customerId: string, amount: number, note: string): Promise<number> {
  if (amount <= 0) throw new LoyaltyError("Số tiền hoàn phải > 0", 422);
  return prisma.$transaction(async (tx) => {
    const pre = await ensurePrepaidAccount(customerId, tx);
    const locked = await tx.$queryRaw<{ balance: string }[]>`SELECT balance FROM prepaid_accounts WHERE id = ${pre.id} FOR UPDATE`;
    const cur = num(locked[0]?.balance);
    if (cur < amount) throw new LoyaltyError("Số dư ví không đủ để hoàn", 422);
    const bal = cur - amount;
    await tx.prepaidTransaction.create({ data: { prepaidAccountId: pre.id, type: "REFUND", amount: new Prisma.Decimal(-amount), balanceAfter: new Prisma.Decimal(bal), sourceType: "MANUAL", note, createdBy: actor(session) } });
    await tx.prepaidAccount.update({ where: { id: pre.id }, data: { balance: new Prisma.Decimal(bal) } });
    await auditLog({ userId: session.userId, action: "PREPAID_REFUNDED", entityType: "PrepaidAccount", entityId: pre.id, changes: { amount } });
    return bal;
  });
}

// -----------------------------------------------------------------------------
// VOUCHER — kiểm tra hợp lệ + tính giảm; dùng (append-only, giới hạn lượt).
// -----------------------------------------------------------------------------
export function computeVoucherDiscount(v: { type: string; value: any; maxDiscount: any }, spend: number): number {
  let d = v.type === "FIXED" ? num(v.value) : (num(v.value) / 100) * spend;
  if (v.type === "PERCENT" && v.maxDiscount != null) d = Math.min(d, num(v.maxDiscount));
  d = Math.min(d, spend); // không vượt số chi tiêu
  return Math.round(d);
}

export async function validateVoucher(code: string, spend: number, customerId?: string): Promise<{ ok: true; voucher: any; discount: number } | { ok: false; reason: string }> {
  const v = await prisma.voucher.findUnique({ where: { code } });
  if (!v) return { ok: false, reason: "Voucher không tồn tại" };
  if (v.status !== "ACTIVE") return { ok: false, reason: `Voucher ${v.status === "USED" ? "đã dùng hết" : v.status === "EXPIRED" ? "đã hết hạn" : "không hiệu lực"}` };
  if (v.expiresAt && v.expiresAt.getTime() < now().getTime()) return { ok: false, reason: "Voucher đã hết hạn" };
  if (v.redeemedCount >= v.maxRedemptions) return { ok: false, reason: "Voucher đã dùng hết lượt" };
  if (v.customerId && customerId && v.customerId !== customerId) return { ok: false, reason: "Voucher không thuộc khách này" };
  if (v.minSpend != null && spend < num(v.minSpend)) return { ok: false, reason: `Chi tiêu tối thiểu ${num(v.minSpend)}₫` };
  return { ok: true, voucher: v, discount: computeVoucherDiscount(v, spend) };
}

export async function redeemVoucher(session: SessionPayload, code: string, opts: { spend: number; customerId?: string; invoiceId?: string }): Promise<{ discount: number; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<any[]>`SELECT * FROM vouchers WHERE code = ${code} FOR UPDATE`;
    if (!locked.length) throw new LoyaltyError("Voucher không tồn tại", 404);
    const v = await tx.voucher.findUnique({ where: { code } });
    if (!v) throw new LoyaltyError("Voucher không tồn tại", 404);
    // Idempotent theo voucher+hóa đơn — kiểm TRƯỚC validate (dùng lại cùng hóa đơn
    // không bị chặn "đã dùng hết").
    const idem = opts.invoiceId ? `VR:${v.id}:${opts.invoiceId}` : null;
    if (idem) { const dup = await tx.voucherRedemption.findUnique({ where: { idempotencyKey: idem } }).catch(() => null); if (dup) return { discount: num(dup.discountAmount), remaining: v.maxRedemptions - v.redeemedCount }; }
    const check = await validateVoucher(code, opts.spend, opts.customerId);
    if (!check.ok) throw new LoyaltyError(check.reason, 422);
    const discount = check.discount;
    await tx.voucherRedemption.create({ data: { voucherId: v.id, customerId: opts.customerId ?? null, invoiceId: opts.invoiceId ?? null, spendAmount: new Prisma.Decimal(opts.spend), discountAmount: new Prisma.Decimal(discount), idempotencyKey: idem, createdBy: actor(session) } });
    const newCount = v.redeemedCount + 1;
    await tx.voucher.update({ where: { id: v.id }, data: { redeemedCount: newCount, status: newCount >= v.maxRedemptions ? "USED" : "ACTIVE" } });
    await auditLog({ userId: session.userId, action: "VOUCHER_REDEEMED", entityType: "Voucher", entityId: v.id, changes: { code, discount, invoiceId: opts.invoiceId ?? null } });
    return { discount, remaining: v.maxRedemptions - newCount };
  });
}

/** Tổng hợp cho màn khách: điểm/hạng/ví + lịch sử gần đây + voucher. */
export async function loyaltySummary(customerId: string) {
  const [loy, pre, vouchers] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { customerId }, include: { tier: true, transactions: { orderBy: { createdAt: "desc" }, take: 20 } } }),
    prisma.prepaidAccount.findUnique({ where: { customerId }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } } }),
    prisma.voucher.findMany({ where: { OR: [{ customerId }, { customerId: null, status: "ACTIVE" }] }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    points: loy?.pointsBalance ?? 0,
    tier: loy?.tier ? { code: loy.tier.code, name: loy.tier.name } : null,
    lifetimeSpend: num(loy?.lifetimeSpend),
    prepaidBalance: num(pre?.balance),
    loyaltyTransactions: loy?.transactions ?? [],
    prepaidTransactions: pre?.transactions ?? [],
    vouchers,
  };
}
