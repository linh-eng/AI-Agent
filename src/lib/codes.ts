// Sinh mã chứng từ theo tiền tố + ngày + số thứ tự trong ngày.
import { prisma } from "./prisma";

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** PN-20260810-0001 (nhập) / PX-20260810-0001 (xuất). */
export async function nextReceiptCode(): Promise<string> {
  const prefix = `PN-${ymd()}`;
  const count = await prisma.goodsReceipt.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextIssueCode(): Promise<string> {
  const prefix = `PX-${ymd()}`;
  const count = await prisma.goodsIssue.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** PC-20260810-0001 — phiếu chuyển kho. */
export async function nextTransferCode(): Promise<string> {
  const prefix = `PC-${ymd()}`;
  const count = await prisma.stockTransfer.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** SV-20260810-0001 — ghi nhận thực hiện dịch vụ. */
export async function nextServiceUsageCode(): Promise<string> {
  const prefix = `SV-${ymd()}`;
  const count = await prisma.serviceUsage.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** TS-0001 — mã tài sản (tuần tự toàn cục). */
export async function nextAssetCode(): Promise<string> {
  const count = await prisma.asset.count();
  return `TS-${String(count + 1).padStart(4, "0")}`;
}

/** TC-0001 — mã tay cầm (tuần tự toàn cục). */
export async function nextHandpieceCode(): Promise<string> {
  const count = await prisma.handpiece.count();
  return `TC-${String(count + 1).padStart(4, "0")}`;
}

/** PK-20260810-0001 — phiếu kiểm kê. */
export async function nextStockCountCode(): Promise<string> {
  const prefix = `PK-${ymd()}`;
  const count = await prisma.stockCount.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
