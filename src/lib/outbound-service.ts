// =============================================================================
// Dịch vụ XUẤT kho (M6–M8):
//   tạo phiếu -> trình duyệt -> kế toán duyệt (kiểm tồn khả dụng / công nợ)
//   -> picking + quét 100% serial (chặn sai serial, vượt tồn, khóa K-DA)
//   -> đóng gói & bàn giao (delivery report: mã vận đơn, ký điện tử).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { getOutboundConfig } from "./outbound";
import { getAvailableQty } from "./inventory";
import type { z } from "zod";
import type { outboundCreateSchema, outboundShipSchema } from "./validation";

type CreateInput = z.infer<typeof outboundCreateSchema>;
type ShipInput = z.infer<typeof outboundShipSchema>;

async function nextOutboundNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OUT-${year}-`;
  const count = await tx.outboundOrder.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function nextDeliveryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GH-${year}-`;
  const count = await tx.deliveryReport.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createOutbound(input: CreateInput, userId: string) {
  const config = getOutboundConfig(input.type);
  if (!config) throw new HttpError(422, "Loại nghiệp vụ không hợp lệ");
  if (config.requiresCustomer && !input.customerId) {
    throw new HttpError(422, `Loại ${config.code} yêu cầu Khách hàng`);
  }
  if (config.requiresProject && !input.projectId) {
    throw new HttpError(422, `Loại ${config.code} yêu cầu Dự án`);
  }

  return prisma.$transaction(async (tx) => {
    const number = await nextOutboundNumber(tx);
    const order = await tx.outboundOrder.create({
      data: {
        number,
        type: input.type,
        customerId: input.customerId ?? null,
        projectId: input.projectId ?? null,
        status: "DRAFT",
        note: input.note ?? null,
        lines: {
          create: input.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            projectId: l.projectId ?? input.projectId ?? null,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: { userId, action: "CREATE", entityType: "OutboundOrder", entityId: order.id },
    });
    return order;
  });
}

export async function submitOutbound(orderId: string) {
  const order = await prisma.outboundOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (order.status !== "DRAFT") throw new HttpError(409, "Chỉ phiếu nháp mới trình duyệt được");
  return prisma.outboundOrder.update({ where: { id: orderId }, data: { status: "PENDING_APPROVAL" } });
}

/** Kế toán duyệt: kiểm tra tồn khả dụng (chặn bán vượt tồn) + hạn mức công nợ. */
export async function approveOutbound(orderId: string, userId: string) {
  const order = await prisma.outboundOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } }, customer: true },
  });
  if (!order) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (order.status !== "PENDING_APPROVAL") throw new HttpError(409, "Phiếu chưa ở trạng thái chờ duyệt");

  // Chặn bán vượt tồn khả dụng
  for (const line of order.lines) {
    if (line.product.trackingMode === "SERIAL") {
      const avail = await getAvailableQty(line.productId);
      if (avail < line.quantity) {
        throw new HttpError(
          409,
          `Tồn khả dụng không đủ cho ${line.product.sku}: cần ${line.quantity}, còn ${avail}`
        );
      }
    }
  }

  // Kiểm tra hạn mức công nợ (nếu có cấu hình)
  if (order.customer?.creditLimit != null && Number(order.customer.creditLimit) <= 0) {
    throw new HttpError(409, "Khách hàng đã vượt/không có hạn mức công nợ — cần BGĐ phê duyệt");
  }

  const updated = await prisma.outboundOrder.update({
    where: { id: orderId },
    data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { userId, action: "APPROVE", entityType: "OutboundOrder", entityId: orderId },
  });
  return updated;
}

export async function rejectOutbound(orderId: string, reason: string, userId: string) {
  const order = await prisma.outboundOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (order.status !== "PENDING_APPROVAL") throw new HttpError(409, "Phiếu chưa ở trạng thái chờ duyệt");
  const updated = await prisma.outboundOrder.update({
    where: { id: orderId },
    data: { status: "REJECTED", rejectReason: reason },
  });
  await prisma.auditLog.create({
    data: { userId, action: "REJECT", entityType: "OutboundOrder", entityId: orderId, changes: { reason } },
  });
  return updated;
}

/**
 * Picking + xuất: quét 100% serial thực xuất.
 *   - sai serial / sai sản phẩm / không ở trạng thái khả dụng -> chặn
 *   - hàng khóa dự án (K-DA / serial.projectId) xuất sai dự án -> chặn
 *     (chỉ mở khi allowProjectOverride = true và người dùng có quyền duyệt)
 *   - serial -> trạng thái đích theo loại; ghi movement + event; sinh biên bản giao.
 */
export async function shipOutbound(
  orderId: string,
  input: ShipInput,
  userId: string,
  canOverride: boolean
) {
  const order = await prisma.outboundOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (order.status !== "APPROVED") throw new HttpError(409, "Phiếu chưa được duyệt");
  if (order.deliveredAt) throw new HttpError(409, "Phiếu đã giao hàng");

  const config = getOutboundConfig(order.type)!;
  const lineById = new Map(order.lines.map((l) => [l.id, l]));

  return prisma.$transaction(async (tx) => {
    const shipped: string[] = [];

    for (const rl of input.lines) {
      const line = lineById.get(rl.lineId);
      if (!line) throw new HttpError(422, `Dòng ${rl.lineId} không thuộc phiếu`);

      if (line.product.trackingMode === "SERIAL") {
        // Quét 100%
        if (rl.serialNumbers.length !== line.quantity) {
          throw new HttpError(
            422,
            `${line.product.sku}: cần quét đủ ${line.quantity} serial (đã quét ${rl.serialNumbers.length})`
          );
        }
        for (const sn of rl.serialNumbers) {
          const serial = await tx.serial.findUnique({
            where: { serialNumber: sn },
            include: { warehouse: true },
          });
          if (!serial) throw new HttpError(422, `Serial ${sn} không tồn tại`);
          if (serial.productId !== line.productId) {
            throw new HttpError(422, `Serial ${sn} không đúng sản phẩm của dòng`);
          }
          if (serial.status !== "IN_STOCK") {
            throw new HttpError(409, `Serial ${sn} không khả dụng (đang ${serial.status})`);
          }
          if (serial.parentSerialId) {
            throw new HttpError(409, `Serial ${sn} đang nằm trong máy lắp ráp`);
          }
          // Khóa dự án K-DA
          const lockedByProject =
            serial.projectId && serial.projectId !== order.projectId;
          if (lockedByProject && !canOverride) {
            throw new HttpError(
              409,
              `Serial ${sn} bị khóa theo dự án khác — cần BGĐ/kế toán phê duyệt để xuất`
            );
          }

          await tx.serial.update({
            where: { id: serial.id },
            data: { status: config.targetStatus },
          });
          await tx.stockMovement.create({
            data: {
              type: "OUTBOUND",
              serialId: serial.id,
              fromWarehouseId: serial.warehouseId,
              documentType: "OUTBOUND_ORDER",
              documentNumber: order.number,
              note: lockedByProject ? "Xuất (vượt khóa dự án - đã duyệt)" : "Xuất kho",
              createdBy: userId,
            },
          });
          await tx.serialEvent.create({
            data: {
              serialId: serial.id,
              eventType: "OUTBOUND",
              fromStatus: "IN_STOCK",
              toStatus: config.targetStatus,
              detail: { outbound: order.number, type: order.type, override: !!lockedByProject },
              createdBy: userId,
            },
          });
          shipped.push(sn);
        }
      } else {
        // LOT/QUANTITY: ghi biến động theo số lượng
        await tx.stockMovement.create({
          data: {
            type: "OUTBOUND",
            quantity: line.quantity,
            documentType: "OUTBOUND_ORDER",
            documentNumber: order.number,
            note: `Xuất số lượng (${line.product.sku})`,
            createdBy: userId,
          },
        });
      }
    }

    // Biên bản bàn giao
    const number = await nextDeliveryNumber(tx);
    const delivery = await tx.deliveryReport.create({
      data: {
        number,
        outboundOrderId: order.id,
        deliveredAt: new Date(),
        method: input.delivery?.method ?? null,
        carrier: input.delivery?.carrier ?? null,
        trackingNumber: input.delivery?.trackingNumber ?? null,
        signatureUrl: input.delivery?.signatureUrl ?? null,
        packingVideoUrl: input.delivery?.packingVideoUrl ?? null,
        serialNumbers: shipped.length ? shipped.join(",") : null,
      },
    });

    const updated = await tx.outboundOrder.update({
      where: { id: order.id },
      data: { deliveredAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "SHIP",
        entityType: "OutboundOrder",
        entityId: order.id,
        changes: { serials: shipped.length, delivery: number },
      },
    });

    return { order: updated, delivery, shippedSerials: shipped };
  });
}
