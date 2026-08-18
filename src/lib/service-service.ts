// =============================================================================
// Ghi nhận thực hiện dịch vụ/liệu trình: mở rộng định mức tiêu hao theo số lượt,
// tự tạo phiếu xuất INTERNAL_USE (trừ kho theo FEFO) và lưu lịch sử sử dụng.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextServiceUsageCode } from "./codes";
import { createIssue, reverseAndCancelIssueTx } from "./outbound-service";
import { applyServiceStock } from "./service-stock-service";

export interface ServiceUsageInput {
  serviceId: string;
  warehouseId: string;
  sessions: number;
  customerName?: string | null;
  note?: string | null;
}

export async function recordServiceUsage(input: ServiceUsageInput, userId: string) {
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { items: { include: { product: true } } },
  });
  if (!service) throw new HttpError(404, "Không tìm thấy dịch vụ");
  if (!service.isActive) throw new HttpError(400, "Dịch vụ đã ngừng áp dụng");
  if (service.items.length === 0)
    throw new HttpError(400, `Liệu trình "${service.name}" chưa khai báo định mức tiêu hao`);
  if (input.sessions < 1) throw new HttpError(400, "Số lượt phải >= 1");

  // Mở rộng định mức theo số lượt.
  const issueItems = service.items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity * input.sessions,
    batchId: null as string | null,
  }));

  // Tạo phiếu xuất tiêu hao (FEFO + chặn vượt tồn nằm trong createIssue).
  const issue = await createIssue(
    {
      warehouseId: input.warehouseId,
      issueType: "INTERNAL_USE",
      customerName: input.customerName ?? null,
      note: `Tiêu hao dịch vụ: ${service.name} × ${input.sessions} lượt`,
      items: issueItems,
    },
    userId
  );

  // Chốt doanh thu (đơn giá × số lượt) và giá vốn vật tư tiêu hao (theo lô đã xuất).
  const revenue = service.price != null ? service.price * input.sessions : null;
  const issueDetail = await prisma.goodsIssue.findUnique({
    where: { id: issue.id },
    include: { items: { include: { batch: true } } },
  });
  const cost =
    issueDetail?.items.reduce((s, it) => s + it.quantity * (it.batch?.unitCost ?? 0), 0) ?? 0;

  const code = await nextServiceUsageCode();
  const usage = await prisma.serviceUsage.create({
    data: {
      code,
      serviceId: service.id,
      warehouseId: input.warehouseId,
      sessions: input.sessions,
      customerName: input.customerName ?? null,
      revenue,
      cost,
      note: input.note ?? null,
      issueId: issue.id,
      issueCode: issue.code,
      performedById: userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "SERVICE_USAGE",
      entityType: "ServiceUsage",
      entityId: usage.id,
      detail: `${code} → ${issue.code}`,
    },
  });

  // Cập nhật Kho Dịch Vụ (sổ theo dõi hàng đã mở nắp) — không chặn nếu lỗi.
  await applyServiceStock(
    issueItems.map((i) => ({ productId: i.productId, qty: i.quantity })),
    input.warehouseId,
    userId
  ).catch((e) => console.error("[service-stock] applyServiceStock lỗi:", e));

  return { id: usage.id, code: usage.code, issueId: issue.id, issueCode: issue.code };
}

/**
 * Hủy 1 ghi nhận dịch vụ: hoàn tồn kho bằng cách hủy phiếu xuất tiêu hao liên
 * quan (đảo bút toán) rồi xóa bản ghi ghi nhận (để không còn tính vào doanh thu).
 * Giữ phiếu xuất ở trạng thái ĐÃ HỦY để tra cứu. Bắt buộc lý do.
 */
export async function cancelServiceUsage(id: string, reason: string, userId: string) {
  const usage = await prisma.serviceUsage.findUnique({ where: { id } });
  if (!usage) throw new HttpError(404, "Không tìm thấy ghi nhận dịch vụ");

  return prisma.$transaction(async (tx) => {
    if (usage.issueId) {
      await reverseAndCancelIssueTx(
        tx,
        usage.issueId,
        `Hủy ghi nhận dịch vụ ${usage.code}: ${reason}`,
        "Hủy ghi nhận dịch vụ"
      );
    }
    await tx.serviceUsage.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId,
        action: "SERVICE_USAGE_CANCEL",
        entityType: "ServiceUsage",
        entityId: id,
        detail: `${usage.code}${usage.issueCode ? ` → hủy ${usage.issueCode}` : ""} — ${reason}`,
      },
    });
    return { id: usage.id, code: usage.code, issueCode: usage.issueCode };
  });
}
