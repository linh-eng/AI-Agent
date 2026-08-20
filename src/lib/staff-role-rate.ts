// =============================================================================
// ② Chi phí nhân sự theo VAI TRÒ — bảng đơn giá dùng chung (catalog) + dựng dòng
// chi phí nhân sự mặc định cho Giá vốn dịch vụ (từ staffRequirements của dịch vụ).
// Dữ liệu tài chính (baseFee/bonus/tips/commission) — mask theo finance.read ở route.
// =============================================================================
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Một dòng chi phí nhân sự (trong version Giá vốn) theo vai trò. */
export interface LaborCostLine {
  roleCode?: string | null; // liên kết mềm tới StaffRoleRate.code (nếu lấy từ bảng đơn giá)
  roleName: string; // tên vai trò (bắt buộc)
  certified?: boolean | null;
  quantity?: number; // số người/lượt (mặc định 1)
  baseFee?: number; // phí cơ bản
  bonus?: number; // thưởng
  tips?: number; // tips
  commission?: number; // hoa hồng (tiền)
  source?: "CATALOG" | "OVERRIDE" | null; // nguồn: từ bảng đơn giá hay ghi đè tại dịch vụ
}

/** Tiền 1 dòng = quantity × (baseFee + bonus + tips + commission). */
export function laborLineAmount(l: LaborCostLine): number {
  const per = num(l.baseFee) + num(l.bonus) + num(l.tips) + num(l.commission);
  return (num(l.quantity) || 1) * per;
}

/** Chuẩn hóa danh sách dòng nhân sự + tổng tiền. Bỏ dòng thiếu tên vai trò. */
export function normalizeLaborLines(lines?: LaborCostLine[] | null): { lines: LaborCostLine[]; total: number } {
  const arr = Array.isArray(lines)
    ? lines
        .filter((l) => l && String(l.roleName ?? "").trim())
        .map((l) => ({
          roleCode: l.roleCode ?? null,
          roleName: String(l.roleName).trim(),
          certified: l.certified ?? null,
          quantity: num(l.quantity) || 1,
          baseFee: num(l.baseFee),
          bonus: num(l.bonus),
          tips: num(l.tips),
          commission: num(l.commission),
          source: (l.source as any) ?? "OVERRIDE",
        }))
    : [];
  return { lines: arr, total: arr.reduce((s, l) => s + laborLineAmount(l), 0) };
}

/** Sinh mã vai trò kế tiếp VR-xxxxxx. */
export async function nextRoleRateCode(tx: Prisma.TransactionClient = prisma): Promise<string> {
  const count = await tx.staffRoleRate.count();
  return `VR-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Dựng DÒNG chi phí nhân sự MẶC ĐỊNH cho một dịch vụ từ `staffRequirements`
 * (mỗi yêu cầu vai trò → 1 dòng) khớp với bảng đơn giá `StaffRoleRate` theo TÊN
 * vai trò (không phân biệt hoa/thường). Không khớp → dòng 0 (cảnh báo ở caller).
 * Đây là gợi ý; người dùng ghi đè/thêm tại dịch vụ.
 */
export async function buildLaborLinesFromCatalog(
  serviceId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<{ lines: LaborCostLine[]; warnings: string[] }> {
  const service = await tx.service.findUnique({ where: { id: serviceId }, select: { staffRequirements: true } });
  const req = Array.isArray(service?.staffRequirements) ? (service!.staffRequirements as any[]) : [];
  const rates = await tx.staffRoleRate.findMany({ where: { isActive: true } });
  const byName = new Map(rates.map((r) => [r.roleName.trim().toLowerCase(), r] as const));

  const lines: LaborCostLine[] = [];
  const warnings: string[] = [];
  for (const r of req) {
    const roleName = String(r.role ?? "").trim();
    if (!roleName) continue;
    const quantity = num(r.quantity) || 1;
    const rate = byName.get(roleName.toLowerCase());
    if (!rate) {
      warnings.push(`Vai trò "${roleName}" chưa có trong Bảng đơn giá vai trò — dòng nhân sự tạm tính 0.`);
      lines.push({ roleName, quantity, baseFee: 0, bonus: 0, tips: 0, commission: 0, source: "OVERRIDE" });
      continue;
    }
    lines.push({
      roleCode: rate.code,
      roleName: rate.roleName,
      certified: rate.certified,
      quantity,
      baseFee: num(rate.baseFee),
      bonus: num(rate.bonus),
      tips: num(rate.tips),
      commission: num(rate.commission),
      source: "CATALOG",
    });
  }
  return { lines, warnings };
}
