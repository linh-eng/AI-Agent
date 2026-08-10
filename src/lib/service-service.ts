// =============================================================================
// Ghi nhận thực hiện dịch vụ/liệu trình: mở rộng định mức tiêu hao theo số lượt,
// tự tạo phiếu xuất INTERNAL_USE (trừ kho theo FEFO) và lưu lịch sử sử dụng.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextServiceUsageCode } from "./codes";
import { createIssue } from "./outbound-service";

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

  return { id: usage.id, code: usage.code, issueId: issue.id, issueCode: issue.code };
}
