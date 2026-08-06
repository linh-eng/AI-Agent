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
    refCostPrice?: number;
    inspectionExempt?: boolean;
  }) {
    // NT1 — P/N + Model bắt buộc: suy ra P/N từ model/sku nếu không khai riêng.
    const partNumber = data.model ?? data.sku;
    const productGroup = data.category ?? null;
    return prisma.product.upsert({
      where: { sku: data.sku },
      update: {
        name: data.name,
        partNumber,
        model: data.model ?? data.sku,
        productGroup,
        refCostPrice: data.refCostPrice ?? null,
        inspectionExempt: data.inspectionExempt ?? false,
      },
      create: {
        sku: data.sku,
        name: data.name,
        brand: data.brand,
        partNumber,
        model: data.model ?? data.sku,
        category: data.category,
        productGroup,
        trackingMode: data.trackingMode,
        uom: data.uom ?? "Cái",
        minStock: data.minStock,
        refCostPrice: data.refCostPrice ?? null,
        inspectionExempt: data.inspectionExempt ?? false,
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
    refCostPrice: 45000000,
  });
  // Linh kiện SERIAL
  const pCpu = await ensureProduct({ sku: "LK-CPU-I9", name: "CPU Intel Core i9-14900K", brand: "Intel", model: "i9-14900K", category: "CPU", trackingMode: "SERIAL", minStock: 5, refCostPrice: 15000000 });
  const pSsd = await ensureProduct({ sku: "LK-SSD-2TB", name: "SSD Samsung 990 Pro 2TB", brand: "Samsung", model: "990PRO-2TB", category: "SSD", trackingMode: "SERIAL", minStock: 10, refCostPrice: 5000000 });
  // Linh kiện LOT
  const pRam = await ensureProduct({ sku: "LK-RAM-32G", name: "RAM Kingston Fury 32GB DDR5", brand: "Kingston", model: "KF556-32", category: "RAM", trackingMode: "LOT", minStock: 20, refCostPrice: 3000000 });
  // Phụ kiện QUANTITY — nhóm hàng miễn kiểm (5A-2)
  await ensureProduct({ sku: "PK-CABLE-C13", name: "Cáp nguồn C13 1.8m", category: "Phụ kiện", trackingMode: "QUANTITY", uom: "Sợi", minStock: 50, refCostPrice: 50000, inspectionExempt: true });
  // LICENSE
  const pWin = await ensureProduct({ sku: "SW-WIN11-PRO", name: "Windows 11 Pro OEM", brand: "Microsoft", trackingMode: "LICENSE", uom: "Key", refCostPrice: 2500000 });

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

  console.log("✅ Seed hoàn tất.");
  console.log("   Đăng nhập demo: admin@thng.com.vn / admin123");
  console.log("   Máy lắp ráp mẫu: WS-PRO-2026-0001 (as-built BOM v1, BH 2 tầng)");
}

main()
  .catch((e) => {
    console.error("❌ Seed lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
