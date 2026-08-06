// =============================================================================
// Dịch vụ LẮP RÁP (M4) — vòng đời Work Order:
//   tạo -> cấp phát linh kiện (WIP) -> QC/burn-in -> hoàn thành (sinh thành
//   phẩm + as-built BOM có version + BH + gán license) -> nhập kho.
// Mọi bước biến động tồn đều ghi stock_movement + serial_event.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import type { z } from "zod";
import type {
  workOrderCreateSchema,
  workOrderAllocateSchema,
  workOrderQcSchema,
  workOrderCompleteSchema,
} from "./validation";

type CreateInput = z.infer<typeof workOrderCreateSchema>;
type AllocateInput = z.infer<typeof workOrderAllocateSchema>;
type QcInput = z.infer<typeof workOrderQcSchema>;
type CompleteInput = z.infer<typeof workOrderCompleteSchema>;

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

async function warehouseByCode(code: string) {
  const wh = await prisma.warehouse.findUnique({ where: { code } });
  if (!wh) throw new HttpError(422, `Không tìm thấy kho ${code}`);
  return wh;
}

async function nextWorkOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;
  const count = await tx.workOrder.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Tạo lệnh lắp ráp (DRAFT) + BOM kế hoạch. */
export async function createWorkOrder(input: CreateInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const number = await nextWorkOrderNumber(tx);
    const wo = await tx.workOrder.create({
      data: {
        number,
        mode: input.mode,
        status: "DRAFT",
        productId: input.productId ?? null,
        assembledBy: input.assembledBy ?? null,
        note: input.note ?? null,
        bomPlanned: {
          create: input.bomPlanned.map((b) => ({ productId: b.productId, quantity: b.quantity })),
        },
      },
      include: { bomPlanned: true },
    });
    await tx.auditLog.create({
      data: { userId, action: "CREATE", entityType: "WorkOrder", entityId: wo.id },
    });
    return wo;
  });
}

/**
 * Cấp phát linh kiện: quét serial/lô -> chuyển sang WIP (K-TAM).
 * Serial: status -> WIP; Lot: giảm số lượng ở kho nguồn, ghi tồn WIP.
 */
export async function allocateWorkOrder(woId: string, input: AllocateInput, userId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: woId } });
  if (!wo) throw new HttpError(404, "Không tìm thấy lệnh lắp ráp");
  if (wo.status === "DONE" || wo.status === "CANCELLED") {
    throw new HttpError(409, "Lệnh đã kết thúc, không thể cấp phát");
  }
  const wip = await warehouseByCode("K-TAM");

  return prisma.$transaction(async (tx) => {
    const allocatedSerials: string[] = [];

    for (const sn of input.serialNumbers) {
      const serial = await tx.serial.findUnique({ where: { serialNumber: sn } });
      if (!serial) throw new HttpError(422, `Serial ${sn} không tồn tại`);
      if (serial.status !== "IN_STOCK") {
        throw new HttpError(409, `Serial ${sn} không ở trạng thái trong kho (đang ${serial.status})`);
      }
      const fromWh = serial.warehouseId;
      await tx.serial.update({
        where: { id: serial.id },
        data: { status: "WIP", warehouseId: wip.id },
      });
      await tx.stockMovement.create({
        data: {
          type: "ASSEMBLY_CONSUME",
          serialId: serial.id,
          fromWarehouseId: fromWh,
          toWarehouseId: wip.id,
          documentType: "WORK_ORDER",
          documentNumber: wo.number,
          note: "Cấp phát linh kiện vào WIP",
          createdBy: userId,
        },
      });
      await tx.serialEvent.create({
        data: {
          serialId: serial.id,
          eventType: "ALLOCATE",
          fromStatus: "IN_STOCK",
          toStatus: "WIP",
          detail: { workOrder: wo.number },
          createdBy: userId,
        },
      });
      allocatedSerials.push(sn);
    }

    for (const l of input.lots) {
      const lot = await tx.lot.findUnique({ where: { id: l.lotId } });
      if (!lot) throw new HttpError(422, "Lô không tồn tại");
      if (lot.quantity < l.quantity) {
        throw new HttpError(409, `Lô ${lot.lotNumber} không đủ số lượng (còn ${lot.quantity})`);
      }
      await tx.lot.update({ where: { id: lot.id }, data: { quantity: { decrement: l.quantity } } });
      await tx.stockMovement.create({
        data: {
          type: "ASSEMBLY_CONSUME",
          lotId: lot.id,
          quantity: l.quantity,
          fromWarehouseId: lot.warehouseId,
          toWarehouseId: wip.id,
          documentType: "WORK_ORDER",
          documentNumber: wo.number,
          note: "Cấp phát lô vào WIP",
          createdBy: userId,
        },
      });
    }

    const updated = await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: "ASSEMBLING", startedAt: wo.startedAt ?? new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "ALLOCATE",
        entityType: "WorkOrder",
        entityId: wo.id,
        changes: { serials: allocatedSerials.length, lots: input.lots.length },
      },
    });
    return { workOrder: updated, allocatedSerials };
  });
}

/** Ghi nhận kết quả QC/burn-in đầu ra. FAIL -> đưa lệnh về ASSEMBLING để sửa. */
export async function qcWorkOrder(woId: string, input: QcInput, userId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: woId } });
  if (!wo) throw new HttpError(404, "Không tìm thấy lệnh lắp ráp");
  if (wo.status === "DONE" || wo.status === "CANCELLED") {
    throw new HttpError(409, "Lệnh đã kết thúc");
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.qcReport.create({
      data: {
        workOrderId: wo.id,
        type: "OUTPUT",
        result: input.result,
        burnInHours: input.burnInHours ?? null,
        details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
        photos: input.photos ?? null,
        createdBy: userId,
      },
    });
    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: input.result === "PASS" ? "QC" : "ASSEMBLING" },
    });
    return report;
  });
}

/**
 * Hoàn thành lắp ráp: sinh serial thành phẩm, lưu as-built BOM (version), gắn
 * bảo hành THNG, gán license, đưa linh kiện con vào máy; linh kiện đã cấp phát
 * nhưng KHÔNG dùng sẽ được trả về kho linh kiện (K-LK). Nhập kho thành phẩm.
 */
export async function completeWorkOrder(woId: string, input: CompleteInput, userId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id: woId } });
  if (!wo) throw new HttpError(404, "Không tìm thấy lệnh lắp ráp");
  if (wo.status === "DONE") throw new HttpError(409, "Lệnh đã hoàn thành");
  if (!wo.productId) throw new HttpError(422, "Lệnh chưa gán sản phẩm thành phẩm");

  const destWh = await warehouseByCode(input.destinationWarehouseCode);
  const lkWh = await warehouseByCode("K-LK");

  // Version as-built kế tiếp cho serial cha (mặc định 1, +1 nếu đã có)
  return prisma.$transaction(async (tx) => {
    // 1) Serial thành phẩm
    const finished = await tx.serial.create({
      data: {
        serialNumber: input.finishedSerialNumber,
        productId: wo.productId!,
        warehouseId: destWh.id,
        status: "IN_STOCK",
        condition: "Mới lắp ráp",
        projectId: input.projectId ?? null,
        isCommercialStock: input.isCommercialStock,
        binId: input.binId ?? null,
        yearOfManufacture: input.yearOfManufacture ?? new Date().getFullYear(),
        originCountry: "Việt Nam (lắp ráp)",
      },
    });

    // 2) Linh kiện serial con: gắn parent, chuyển theo máy, ra khỏi WIP
    const consumedSerialIds: string[] = [];
    for (const sn of input.consumedSerialNumbers) {
      const child = await tx.serial.findUnique({ where: { serialNumber: sn } });
      if (!child) throw new HttpError(422, `Serial linh kiện ${sn} không tồn tại`);
      if (child.status !== "WIP") {
        throw new HttpError(409, `Serial ${sn} chưa được cấp phát vào WIP`);
      }
      await tx.serial.update({
        where: { id: child.id },
        data: {
          parentSerialId: finished.id,
          warehouseId: destWh.id,
          status: "IN_STOCK", // nằm trong máy; loại khỏi tồn khả dụng nhờ parentSerialId
          binId: input.binId ?? null,
        },
      });
      await tx.bomAsBuilt.create({
        data: {
          workOrderId: wo.id,
          parentSerialId: finished.id,
          version: 1,
          childSerialId: child.id,
          quantity: 1,
        },
      });
      await tx.serialEvent.create({
        data: {
          serialId: child.id,
          eventType: "ASSEMBLE",
          fromStatus: "WIP",
          toStatus: "IN_STOCK",
          detail: { intoSerial: finished.serialNumber, workOrder: wo.number },
          createdBy: userId,
        },
      });
      consumedSerialIds.push(child.id);
    }

    // 3) Lô linh kiện con
    for (const cl of input.consumedLots) {
      await tx.bomAsBuilt.create({
        data: {
          workOrderId: wo.id,
          parentSerialId: finished.id,
          version: 1,
          childLotId: cl.lotId,
          quantity: cl.quantity,
        },
      });
    }

    // 4) License (cài phần mềm) gán vào máy
    for (const licId of input.licenseIds) {
      await tx.license.update({ where: { id: licId }, data: { activatedSerialId: finished.id } });
      await tx.bomAsBuilt.create({
        data: {
          workOrderId: wo.id,
          parentSerialId: finished.id,
          version: 1,
          childLicenseId: licId,
          quantity: 1,
        },
      });
    }

    // 5) Bảo hành THNG cho máy
    if (input.thngWarranty?.startDate || input.thngWarranty?.endDate) {
      await tx.warranty.create({
        data: {
          serialId: finished.id,
          provider: "THNG",
          startDate: toDate(input.thngWarranty.startDate),
          endDate: toDate(input.thngWarranty.endDate),
          terms: input.thngWarranty.terms ?? null,
        },
      });
    }

    // 6) Trả linh kiện thừa (đã cấp phát WIP nhưng không lắp) về K-LK
    const leftoverWip = await tx.serial.findMany({
      where: {
        status: "WIP",
        id: { notIn: consumedSerialIds.length ? consumedSerialIds : ["__none__"] },
        movements: { some: { documentNumber: wo.number, type: "ASSEMBLY_CONSUME" } },
      },
    });
    const returnedSerials: string[] = [];
    for (const s of leftoverWip) {
      await tx.serial.update({
        where: { id: s.id },
        data: { status: "IN_STOCK", warehouseId: lkWh.id },
      });
      await tx.stockMovement.create({
        data: {
          type: "TRANSFER",
          serialId: s.id,
          toWarehouseId: lkWh.id,
          documentType: "WORK_ORDER",
          documentNumber: wo.number,
          note: "Trả linh kiện thừa về kho linh kiện",
          createdBy: userId,
        },
      });
      returnedSerials.push(s.serialNumber);
    }

    // 7) Nhập kho thành phẩm + timeline
    await tx.stockMovement.create({
      data: {
        type: "ASSEMBLY_PRODUCE",
        serialId: finished.id,
        toWarehouseId: destWh.id,
        documentType: "WORK_ORDER",
        documentNumber: wo.number,
        note: "Nhập kho thành phẩm sau lắp ráp",
        createdBy: userId,
      },
    });
    await tx.serialEvent.create({
      data: {
        serialId: finished.id,
        eventType: "ASSEMBLE",
        toStatus: "IN_STOCK",
        detail: { workOrder: wo.number, children: consumedSerialIds.length },
        createdBy: userId,
      },
    });

    const updated = await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        assembledBy: input.assembledBy ?? wo.assembledBy,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "COMPLETE",
        entityType: "WorkOrder",
        entityId: wo.id,
        changes: { finished: finished.serialNumber, children: consumedSerialIds.length, returned: returnedSerials.length },
      },
    });

    return { workOrder: updated, finishedSerialId: finished.id, finishedSerial: finished.serialNumber, returnedSerials };
  });
}
