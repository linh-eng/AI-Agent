// =============================================================================
// Dịch vụ nghiệp vụ NHẬP — logic tạo phiếu & nhận hàng (đặt tồn).
// Toàn bộ bước "nhận hàng" chạy trong 1 transaction: sinh serial/lot +
// xuất xứ (origin) + bảo hành (2 tầng) + biến động tồn + timeline serial.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getInboundConfig } from "./inbound";
import { HttpError } from "./session";
import type { z } from "zod";
import type { inboundCreateSchema, inboundReceiveSchema } from "./validation";

type CreateInput = z.infer<typeof inboundCreateSchema>;
type ReceiveInput = z.infer<typeof inboundReceiveSchema>;

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

/** Sinh số phiếu nhập dạng IN-YYYY-#### theo thứ tự trong năm. */
async function nextInboundNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IN-${year}-`;
  const count = await tx.inboundOrder.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Tạo phiếu nhập (trạng thái DRAFT) kèm các dòng. Kiểm checklist theo loại. */
export async function createInbound(input: CreateInput, userId: string) {
  const config = getInboundConfig(input.type);
  if (!config) throw new HttpError(422, "Loại nghiệp vụ không hợp lệ");

  // Checklist chứng từ bắt buộc theo loại
  if (config.requiredDocs.includes("supplier") && !input.supplierId) {
    throw new HttpError(422, `Loại ${config.code} yêu cầu Nhà cung cấp`);
  }
  if (config.requiredDocs.includes("po") && !input.poNumber) {
    throw new HttpError(422, `Loại ${config.code} yêu cầu số PO/HĐ mua`);
  }
  if (config.requiredDocs.includes("invoice") && !input.invoiceNumber) {
    throw new HttpError(422, `Loại ${config.code} yêu cầu hóa đơn GTGT`);
  }
  // Ràng buộc dự án/thương mại đã được kiểm ở từng dòng (Zod refine).

  // Kho đích: ưu tiên chỉ định, nếu không lấy mặc định theo loại
  let destinationWarehouseId = input.destinationWarehouseId ?? null;
  if (!destinationWarehouseId && config.destinationWarehouseCode) {
    const wh = await prisma.warehouse.findUnique({
      where: { code: config.destinationWarehouseCode },
    });
    destinationWarehouseId = wh?.id ?? null;
  }

  return prisma.$transaction(async (tx) => {
    const number = await nextInboundNumber(tx);
    const order = await tx.inboundOrder.create({
      data: {
        number,
        type: input.type,
        supplierId: input.supplierId ?? null,
        poNumber: input.poNumber ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        destinationWarehouseId,
        status: "DRAFT",
        note: input.note ?? null,
        lines: {
          create: input.lines.map((l) => ({
            productId: l.productId,
            supplierId: l.supplierId,
            projectId: l.projectId ?? null,
            isCommercialStock: l.isCommercialStock,
            quantity: l.quantity,
            yearOfManufacture: l.yearOfManufacture ?? null,
            originCountry: l.originCountry ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.auditLog.create({
      data: { userId, action: "CREATE", entityType: "InboundOrder", entityId: order.id },
    });
    return order;
  });
}

/**
 * Nhận hàng cho một phiếu: đặt tồn theo tracking_mode của từng sản phẩm.
 * Hàng lỗi (isDefective) chuyển thẳng kho K-HH.
 */
export async function receiveInbound(
  orderId: string,
  input: ReceiveInput,
  userId: string
) {
  const order = await prisma.inboundOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) throw new HttpError(404, "Không tìm thấy phiếu nhập");
  if (order.status === "APPROVED") throw new HttpError(409, "Phiếu đã nhận hàng");

  const config = getInboundConfig(order.type);
  const destWh = order.destinationWarehouseId
    ? await prisma.warehouse.findUnique({ where: { id: order.destinationWarehouseId } })
    : config?.destinationWarehouseCode
    ? await prisma.warehouse.findUnique({ where: { code: config.destinationWarehouseCode } })
    : null;
  if (!destWh) throw new HttpError(422, "Chưa xác định được kho đích");

  const damagedWh = await prisma.warehouse.findUnique({ where: { code: "K-HH" } });

  const lineById = new Map(order.lines.map((l) => [l.id, l]));

  const result = await prisma.$transaction(async (tx) => {
    const createdSerials: string[] = [];
    const createdLots: string[] = [];

    for (const rl of input.lines) {
      const line = lineById.get(rl.lineId);
      if (!line) throw new HttpError(422, `Dòng ${rl.lineId} không thuộc phiếu`);

      const targetWhId = rl.isDefective && damagedWh ? damagedWh.id : destWh.id;

      // --- SERIAL ---
      if (rl.serials?.length) {
        for (const s of rl.serials) {
          const serial = await tx.serial.create({
            data: {
              serialNumber: s.serialNumber,
              productId: line.productId,
              warehouseId: targetWhId,
              status: rl.isDefective ? "DAMAGED" : "IN_STOCK",
              condition: s.condition ?? null,
              grade: s.grade ?? null,
              supplierId: line.supplierId,
              projectId: line.projectId,
              isCommercialStock: line.isCommercialStock,
              poNumber: order.poNumber,
              invoiceNumber: order.invoiceNumber,
              yearOfManufacture: s.yearOfManufacture ?? line.yearOfManufacture ?? null,
              originCountry: s.originCountry ?? line.originCountry ?? null,
              binId: s.binId ?? null,
            },
          });
          createdSerials.push(serial.serialNumber);

          // Xuất xứ (CO/CQ/tờ khai HQ)
          if (s.origin) {
            await tx.origin.create({
              data: {
                serialId: serial.id,
                countryOfOrigin: s.origin.countryOfOrigin ?? s.originCountry ?? null,
                supplierId: line.supplierId,
                poNumber: s.origin.poNumber ?? order.poNumber,
                coNumber: s.origin.coNumber ?? null,
                cqNumber: s.origin.cqNumber ?? null,
                customsDeclarationNo: s.origin.customsDeclarationNo ?? null,
              },
            });
          }
          // Bảo hành hãng (NCC)
          if (s.vendorWarranty?.startDate || s.vendorWarranty?.endDate) {
            await tx.warranty.create({
              data: {
                serialId: serial.id,
                provider: "VENDOR",
                startDate: toDate(s.vendorWarranty.startDate),
                endDate: toDate(s.vendorWarranty.endDate),
                terms: s.vendorWarranty.terms ?? null,
              },
            });
          }
          // Bảo hành THNG cấp khách
          if (s.thngWarranty?.startDate || s.thngWarranty?.endDate) {
            await tx.warranty.create({
              data: {
                serialId: serial.id,
                provider: "THNG",
                startDate: toDate(s.thngWarranty.startDate),
                endDate: toDate(s.thngWarranty.endDate),
                terms: s.thngWarranty.terms ?? null,
              },
            });
          }
          // Biến động tồn + timeline
          await tx.stockMovement.create({
            data: {
              type: "INBOUND",
              serialId: serial.id,
              toWarehouseId: targetWhId,
              documentType: "INBOUND_ORDER",
              documentNumber: order.number,
              note: rl.isDefective ? "Nhập hàng lỗi -> K-HH" : "Nhập kho",
              createdBy: userId,
            },
          });
          await tx.serialEvent.create({
            data: {
              serialId: serial.id,
              eventType: "INBOUND",
              toStatus: rl.isDefective ? "DAMAGED" : "IN_STOCK",
              detail: { inbound: order.number, type: order.type },
              createdBy: userId,
            },
          });
        }
      }

      // --- LOT ---
      if (rl.lot) {
        const lot = await tx.lot.upsert({
          where: {
            productId_lotNumber_warehouseId: {
              productId: line.productId,
              lotNumber: rl.lot.lotNumber,
              warehouseId: targetWhId,
            },
          },
          update: { quantity: { increment: rl.lot.quantity } },
          create: {
            productId: line.productId,
            lotNumber: rl.lot.lotNumber,
            warehouseId: targetWhId,
            quantity: rl.lot.quantity,
            supplierId: line.supplierId,
            projectId: line.projectId,
            isCommercialStock: line.isCommercialStock,
            manufactureDate: toDate(rl.lot.manufactureDate),
            expiryDate: toDate(rl.lot.expiryDate),
          },
        });
        createdLots.push(lot.lotNumber);

        if (rl.lot.origin) {
          await tx.origin.create({
            data: {
              lotId: lot.id,
              countryOfOrigin: rl.lot.origin.countryOfOrigin ?? null,
              supplierId: line.supplierId,
              poNumber: rl.lot.origin.poNumber ?? order.poNumber,
              coNumber: rl.lot.origin.coNumber ?? null,
              cqNumber: rl.lot.origin.cqNumber ?? null,
              customsDeclarationNo: rl.lot.origin.customsDeclarationNo ?? null,
            },
          });
        }
        if (rl.lot.vendorWarranty?.startDate || rl.lot.vendorWarranty?.endDate) {
          await tx.warranty.create({
            data: {
              lotId: lot.id,
              provider: "VENDOR",
              startDate: toDate(rl.lot.vendorWarranty.startDate),
              endDate: toDate(rl.lot.vendorWarranty.endDate),
              terms: rl.lot.vendorWarranty.terms ?? null,
            },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: "INBOUND",
            lotId: lot.id,
            quantity: rl.lot.quantity,
            toWarehouseId: targetWhId,
            documentType: "INBOUND_ORDER",
            documentNumber: order.number,
            note: "Nhập lô",
            createdBy: userId,
          },
        });
      }

      // --- QUANTITY (không quản serial/lô) ---
      if (rl.quantity && !rl.serials?.length && !rl.lot) {
        await tx.stockMovement.create({
          data: {
            type: "INBOUND",
            quantity: rl.quantity,
            toWarehouseId: targetWhId,
            documentType: "INBOUND_ORDER",
            documentNumber: order.number,
            note: `Nhập số lượng (${line.product.sku})`,
            createdBy: userId,
          },
        });
      }
    }

    const updated = await tx.inboundOrder.update({
      where: { id: order.id },
      data: { status: "APPROVED" },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "RECEIVE",
        entityType: "InboundOrder",
        entityId: order.id,
        changes: { serials: createdSerials.length, lots: createdLots.length },
      },
    });

    return { order: updated, createdSerials, createdLots };
  });

  return result;
}
