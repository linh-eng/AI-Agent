// =============================================================================
// Dịch vụ BẢO HÀNH / SỬA CHỮA / HƯ HỎNG (M9)
//   * Tiếp nhận máy khách (N3) -> K-BH-KH, hiển thị BH 2 tầng.
//   * Phân luồng: còn BH hãng -> X4 K-BH-NCC; sửa phí -> K-SC; hỏng -> K-HH.
//   * Hãng trả về (N4): serial cũ REPLACED, liên kết replaced_by, cập nhật
//     as-built BOM version mới; tự mở phiếu đòi BH ngược NCC nếu còn hạn hãng.
//   * K-HH: chốt hướng xử lý trong 15 ngày (SLA).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { SLA_DAYS, addDays } from "./sla";
import type { z } from "zod";
import type {
  warrantyIntakeCreateSchema,
  warrantyRouteSchema,
  vendorRmaReturnSchema,
  damagedResolveSchema,
} from "./validation";

type IntakeInput = z.infer<typeof warrantyIntakeCreateSchema>;
type RouteInput = z.infer<typeof warrantyRouteSchema>;
type ReturnInput = z.infer<typeof vendorRmaReturnSchema>;
type ResolveInput = z.infer<typeof damagedResolveSchema>;

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

async function seq(tx: Prisma.TransactionClient, prefix: string, model: "warrantyIntake" | "vendorRma" | "damagedItem" | "rmaTicket"): Promise<string> {
  const year = new Date().getFullYear();
  const p = `${prefix}-${year}-`;
  // @ts-expect-error truy cập động theo model
  const count = await tx[model].count({ where: { number: { startsWith: p } } });
  return `${p}${String(count + 1).padStart(4, "0")}`;
}

async function whId(code: string): Promise<string> {
  const wh = await prisma.warehouse.findUnique({ where: { code } });
  if (!wh) throw new HttpError(422, `Không tìm thấy kho ${code}`);
  return wh.id;
}

/** Tiếp nhận máy khách gửi bảo hành (N3). */
export async function createWarrantyIntake(input: IntakeInput, userId: string) {
  const serial = await prisma.serial.findUnique({
    where: { serialNumber: input.serialNumber },
    include: { warranties: true, product: true },
  });
  if (!serial) throw new HttpError(422, `Serial ${input.serialNumber} không tồn tại`);

  const bhKh = await whId("K-BH-KH");

  return prisma.$transaction(async (tx) => {
    const number = await seq(tx, "BH", "warrantyIntake");
    const intake = await tx.warrantyIntake.create({
      data: {
        number,
        serialId: serial.id,
        customerId: input.customerId ?? null,
        originalInvoiceNo: input.originalInvoiceNo ?? serial.invoiceNumber ?? null,
        sealIntact: input.sealIntact ?? null,
        conditionNote: input.conditionNote ?? null,
        photos: input.photos ?? null,
        status: "OPEN",
      },
    });
    const from = serial.warehouseId;
    await tx.serial.update({
      where: { id: serial.id },
      data: { status: "IN_WARRANTY_INTAKE", warehouseId: bhKh },
    });
    await tx.stockMovement.create({
      data: {
        type: "TRANSFER",
        serialId: serial.id,
        fromWarehouseId: from,
        toWarehouseId: bhKh,
        documentType: "WARRANTY_INTAKE",
        documentNumber: number,
        note: "Tiếp nhận bảo hành từ khách",
        createdBy: userId,
      },
    });
    await tx.serialEvent.create({
      data: {
        serialId: serial.id,
        eventType: "WARRANTY_INTAKE",
        toStatus: "IN_WARRANTY_INTAKE",
        detail: { intake: number },
        createdBy: userId,
      },
    });
    await tx.auditLog.create({ data: { userId, action: "CREATE", entityType: "WarrantyIntake", entityId: intake.id } });
    return intake;
  });
}

/** Phân luồng phiếu tiếp nhận. */
export async function routeWarrantyIntake(intakeId: string, input: RouteInput, userId: string) {
  const intake = await prisma.warrantyIntake.findUnique({ where: { id: intakeId } });
  if (!intake) throw new HttpError(404, "Không tìm thấy phiếu tiếp nhận");
  if (intake.status !== "OPEN") throw new HttpError(409, "Phiếu đã được phân luồng");
  if (!intake.serialId) throw new HttpError(422, "Phiếu chưa gắn serial");

  return prisma.$transaction(async (tx) => {
    const serial = await tx.serial.findUniqueOrThrow({ where: { id: intake.serialId! } });
    let created: any = null;

    if (input.route === "TO_VENDOR") {
      const to = await whId("K-BH-NCC");
      await tx.serial.update({ where: { id: serial.id }, data: { status: "AT_VENDOR", warehouseId: to } });
      const number = await seq(tx, "RMA", "vendorRma");
      created = await tx.vendorRma.create({
        data: {
          number,
          serialId: serial.id,
          vendorId: input.vendorId ?? null,
          sentDate: new Date(),
          carrier: input.carrier ?? null,
          trackingNumber: input.trackingNumber ?? null,
          slaDays: input.slaDays ?? SLA_DAYS.VENDOR_RMA,
          status: "SENT",
        },
      });
      await tx.stockMovement.create({
        data: { type: "TRANSFER", serialId: serial.id, fromWarehouseId: serial.warehouseId, toWarehouseId: to, documentType: "VENDOR_RMA", documentNumber: number, note: "Gửi bảo hành hãng (X4)", createdBy: userId },
      });
      await tx.serialEvent.create({ data: { serialId: serial.id, eventType: "SEND_VENDOR", toStatus: "AT_VENDOR", detail: { rma: number }, createdBy: userId } });
    } else if (input.route === "TO_REPAIR") {
      const to = await whId("K-SC");
      await tx.serial.update({ where: { id: serial.id }, data: { status: "IN_REPAIR", warehouseId: to } });
      await tx.stockMovement.create({
        data: { type: "TRANSFER", serialId: serial.id, fromWarehouseId: serial.warehouseId, toWarehouseId: to, documentType: "WARRANTY_INTAKE", documentNumber: intake.number, note: "Chuyển sửa chữa có phí (K-SC)", createdBy: userId },
      });
      await tx.serialEvent.create({ data: { serialId: serial.id, eventType: "TO_REPAIR", toStatus: "IN_REPAIR", createdBy: userId } });
    } else {
      // TO_DAMAGED
      const to = await whId("K-HH");
      await tx.serial.update({ where: { id: serial.id }, data: { status: "DAMAGED", warehouseId: to } });
      created = await tx.damagedItem.create({
        data: { serialId: serial.id, cause: input.cause ?? null, dueDate: addDays(new Date(), SLA_DAYS.DAMAGED), resolution: "PENDING" },
      });
      await tx.stockMovement.create({
        data: { type: "TRANSFER", serialId: serial.id, fromWarehouseId: serial.warehouseId, toWarehouseId: to, documentType: "DAMAGED", documentNumber: intake.number, note: "Chuyển kho hư hỏng (K-HH)", createdBy: userId },
      });
      await tx.serialEvent.create({ data: { serialId: serial.id, eventType: "TO_DAMAGED", toStatus: "DAMAGED", createdBy: userId } });
    }

    await tx.warrantyIntake.update({ where: { id: intake.id }, data: { route: input.route, status: "ROUTED" } });
    await tx.auditLog.create({ data: { userId, action: "ROUTE", entityType: "WarrantyIntake", entityId: intake.id, changes: { route: input.route } } });
    return created;
  });
}

/** Bump as-built BOM sang version mới, thay serial con cũ bằng con mới. */
async function bumpAsBuiltVersion(tx: Prisma.TransactionClient, parentSerialId: string, oldChildId: string, newChildId: string, userId: string) {
  const rows = await tx.bomAsBuilt.findMany({ where: { parentSerialId } });
  if (rows.length === 0) return;
  const maxVersion = Math.max(...rows.map((r) => r.version));
  const currentRows = rows.filter((r) => r.version === maxVersion);
  const newVersion = maxVersion + 1;
  for (const r of currentRows) {
    await tx.bomAsBuilt.create({
      data: {
        workOrderId: r.workOrderId,
        parentSerialId,
        version: newVersion,
        childSerialId: r.childSerialId === oldChildId ? newChildId : r.childSerialId,
        childLotId: r.childLotId,
        childLicenseId: r.childLicenseId,
        quantity: r.quantity,
        note: r.childSerialId === oldChildId ? `Thay thế BH (v${newVersion})` : r.note,
      },
    });
  }
}

/** Hãng trả về: sửa xong (REPAIRED) hoặc thay mới (REPLACED = N4). */
export async function returnFromVendor(rmaId: string, input: ReturnInput, userId: string) {
  const rma = await prisma.vendorRma.findUnique({ where: { id: rmaId } });
  if (!rma) throw new HttpError(404, "Không tìm thấy phiếu RMA");
  if (rma.status === "RETURNED") throw new HttpError(409, "Phiếu RMA đã xử lý");
  if (!rma.serialId) throw new HttpError(422, "RMA chưa gắn serial");

  const bhKh = await whId("K-BH-KH");

  return prisma.$transaction(async (tx) => {
    const oldSerial = await tx.serial.findUniqueOrThrow({
      where: { id: rma.serialId! },
      include: { warranties: true },
    });

    let replacement: any = null;
    let vendorClaim: any = null;

    if (input.result === "REPAIRED") {
      // Sửa xong -> trả về K-BH-KH chờ giao khách (SOLD)
      await tx.serial.update({ where: { id: oldSerial.id }, data: { status: "SOLD", warehouseId: bhKh } });
      await tx.serialEvent.create({ data: { serialId: oldSerial.id, eventType: "VENDOR_RETURN", toStatus: "SOLD", detail: { rma: rma.number, result: "REPAIRED" }, createdBy: userId } });
    } else {
      // REPLACED (N4): serial cũ -> REPLACED, tạo serial mới liên kết replaced_by
      const newSerial = await tx.serial.create({
        data: {
          serialNumber: input.replacementSerialNumber!,
          productId: oldSerial.productId,
          warehouseId: bhKh,
          status: "SOLD",
          condition: "Hãng thay thế BH",
          supplierId: oldSerial.supplierId,
          projectId: oldSerial.projectId,
          isCommercialStock: oldSerial.isCommercialStock,
          parentSerialId: oldSerial.parentSerialId,
          originCountry: oldSerial.originCountry,
        },
      });
      await tx.serial.update({
        where: { id: oldSerial.id },
        data: { status: "REPLACED", replacedBySerialId: newSerial.id },
      });
      // Đồng bộ bảo hành cho serial mới
      if (input.warranty?.startDate || input.warranty?.endDate) {
        await tx.warranty.create({
          data: { serialId: newSerial.id, provider: "VENDOR", startDate: toDate(input.warranty.startDate), endDate: toDate(input.warranty.endDate), terms: input.warranty.terms ?? "BH hãng (hàng thay thế)" },
        });
      }
      // Nếu là linh kiện trong máy -> cập nhật as-built BOM version mới
      if (oldSerial.parentSerialId) {
        await bumpAsBuiltVersion(tx, oldSerial.parentSerialId, oldSerial.id, newSerial.id, userId);
      }
      // Đòi bảo hành ngược NCC nếu linh kiện cũ còn hạn hãng
      const now = new Date();
      const vendorWarrantyActive = oldSerial.warranties.some((w) => w.provider === "VENDOR" && w.endDate && w.endDate > now);
      if (vendorWarrantyActive) {
        const number = await seq(tx, "CLAIM", "rmaTicket");
        vendorClaim = await tx.rmaTicket.create({
          data: { number, serialId: oldSerial.id, isVendorClaim: true, vendorId: rma.vendorId, status: "OPEN" },
        });
      }
      await tx.serialEvent.create({ data: { serialId: oldSerial.id, eventType: "REPLACED", toStatus: "REPLACED", detail: { rma: rma.number, replacedBy: newSerial.serialNumber }, createdBy: userId } });
      await tx.serialEvent.create({ data: { serialId: newSerial.id, eventType: "VENDOR_REPLACEMENT", toStatus: "SOLD", detail: { replaces: oldSerial.serialNumber }, createdBy: userId } });
      replacement = newSerial;
    }

    const updated = await tx.vendorRma.update({
      where: { id: rma.id },
      data: { status: "RETURNED", result: input.result, returnedAt: new Date(), replacementSerialId: replacement?.id ?? null },
    });
    await tx.auditLog.create({ data: { userId, action: "VENDOR_RETURN", entityType: "VendorRma", entityId: rma.id, changes: { result: input.result, claim: !!vendorClaim } } });
    return { rma: updated, replacement, vendorClaim };
  });
}

/** Chốt hướng xử lý thiết bị hư hỏng (K-HH). */
export async function resolveDamaged(damagedId: string, input: ResolveInput, userId: string) {
  const item = await prisma.damagedItem.findUnique({ where: { id: damagedId } });
  if (!item) throw new HttpError(404, "Không tìm thấy mục hư hỏng");
  if (item.resolution !== "PENDING") throw new HttpError(409, "Đã chốt hướng xử lý");

  return prisma.$transaction(async (tx) => {
    // Thanh lý -> serial SCRAPPED + chuyển K-TL
    if (input.resolution === "LIQUIDATE" && item.serialId) {
      const tl = await whId("K-TL");
      await tx.serial.update({ where: { id: item.serialId }, data: { status: "SCRAPPED", warehouseId: tl } });
      await tx.stockMovement.create({ data: { type: "TRANSFER", serialId: item.serialId, toWarehouseId: tl, documentType: "DAMAGED", note: "Thanh lý", createdBy: userId } });
      await tx.serialEvent.create({ data: { serialId: item.serialId, eventType: "LIQUIDATE", toStatus: "SCRAPPED", createdBy: userId } });
    }
    const updated = await tx.damagedItem.update({
      where: { id: item.id },
      data: { resolution: input.resolution as any, resolvedAt: new Date() },
    });
    await tx.auditLog.create({ data: { userId, action: "RESOLVE", entityType: "DamagedItem", entityId: item.id, changes: { resolution: input.resolution } } });
    return updated;
  });
}
