// =============================================================================
// Seed dữ liệu mẫu THNG (mục 8):
//   * RBAC: roles + permissions + user cho từng vai trò
//   * Danh mục kho A1, khu vực/kệ
//   * NCC, khách hàng, dự án
//   * Sản phẩm đủ 4 tracking_mode
//   * MỘT máy lắp ráp hoàn chỉnh: serial cha + serial con + as-built BOM có
//     version, xuất xứ, bảo hành 2 tầng (THNG + hãng), license, timeline.
// Chạy: npm run db:seed
// =============================================================================
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { WAREHOUSE_CATALOG } from "../src/lib/warehouses";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  type RoleCode,
} from "../src/lib/rbac";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Bắt đầu seed...");

  // --- 1. Permissions ---
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // --- 2. Roles + gán quyền ---
  for (const roleCode of Object.values(ROLES) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: ROLE_LABELS[roleCode] },
      create: { code: roleCode, name: ROLE_LABELS[roleCode] },
    });
    // reset & gán lại quyền
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = ROLE_PERMISSIONS[roleCode];
    await prisma.rolePermission.createMany({
      data: perms.map((code) => ({ roleId: role.id, permissionId: permByCode.get(code)! })),
      skipDuplicates: true,
    });
  }
  const roles = await prisma.role.findMany();
  const roleByCode = new Map(roles.map((r) => [r.code, r.id]));

  // --- 3. Users (mật khẩu chung: <role>123) ---
  const users: Array<{ email: string; name: string; role: RoleCode; password: string }> = [
    { email: "admin@thng.com.vn", name: "Quản trị hệ thống", role: ROLES.ADMIN, password: "admin123" },
    { email: "bod@thng.com.vn", name: "Ban Giám đốc", role: ROLES.BOD, password: "bod123" },
    { email: "muahang@thng.com.vn", name: "Nguyễn Văn Mua", role: ROLES.PURCHASING, password: "muahang123" },
    { email: "ketoan@thng.com.vn", name: "Trần Thị Kế Toán", role: ROLES.WH_ACCOUNTANT, password: "ketoan123" },
    { email: "thukho@thng.com.vn", name: "Lê Văn Thủ Kho", role: ROLES.WAREHOUSE_KEEPER, password: "thukho123" },
    { email: "kythuat@thng.com.vn", name: "Phạm Kỹ Thuật", role: ROLES.TECH, password: "kythuat123" },
    { email: "qc@thng.com.vn", name: "Hoàng QC", role: ROLES.QC, password: "qc123" },
    { email: "kinhdoanh@thng.com.vn", name: "Đỗ Kinh Doanh", role: ROLES.SALES, password: "kinhdoanh123" },
    { email: "baohanh@thng.com.vn", name: "Vũ Bảo Hành", role: ROLES.WARRANTY, password: "baohanh123" },
    // --- Module Spa / Thẩm mỹ ---
    { email: "quanly@thng.com.vn", name: "Trần Quản Lý", role: ROLES.MANAGER, password: "quanly123" },
    { email: "letan@thng.com.vn", name: "Nguyễn Lễ Tân", role: ROLES.RECEPTION, password: "letan123" },
    { email: "cskh@thng.com.vn", name: "Lê Thị CSKH", role: ROLES.CUSTOMER_CARE, password: "cskh123" },
    { email: "chuyenvien@thng.com.vn", name: "Phạm Chuyên Viên", role: ROLES.SPECIALIST, password: "chuyenvien123" },
    { email: "thungan@thng.com.vn", name: "Đỗ Thu Ngân", role: ROLES.CASHIER, password: "thungan123" },
    { email: "marketing@thng.com.vn", name: "Vũ Marketing", role: ROLES.MARKETING, password: "marketing123" },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash: await hashPassword(u.password) },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleByCode.get(u.role)! } },
      update: {},
      create: { userId: user.id, roleId: roleByCode.get(u.role)! },
    });
  }

  // --- 4. Danh mục kho A1 ---
  for (const w of WAREHOUSE_CATALOG) {
    await prisma.warehouse.upsert({
      where: { code: w.code },
      update: { name: w.name, description: w.description, countsAsAvailable: w.countsAsAvailable },
      create: w,
    });
  }
  const whByCode = new Map((await prisma.warehouse.findMany()).map((w) => [w.code, w.id]));

  // --- 5. Zone + Bin cho kho linh kiện & kho thương mại ---
  async function ensureZone(whCode: string, code: string, name: string) {
    const warehouseId = whByCode.get(whCode)!;
    return prisma.zone.upsert({
      where: { warehouseId_code: { warehouseId, code } },
      update: { name },
      create: { warehouseId, code, name },
    });
  }
  async function ensureBin(zoneId: string, code: string, label?: string) {
    return prisma.bin.upsert({
      where: { zoneId_code: { zoneId, code } },
      update: {},
      create: { zoneId, code, label },
    });
  }
  const zoneLK = await ensureZone("K-LK", "A", "Khu A — Linh kiện");
  const binLK1 = await ensureBin(zoneLK.id, "A-01", "Kệ A hàng 01");
  await ensureBin(zoneLK.id, "A-02", "Kệ A hàng 02");
  const zoneTM = await ensureZone("K-TM", "B", "Khu B — Thành phẩm");
  const binTM1 = await ensureBin(zoneTM.id, "B-01", "Kệ B hàng 01");

  // --- 6. Đối tác (NCC + khách hàng) ---
  async function ensurePartner(data: {
    code: string;
    name: string;
    type: "SUPPLIER" | "CUSTOMER" | "BOTH";
    taxCode?: string;
    creditLimit?: number;
  }) {
    return prisma.partner.upsert({
      where: { code: data.code },
      update: { name: data.name },
      create: {
        code: data.code,
        name: data.name,
        type: data.type,
        taxCode: data.taxCode,
        creditLimit: data.creditLimit,
      },
    });
  }
  const ncc1 = await ensurePartner({ code: "NCC-INTEL", name: "Intel Việt Nam", type: "SUPPLIER", taxCode: "0300000001" });
  const ncc2 = await ensurePartner({ code: "NCC-KINGSTON", name: "Kingston Distributor", type: "SUPPLIER", taxCode: "0300000002" });
  const ncc3 = await ensurePartner({ code: "NCC-SAMSUNG", name: "Samsung SSD Supplier", type: "SUPPLIER", taxCode: "0300000003" });
  const ncc4 = await ensurePartner({ code: "NCC-MSFT", name: "Microsoft License Reseller", type: "SUPPLIER", taxCode: "0300000004" });
  const kh1 = await ensurePartner({ code: "KH-ACB", name: "Ngân hàng ACB", type: "CUSTOMER", creditLimit: 5_000_000_000 });
  const kh2 = await ensurePartner({ code: "KH-FPT", name: "FPT Software", type: "CUSTOMER", creditLimit: 2_000_000_000 });

  // --- 7. Dự án ---
  const prjACB = await prisma.project.upsert({
    where: { code: "DA-ACB-2026" },
    update: {},
    create: {
      code: "DA-ACB-2026",
      name: "Trang bị máy trạm ACB 2026",
      customerId: kh1.id,
      customerPo: "PO-ACB-0126",
      contractNo: "HD-ACB-2026/001",
      status: "ACTIVE",
    },
  });
  await prisma.project.upsert({
    where: { code: "DA-FPT-DC" },
    update: {},
    create: {
      code: "DA-FPT-DC",
      name: "Data Center FPT giai đoạn 1",
      customerId: kh2.id,
      customerPo: "PO-FPT-9001",
      status: "ACTIVE",
    },
  });

  // --- 8. Sản phẩm đủ 4 tracking_mode ---
  async function ensureProduct(data: {
    sku: string;
    name: string;
    brand?: string;
    model?: string;
    category?: string;
    trackingMode: "SERIAL" | "LOT" | "QUANTITY" | "LICENSE";
    uom?: string;
    minStock?: number;
  }) {
    return prisma.product.upsert({
      where: { sku: data.sku },
      update: { name: data.name },
      create: {
        sku: data.sku,
        name: data.name,
        brand: data.brand,
        model: data.model,
        category: data.category,
        trackingMode: data.trackingMode,
        uom: data.uom ?? "Cái",
        minStock: data.minStock,
      },
    });
  }
  // Thành phẩm (máy lắp ráp)
  const pWorkstation = await ensureProduct({
    sku: "TP-WS-PRO",
    name: "Máy trạm THNG Workstation Pro",
    brand: "THNG",
    model: "WS-PRO-2026",
    category: "Máy trạm",
    trackingMode: "SERIAL",
  });
  // Linh kiện SERIAL
  const pCpu = await ensureProduct({ sku: "LK-CPU-I9", name: "CPU Intel Core i9-14900K", brand: "Intel", model: "i9-14900K", category: "CPU", trackingMode: "SERIAL", minStock: 5 });
  const pSsd = await ensureProduct({ sku: "LK-SSD-2TB", name: "SSD Samsung 990 Pro 2TB", brand: "Samsung", model: "990PRO-2TB", category: "SSD", trackingMode: "SERIAL", minStock: 10 });
  // Linh kiện LOT
  const pRam = await ensureProduct({ sku: "LK-RAM-32G", name: "RAM Kingston Fury 32GB DDR5", brand: "Kingston", model: "KF556-32", category: "RAM", trackingMode: "LOT", minStock: 20 });
  // Phụ kiện QUANTITY
  await ensureProduct({ sku: "PK-CABLE-C13", name: "Cáp nguồn C13 1.8m", category: "Phụ kiện", trackingMode: "QUANTITY", uom: "Sợi", minStock: 50 });
  // LICENSE
  const pWin = await ensureProduct({ sku: "SW-WIN11-PRO", name: "Windows 11 Pro OEM", brand: "Microsoft", trackingMode: "LICENSE", uom: "Key" });

  // --- 9. MÁY LẮP RÁP HOÀN CHỈNH -------------------------------------------
  // Xóa dữ liệu demo cũ (idempotent) trước khi dựng lại quan hệ cha-con.
  const demoSerialNumbers = ["WS-PRO-2026-0001", "SN-CPU-DEMO-001", "SN-SSD-DEMO-001"];
  const existingParent = await prisma.serial.findUnique({ where: { serialNumber: "WS-PRO-2026-0001" } });
  if (existingParent) {
    await prisma.bomAsBuilt.deleteMany({ where: { parentSerialId: existingParent.id } });
    await prisma.serialEvent.deleteMany({ where: { serial: { serialNumber: { in: demoSerialNumbers } } } });
    await prisma.origin.deleteMany({ where: { serial: { serialNumber: { in: demoSerialNumbers } } } });
    await prisma.warranty.deleteMany({ where: { serial: { serialNumber: { in: demoSerialNumbers } } } });
    await prisma.license.updateMany({ where: { licenseKey: "WIN11-DEMO-XXXX-YYYY-ZZZZ" }, data: { activatedSerialId: null } });
    // gỡ liên kết cha để xóa con an toàn
    await prisma.serial.updateMany({ where: { parentSerial: { serialNumber: "WS-PRO-2026-0001" } }, data: { parentSerialId: null } });
    await prisma.serial.deleteMany({ where: { serialNumber: { in: demoSerialNumbers } } });
  }

  const lkWh = whByCode.get("K-LK")!;
  const tmWh = whByCode.get("K-TM")!;

  // Serial thành phẩm (cha) — trạng thái IN_STOCK, nằm K-TM
  const parent = await prisma.serial.create({
    data: {
      serialNumber: "WS-PRO-2026-0001",
      productId: pWorkstation.id,
      warehouseId: tmWh,
      status: "IN_STOCK",
      condition: "Mới 100%",
      isCommercialStock: false,
      projectId: prjACB.id,
      yearOfManufacture: 2026,
      originCountry: "Việt Nam (lắp ráp)",
      binId: binTM1.id,
    },
  });

  // Serial con: CPU (SERIAL)
  const cpuSerial = await prisma.serial.create({
    data: {
      serialNumber: "SN-CPU-DEMO-001",
      productId: pCpu.id,
      warehouseId: tmWh, // đã theo máy cha
      status: "DISASSEMBLED", // con nằm trong máy — không tính tồn rời
      condition: "Đã lắp vào máy",
      supplierId: ncc1.id,
      poNumber: "PO-INTEL-2026-01",
      invoiceNumber: "HD-INTEL-0001",
      yearOfManufacture: 2025,
      originCountry: "Malaysia",
      parentSerialId: parent.id,
    },
  });

  // Serial con: SSD (SERIAL)
  const ssdSerial = await prisma.serial.create({
    data: {
      serialNumber: "SN-SSD-DEMO-001",
      productId: pSsd.id,
      warehouseId: tmWh,
      status: "DISASSEMBLED",
      condition: "Đã lắp vào máy",
      supplierId: ncc3.id,
      poNumber: "PO-SAMSUNG-2026-01",
      invoiceNumber: "HD-SAMSUNG-0007",
      yearOfManufacture: 2025,
      originCountry: "Korea",
      parentSerialId: parent.id,
    },
  });

  // Lô RAM (LOT) — con dạng lot
  const ramLot = await prisma.lot.upsert({
    where: { productId_lotNumber_warehouseId: { productId: pRam.id, lotNumber: "LOT-RAM-2026-A", warehouseId: lkWh } },
    update: {},
    create: {
      productId: pRam.id,
      lotNumber: "LOT-RAM-2026-A",
      warehouseId: lkWh,
      quantity: 40,
      supplierId: ncc2.id,
      manufactureDate: new Date("2025-11-01"),
    },
  });

  // License Windows (con dạng license) — kích hoạt vào máy cha
  const winLicense = await prisma.license.upsert({
    where: { licenseKey: "WIN11-DEMO-XXXX-YYYY-ZZZZ" },
    update: { activatedSerialId: parent.id },
    create: {
      productId: pWin.id,
      licenseKey: "WIN11-DEMO-XXXX-YYYY-ZZZZ",
      expiryDate: null,
      activatedSerialId: parent.id,
    },
  });

  // Work Order (đã hoàn thành)
  const wo = await prisma.workOrder.upsert({
    where: { number: "WO-2026-0001" },
    update: {},
    create: {
      number: "WO-2026-0001",
      mode: "TO_ORDER",
      status: "DONE",
      productId: pWorkstation.id,
      assembledBy: "Phạm Kỹ Thuật",
      startedAt: new Date("2026-01-10T08:00:00Z"),
      finishedAt: new Date("2026-01-10T15:00:00Z"),
      note: "Lắp theo đơn dự án ACB, có cài Windows 11 Pro",
    },
  });

  // As-built BOM version 1 — liên kết cha ↔ từng con (serial/lot/license)
  await prisma.bomAsBuilt.createMany({
    data: [
      { workOrderId: wo.id, parentSerialId: parent.id, version: 1, childSerialId: cpuSerial.id, quantity: 1, note: "CPU i9" },
      { workOrderId: wo.id, parentSerialId: parent.id, version: 1, childSerialId: ssdSerial.id, quantity: 1, note: "SSD 2TB" },
      { workOrderId: wo.id, parentSerialId: parent.id, version: 1, childLotId: ramLot.id, quantity: 2, note: "2 thanh RAM 32GB từ lô" },
      { workOrderId: wo.id, parentSerialId: parent.id, version: 1, childLicenseId: winLicense.id, quantity: 1, note: "Windows 11 Pro" },
    ],
  });

  // Xuất xứ (CO/CQ/tờ khai) cho từng linh kiện
  await prisma.origin.createMany({
    data: [
      { serialId: cpuSerial.id, countryOfOrigin: "Malaysia", supplierId: ncc1.id, poNumber: "PO-INTEL-2026-01", coNumber: "CO-INTEL-001", cqNumber: "CQ-INTEL-001", customsDeclarationNo: "TK-105-2026" },
      { serialId: ssdSerial.id, countryOfOrigin: "Korea", supplierId: ncc3.id, poNumber: "PO-SAMSUNG-2026-01", coNumber: "CO-SS-007", cqNumber: "CQ-SS-007", customsDeclarationNo: "TK-221-2026" },
      { lotId: ramLot.id, countryOfOrigin: "Taiwan", supplierId: ncc2.id, poNumber: "PO-KINGSTON-2026-01", coNumber: "CO-KS-090", customsDeclarationNo: "TK-330-2026" },
    ],
  });

  // Bảo hành 2 tầng: hãng cho từng linh kiện + THNG cho máy
  await prisma.warranty.createMany({
    data: [
      // BH hãng cho linh kiện
      { serialId: cpuSerial.id, provider: "VENDOR", startDate: new Date("2026-01-10"), endDate: new Date("2029-01-10"), terms: "BH hãng Intel 36 tháng" },
      { serialId: ssdSerial.id, provider: "VENDOR", startDate: new Date("2026-01-10"), endDate: new Date("2031-01-10"), terms: "BH hãng Samsung 60 tháng" },
      // BH THNG cấp khách cho toàn máy
      { serialId: parent.id, provider: "THNG", startDate: new Date("2026-01-15"), endDate: new Date("2028-01-15"), terms: "BH THNG 24 tháng cho khách ACB" },
    ],
  });

  // Timeline serial cha
  await prisma.serialEvent.createMany({
    data: [
      { serialId: parent.id, eventType: "ASSEMBLE", toStatus: "IN_STOCK", detail: { workOrder: "WO-2026-0001" }, createdBy: "Phạm Kỹ Thuật" },
      { serialId: parent.id, eventType: "QC_PASS", detail: { burnInHours: 12 }, createdBy: "Hoàng QC" },
    ],
  });

  // QC/burn-in đầu ra
  await prisma.qcReport.create({
    data: {
      workOrderId: wo.id,
      serialId: parent.id,
      type: "OUTPUT",
      result: "PASS",
      burnInHours: 12,
      details: { cpuTemp: "72C", memtest: "PASS", disk: "PASS" },
      createdBy: "Hoàng QC",
    },
  });

  // Biến động tồn: nhập thành phẩm sau lắp ráp
  await prisma.stockMovement.create({
    data: {
      type: "ASSEMBLY_PRODUCE",
      serialId: parent.id,
      toWarehouseId: tmWh,
      documentType: "WORK_ORDER",
      documentNumber: "WO-2026-0001",
      note: "Nhập kho thành phẩm sau lắp ráp",
      createdBy: "Lê Văn Thủ Kho",
    },
  });

  // --- 10. MODULE SPA — dịch vụ + khách hàng + hành trình mẫu -----------------
  // Nhóm & dịch vụ
  const catFacial = await prisma.serviceCategory.upsert({
    where: { code: "NHOM-FACIAL" },
    update: { name: "Chăm sóc da mặt" },
    create: { code: "NHOM-FACIAL", name: "Chăm sóc da mặt" },
  });
  const catLaser = await prisma.serviceCategory.upsert({
    where: { code: "NHOM-LASER" },
    update: { name: "Công nghệ cao / Laser" },
    create: { code: "NHOM-LASER", name: "Công nghệ cao / Laser" },
  });

  async function ensureService(data: {
    code: string;
    name: string;
    categoryId?: string;
    durationMinutes?: number;
    standardPrice: number;
    expectedCost?: number;
  }) {
    return prisma.service.upsert({
      where: { code: data.code },
      update: { name: data.name, standardPrice: data.standardPrice },
      create: data,
    });
  }
  const svcDeepClean = await ensureService({ code: "DV-FACIAL-01", name: "Facial làm sạch sâu", categoryId: catFacial.id, durationMinutes: 60, standardPrice: 800_000, expectedCost: 250_000 });
  await ensureService({ code: "DV-FACIAL-02", name: "Điện di dưỡng ẩm", categoryId: catFacial.id, durationMinutes: 45, standardPrice: 600_000, expectedCost: 180_000 });
  const svcLaser = await ensureService({ code: "DV-LASER-01", name: "Laser trị nám Pico", categoryId: catLaser.id, durationMinutes: 40, standardPrice: 2_500_000, expectedCost: 700_000 });

  // Khách hàng mẫu + hành trình đầy đủ (mục 23)
  const existingCust = await prisma.customer.findUnique({ where: { code: "KH-000001" } });
  if (!existingCust) {
    const cust = await prisma.customer.create({
      data: {
        code: "KH-000001",
        fullName: "Nguyễn Thị An",
        gender: "FEMALE",
        phone: "0909000111",
        email: "an.nguyen@example.com",
        source: "Facebook Ads",
        campaign: "SUMMER-2026",
        group: "VIP",
        assignedTo: "Phạm Chuyên Viên",
        goals: "Cải thiện nám, làm sáng da",
        tags: ["nám", "da nhạy cảm"],
      },
    });

    // Đánh giá tình trạng
    await prisma.assessment.create({
      data: {
        customerId: cust.id,
        name: "Nám má hai bên",
        area: "Gò má",
        severity: "Vừa",
        description: "Nám mảng, chân nông–sâu hỗn hợp",
        assessedBy: "Phạm Chuyên Viên",
        indicators: { melanin: "cao", doDamHong: 3 },
      },
    });

    // Phác đồ + giai đoạn + buổi
    const plan = await prisma.treatmentPlan.create({
      data: {
        code: "TP-000001",
        customerId: cust.id,
        name: "Phác đồ trị nám 6 buổi",
        version: 1,
        status: "ACTIVE",
        diagnosis: "Nám má mức độ vừa",
        goals: "Giảm 70% nám sau 6 buổi, làm sáng đều màu",
        totalPrice: 15_000_000,
        createdBy: "Phạm Chuyên Viên",
        stages: {
          create: [
            { name: "Chuẩn bị", orderIndex: 0, description: "Làm sạch, dưỡng ẩm nền" },
            { name: "Can thiệp", orderIndex: 1, description: "Laser Pico định kỳ" },
            { name: "Duy trì", orderIndex: 2, description: "Chăm sóc tại nhà" },
          ],
        },
      },
      include: { stages: { orderBy: { orderIndex: "asc" } } },
    });
    const stagePrep = plan.stages[0];
    const stageInterv = plan.stages[1];

    // Buổi 1 — đã hoàn thành (có before/after + chi phí thực tế)
    const booking1 = await prisma.booking.create({
      data: {
        code: "BK-000001",
        customerId: cust.id,
        serviceId: svcDeepClean.id,
        scheduledAt: new Date("2026-07-20T09:00:00Z"),
        durationMinutes: 60,
        room: "Phòng 1",
        performer: "Phạm Chuyên Viên",
        status: "COMPLETED",
        price: 800_000,
        campaign: "SUMMER-2026",
      },
    });
    await prisma.treatmentSession.create({
      data: {
        planId: plan.id,
        stageId: stagePrep.id,
        customerId: cust.id,
        bookingId: booking1.id,
        serviceId: svcDeepClean.id,
        sessionNumber: 1,
        name: "Làm sạch & soi da nền",
        status: "COMPLETED",
        scheduledAt: new Date("2026-07-20T09:00:00Z"),
        performedAt: new Date("2026-07-20T09:10:00Z"),
        performer: "Phạm Chuyên Viên",
        objective: "Làm sạch sâu, chuẩn bị nền da",
        actualParams: { do_am: 42, do_dau: 30 },
        actualMaterials: { text: "1 mặt nạ dịu nhẹ, 1 serum HA" },
        conditionBefore: "Da xỉn màu, nám rõ",
        conditionAfter: "Da sạch, dịu",
        customerFeedback: "Hài lòng, da mềm hơn",
        plannedCost: 250_000,
        actualCost: 240_000,
        price: 800_000,
        checkedBy: "Trần Quản Lý",
      },
    });

    // Buổi 2 — Laser, dự kiến (PLANNED)
    await prisma.treatmentSession.create({
      data: {
        planId: plan.id,
        stageId: stageInterv.id,
        customerId: cust.id,
        serviceId: svcLaser.id,
        sessionNumber: 2,
        name: "Laser Pico lần 1",
        status: "PLANNED",
        scheduledAt: new Date("2026-08-15T09:00:00Z"),
        objective: "Bắn laser vùng gò má",
        plannedParams: { buoc_song: "1064nm", nang_luong: "0.8J" },
        plannedCost: 700_000,
        price: 2_500_000,
        preCare: "Không dùng AHA/BHA 3 ngày trước",
      },
    });

    // Booking sắp tới cho buổi 2
    await prisma.booking.create({
      data: {
        code: "BK-000002",
        customerId: cust.id,
        serviceId: svcLaser.id,
        scheduledAt: new Date("2026-08-15T09:00:00Z"),
        durationMinutes: 40,
        room: "Phòng Laser",
        performer: "Phạm Chuyên Viên",
        status: "CONFIRMED",
        price: 2_500_000,
      },
    });

    // Nhật ký CSKH
    await prisma.crmActivity.create({
      data: {
        customerId: cust.id,
        type: "CALL",
        content: "Gọi hỏi tình trạng sau buổi 1, khách phản hồi tốt.",
        result: "Tốt",
        performedBy: "Lê Thị CSKH",
        occurredAt: new Date("2026-07-23T03:30:00Z"),
        nextAction: "Nhắc lịch buổi Laser",
        followUpDate: new Date("2026-08-13T02:00:00Z"),
        followUpOwner: "Lê Thị CSKH",
      },
    });

    // Thanh toán (đặt cọc)
    await prisma.payment.create({
      data: {
        customerId: cust.id,
        planId: plan.id,
        amount: 5_000_000,
        method: "TRANSFER",
        receivedBy: "Đỗ Thu Ngân",
        note: "Đặt cọc phác đồ trị nám",
        paidAt: new Date("2026-07-20T10:00:00Z"),
      },
    });

    // Task follow-up
    await prisma.task.create({
      data: {
        title: "Nhắc khách lịch Laser buổi 2",
        customerId: cust.id,
        assignee: "Lê Thị CSKH",
        dueDate: new Date("2026-08-13T02:00:00Z"),
        priority: "HIGH",
        status: "OPEN",
        createdBy: "Lê Thị CSKH",
      },
    });
  }

  // --- 11. THƯ VIỆN SPA: Brand · Technology · Protocol · Product · Form -------
  const brandDMK = await prisma.brand.upsert({
    where: { code: "BR-DMK" },
    update: { name: "DMK" },
    create: { code: "BR-DMK", name: "DMK", description: "Danné Montague-King — enzyme therapy" },
  });
  await prisma.brand.upsert({
    where: { code: "BR-DERMA" },
    update: { name: "Dermalogica" },
    create: { code: "BR-DERMA", name: "Dermalogica", description: "Professional skin care" },
  });

  const techPico = await prisma.technology.upsert({
    where: { code: "CN-PICO" },
    update: { name: "Laser Pico" },
    create: {
      code: "CN-PICO",
      name: "Laser Pico",
      group: "Laser",
      deviceModel: "PicoSure",
      area: "Mặt",
      durationMinutes: 40,
      indications: "Nám, tàn nhang, đồi mồi",
      contraindications: "Da đang viêm, mang thai",
      parameters: { buoc_song: "755nm", che_do: "Focus" },
    },
  });

  const spDmkEnzyme = await prisma.spaProduct.upsert({
    where: { sku: "SP-DMK-ENZYME" },
    update: { name: "DMK Enzyme Masque" },
    create: { sku: "SP-DMK-ENZYME", name: "DMK Enzyme Masque", brandId: brandDMK.id, category: "Mặt nạ", productType: "PROFESSIONAL", sellingPrice: 0, cost: 350_000 },
  });
  const spSerum = await prisma.spaProduct.upsert({
    where: { sku: "SP-HA-SERUM" },
    update: { name: "Serum HA phục hồi" },
    create: { sku: "SP-HA-SERUM", name: "Serum HA phục hồi", brandId: brandDMK.id, category: "Serum", productType: "HOME_CARE", sellingPrice: 1_200_000, cost: 400_000, benefits: "Cấp ẩm, phục hồi hàng rào da" },
  });
  await prisma.spaProduct.upsert({
    where: { sku: "SP-SPF50" },
    update: { name: "Kem chống nắng SPF50" },
    create: { sku: "SP-SPF50", name: "Kem chống nắng SPF50", category: "Chống nắng", productType: "HOME_CARE", sellingPrice: 650_000, cost: 200_000 },
  });

  const protoDmk = await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-BRIGHT" },
    update: { name: "DMK Enzyme Brightening" },
    create: {
      code: "PROTO-DMK-BRIGHT",
      name: "DMK Enzyme Brightening",
      kind: "BRAND",
      brandId: brandDMK.id,
      status: "ACTIVE",
      purpose: "Làm sáng, đều màu da, hỗ trợ trị nám",
      suitableFor: "Da nám, xỉn màu",
      contraindications: "Da đang kích ứng nặng",
      steps: { items: [{ name: "Làm sạch", durationMinutes: 10 }, { name: "Enzyme masque", durationMinutes: 45 }, { name: "Dưỡng phục hồi", durationMinutes: 15 }] },
      durationMinutes: 70,
      recommendedFreq: "2 tuần/lần",
      recommendedCount: 6,
      createdBy: "Phạm Chuyên Viên",
    },
  });
  // Liên kết protocol ↔ công nghệ + sản phẩm (idempotent)
  await prisma.brandProtocolTechnology.upsert({
    where: { brandProtocolId_technologyId: { brandProtocolId: protoDmk.id, technologyId: techPico.id } },
    update: {},
    create: { brandProtocolId: protoDmk.id, technologyId: techPico.id },
  });
  await prisma.brandProtocolProduct.upsert({
    where: { brandProtocolId_spaProductId: { brandProtocolId: protoDmk.id, spaProductId: spDmkEnzyme.id } },
    update: {},
    create: { brandProtocolId: protoDmk.id, spaProductId: spDmkEnzyme.id, usage: "Đắp enzyme masque" },
  });

  // Biểu mẫu mẫu: đánh giá da có conditional logic (nếu Nặng -> hiện nhóm chuyên sâu)
  const fCond = "fld_cond_mucdo";
  const fDeep = "fld_deep_note";
  const formSchema = {
    sections: [
      {
        id: "sec_main",
        title: "Đánh giá da",
        groups: [
          {
            id: "grp_main",
            title: "",
            fields: [
              { id: "fld_vung", type: "BODY_AREA", label: "Vùng", options: [{ label: "Trán", value: "tran" }, { label: "Má", value: "ma" }, { label: "Cằm", value: "cam" }] },
              { id: fCond, type: "DROPDOWN", label: "Mức độ", required: true, options: [{ label: "Nhẹ", value: "nhe" }, { label: "Vừa", value: "vua" }, { label: "Nặng", value: "nang" }] },
              { id: "fld_melanin", type: "NUMBER", label: "Chỉ số melanin" },
            ],
          },
        ],
      },
      {
        id: "sec_deep",
        title: "Đánh giá chuyên sâu",
        groups: [
          { id: "grp_deep", title: "", fields: [{ id: fDeep, type: "LONG_TEXT", label: "Ghi chú chuyên sâu" }] },
        ],
      },
    ],
    logic: [
      { id: "rule1", match: "ALL", conditions: [{ fieldId: fCond, op: "eq", value: "nang" }], action: "show", targets: ["sec_deep", fDeep] },
    ],
  };
  await prisma.formTemplate.upsert({
    where: { code: "FORM-SKIN-ASSESS" },
    update: { schema: formSchema as any },
    create: {
      code: "FORM-SKIN-ASSESS",
      name: "Phiếu đánh giá da",
      category: "Đánh giá",
      status: "ACTIVE",
      schema: formSchema as any,
      createdBy: "Phạm Chuyên Viên",
    },
  });

  // Đề xuất sản phẩm cho khách demo (nếu có)
  const demoCust = await prisma.customer.findUnique({ where: { code: "KH-000001" } });
  if (demoCust) {
    const existingRec = await prisma.productRecommendation.findFirst({ where: { customerId: demoCust.id, spaProductId: spSerum.id } });
    if (!existingRec) {
      await prisma.productRecommendation.create({
        data: {
          customerId: demoCust.id,
          spaProductId: spSerum.id,
          priority: "ESSENTIAL",
          reason: "Phục hồi hàng rào da sau laser",
          goal: "Cấp ẩm, giảm kích ứng",
          quantity: 1,
          price: 1_200_000,
          createdBy: "Phạm Chuyên Viên",
        },
      });
    }
  }

  // --- 12. MODULE 5–10: proposal · care · pricing · marketing --------------
  const demo = await prisma.customer.findUnique({ where: { code: "KH-000001" } });

  // Care template (mục 6)
  await prisma.careInstruction.upsert({
    where: { code: "CARE-POST-LASER" },
    update: {},
    create: {
      code: "CARE-POST-LASER",
      title: "Dặn dò sau Laser",
      kind: "POST_CARE",
      category: "Laser",
      status: "ACTIVE",
      content: "Tránh nắng 7 ngày, dùng SPF50, không dùng AHA/BHA 3 ngày, cấp ẩm đầy đủ.",
      technologyId: techPico.id,
      createdBy: "Phạm Chuyên Viên",
    },
  });

  // Price rule (mục 9) — giá niêm yết cho dịch vụ Laser, có version
  const existedPrice = await prisma.priceRule.findFirst({ where: { targetId: svcLaser.id, priceType: "STANDARD" } });
  if (!existedPrice) {
    await prisma.priceRule.create({
      data: {
        targetType: "SERVICE",
        targetId: svcLaser.id,
        targetName: svcLaser.name,
        priceType: "STANDARD",
        price: 2_500_000,
        effectiveFrom: new Date("2026-01-01"),
        createdBy: "Trần Quản Lý",
      },
    });
  }

  // Marketing campaign + lead (mục 10)
  const camp = await prisma.marketingCampaign.upsert({
    where: { code: "CAMP-SUMMER-2026" },
    update: {},
    create: {
      code: "CAMP-SUMMER-2026",
      name: "Hè rực rỡ 2026",
      channel: "Facebook Ads",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-08-31"),
      budget: 50_000_000,
      cost: 30_000_000,
      owner: "Vũ Marketing",
    },
  });
  await prisma.lead.upsert({
    where: { code: "LEAD-000001" },
    update: {},
    create: { code: "LEAD-000001", name: "Trần Thị Lead", phone: "0912345678", source: "Facebook", campaignId: camp.id, status: "NEW" },
  });
  // Gán attribution cho khách demo
  if (demo && !demo.campaignId) {
    await prisma.customer.update({ where: { id: demo.id }, data: { campaignId: camp.id } });
  }

  // Proposal 2 phương án cho khách demo (mục 5)
  if (demo) {
    const existedProp = await prisma.treatmentProposal.findUnique({ where: { code: "PROP-000001" } });
    if (!existedProp) {
      await prisma.treatmentProposal.create({
        data: {
          code: "PROP-000001",
          customerId: demo.id,
          title: "Phương án trị nám 2026",
          status: "SENT",
          createdBy: "Phạm Chuyên Viên",
          options: {
            create: [
              {
                kind: "ESSENTIAL", name: "Thiết yếu", orderIndex: 0, sessions: 4, totalPrice: 9_000_000,
                items: { create: [
                  { itemType: "SERVICE", name: "Laser trị nám Pico", quantity: 4, unitPrice: 2_500_000, unitCost: 700_000, orderIndex: 0 },
                ] },
              },
              {
                kind: "PREMIUM", name: "Cao cấp", orderIndex: 1, sessions: 6, totalPrice: 16_200_000, discount: 800_000,
                items: { create: [
                  { itemType: "SERVICE", name: "Laser trị nám Pico", quantity: 6, unitPrice: 2_500_000, unitCost: 700_000, orderIndex: 0 },
                  { itemType: "PRODUCT", name: "Serum HA phục hồi", quantity: 1, unitPrice: 1_200_000, unitCost: 400_000, isHomeCare: true, orderIndex: 1 },
                  { itemType: "PRODUCT", name: "Kem chống nắng SPF50", quantity: 1, unitPrice: 650_000, unitCost: 200_000, isHomeCare: true, orderIndex: 2 },
                ] },
              },
            ],
          },
        },
      });
    }
  }

  console.log("✅ Seed hoàn tất.");
  console.log("   Đăng nhập kho: admin@thng.com.vn / admin123");
  console.log("   Đăng nhập spa: quanly@thng.com.vn / quanly123 (Quản lý)");
  console.log("   Máy lắp ráp mẫu: WS-PRO-2026-0001 (as-built BOM v1, BH 2 tầng)");
  console.log("   Khách spa mẫu: KH-000001 Nguyễn Thị An (phác đồ TP-000001)");
  console.log("   Thư viện: brand DMK, công nghệ Laser Pico, protocol DMK Enzyme Brightening,");
  console.log("             biểu mẫu FORM-SKIN-ASSESS (có conditional logic).");
  console.log("   Module 5-10: báo giá PROP-000001, hướng dẫn CARE-POST-LASER, bảng giá Laser,");
  console.log("                chiến dịch CAMP-SUMMER-2026 + LEAD-000001.");
}

main()
  .catch((e) => {
    console.error("❌ Seed lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
