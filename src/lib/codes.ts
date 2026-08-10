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
