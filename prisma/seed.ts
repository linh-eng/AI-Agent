// =============================================================================
// Seed dữ liệu mẫu — Sophia Wellness (Quản lý kho).
//   * RBAC: permissions + roles + 1 user cho mỗi vai trò
//   * Kho, nhóm hàng, nhà cung cấp
//   * Sản phẩm 4 nhóm (mỹ phẩm, TPCN, vật tư tiêu hao, thiết bị)
//   * Tồn ban đầu theo lô + HSD (có lô sắp hết hạn / đã hết hạn để minh hoạ cảnh báo)
// Chạy: npm run db:seed
// =============================================================================
import { PrismaClient, TrackingMode } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type RoleCode,
} from "../src/lib/rbac";

const prisma = new PrismaClient();

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("→ Seed Sophia Wellness…");

  // ---- Permissions ----
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name: PERMISSION_LABELS[code] },
      create: { code, name: PERMISSION_LABELS[code] },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permByCode = new Map(permissions.map((p) => [p.code, p]));

  // ---- Roles + gán quyền ----
  for (const roleCode of Object.values(ROLES) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: ROLE_LABELS[roleCode] },
      create: { code: roleCode, name: ROLE_LABELS[roleCode] },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[roleCode].map((code) => ({
        roleId: role.id,
        permissionId: permByCode.get(code)!.id,
      })),
      skipDuplicates: true,
    });
  }
  const roles = await prisma.role.findMany();
  const roleByCode = new Map(roles.map((r) => [r.code, r]));

  // ---- Users: 1 cho mỗi vai trò ----
  const passwordHash = await hashPassword("admin123");
  const users: { email: string; name: string; role: RoleCode }[] = [
    { email: "admin@sophia.vn", name: "Quản trị hệ thống", role: "ADMIN" },
    { email: "quanly@sophia.vn", name: "Nguyễn Thị Quản Lý", role: "MANAGER" },
    { email: "thukho@sophia.vn", name: "Trần Văn Thủ Kho", role: "WAREHOUSE" },
    { email: "nhanvien@sophia.vn", name: "Lê Thị Nhân Viên", role: "STAFF" },
  ];
  for (const u of users) {
    const pwd = await hashPassword(`${u.role.toLowerCase()}123`);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: u.role === "ADMIN" ? passwordHash : pwd,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleByCode.get(u.role)!.id } },
      update: {},
      create: { userId: user.id, roleId: roleByCode.get(u.role)!.id },
    });
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@sophia.vn" } });

  // ---- Kho ----
  const khoTong = await prisma.warehouse.upsert({
    where: { code: "KHO-TONG" },
    update: {},
    create: { code: "KHO-TONG", name: "Kho tổng Sophia Wellness", address: "Trụ sở chính" },
  });
  await prisma.warehouse.upsert({
    where: { code: "KHO-SPA" },
    update: {},
    create: { code: "KHO-SPA", name: "Kho chi nhánh Spa", address: "Chi nhánh spa" },
  });

  // ---- Nhóm hàng ----
  const catData = [
    { code: "MP", name: "Mỹ phẩm & Skincare" },
    { code: "TPCN", name: "Thực phẩm chức năng" },
    { code: "VT", name: "Vật tư tiêu hao spa" },
    { code: "TD", name: "Hàng tiêu dùng (tinh dầu, nến…)" },
    { code: "TB", name: "Thiết bị & máy spa" },
  ];
  const cats: Record<string, string> = {};
  for (const c of catData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
    cats[c.code] = cat.id;
  }

  // ---- Thương hiệu ----
  const brandData = ["Dermalogica", "DMK", "Klapp", "Sophia Wellness"];
  for (const name of brandData) {
    await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ---- Nhà cung cấp ----
  const supData = [
    { code: "NCC-COSMEDIX", name: "Cosmedix Việt Nam", contactPerson: "Chị Lan", phone: "0901234567" },
    { code: "NCC-WELLNUTRI", name: "WellNutri Supplements", contactPerson: "Anh Minh", phone: "0912345678" },
    { code: "NCC-SPAPRO", name: "SpaPro Thiết bị", contactPerson: "Anh Tuấn", phone: "0923456789" },
  ];
  const sups: Record<string, string> = {};
  for (const s of supData) {
    const sup = await prisma.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, contactPerson: s.contactPerson },
      create: s,
    });
    sups[s.code] = sup.id;
  }

  // ---- Sản phẩm ----
  interface P {
    sku: string;
    name: string;
    brand?: string;
    cat: string;
    mode: TrackingMode;
    expiry: boolean;
    uom: string;
    min?: number;
  }
  const productsData: P[] = [
    { sku: "SR-VITC-30", name: "Serum Vitamin C 30ml", brand: "Cosmedix", cat: "MP", mode: "LOT", expiry: true, uom: "Chai", min: 10 },
    { sku: "KEM-SPF50", name: "Kem chống nắng SPF50 50ml", brand: "Cosmedix", cat: "MP", mode: "LOT", expiry: true, uom: "Tuýp", min: 15 },
    { sku: "MN-DUONGAM", name: "Mặt nạ dưỡng ẩm (hộp 10)", brand: "Cosmedix", cat: "MP", mode: "LOT", expiry: true, uom: "Hộp", min: 20 },
    { sku: "COLLAGEN-90", name: "Viên uống Collagen (lọ 90 viên)", brand: "WellNutri", cat: "TPCN", mode: "LOT", expiry: true, uom: "Lọ", min: 8 },
    { sku: "VITA-MULTI", name: "Vitamin tổng hợp (lọ 60 viên)", brand: "WellNutri", cat: "TPCN", mode: "LOT", expiry: true, uom: "Lọ", min: 8 },
    { sku: "TD-OAILUONG", name: "Tinh dầu oải hương 100ml", brand: "SpaPro", cat: "VT", mode: "LOT", expiry: true, uom: "Chai", min: 5 },
    { sku: "BONG-TAYTRANG", name: "Bông tẩy trang (gói 200)", cat: "VT", mode: "QUANTITY", expiry: false, uom: "Gói", min: 30 },
    { sku: "KHAN-SPA", name: "Khăn giấy spa (cuộn)", cat: "VT", mode: "QUANTITY", expiry: false, uom: "Cuộn", min: 40 },
    { sku: "GANGTAY-NITRILE", name: "Găng tay nitrile (hộp 100)", cat: "VT", mode: "QUANTITY", expiry: false, uom: "Hộp", min: 25 },
    { sku: "MAY-XONGHOI", name: "Máy xông hơi mặt", brand: "SpaPro", cat: "TB", mode: "QUANTITY", expiry: false, uom: "Cái", min: 2 },
    { sku: "DEN-LED-TRILIEU", name: "Đèn LED trị liệu ánh sáng", brand: "SpaPro", cat: "TB", mode: "QUANTITY", expiry: false, uom: "Cái", min: 1 },
  ];

  const productByS: Record<string, string> = {};
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name },
      create: {
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        categoryId: cats[p.cat],
        trackingMode: p.mode,
        requiresExpiry: p.expiry,
        uom: p.uom,
        minStock: p.min ?? null,
      },
    });
    productByS[p.sku] = prod.id;
  }

  // ---- Tồn ban đầu theo lô (kèm HSD minh hoạ cảnh báo) ----
  // Chỉ seed khi chưa có lô nào (tránh nhân đôi khi chạy lại).
  const existingBatches = await prisma.stockBatch.count();
  if (existingBatches === 0) {
    interface B {
      sku: string;
      code: string | null;
      exp: number | null; // ngày kể từ hôm nay (âm = đã hết hạn)
      qty: number;
      cost: number;
      sup: string;
    }
    const batches: B[] = [
      // Serum Vitamin C: 1 lô còn hạn xa, 1 lô sắp hết hạn (45 ngày)
      { sku: "SR-VITC-30", code: "LOT-VITC-A", exp: 300, qty: 40, cost: 180000, sup: "NCC-COSMEDIX" },
      { sku: "SR-VITC-30", code: "LOT-VITC-B", exp: 45, qty: 12, cost: 180000, sup: "NCC-COSMEDIX" },
      // Kem chống nắng: 1 lô đã hết hạn (-10 ngày) -> cảnh báo đỏ
      { sku: "KEM-SPF50", code: "LOT-SPF-OLD", exp: -10, qty: 6, cost: 150000, sup: "NCC-COSMEDIX" },
      { sku: "KEM-SPF50", code: "LOT-SPF-NEW", exp: 400, qty: 30, cost: 150000, sup: "NCC-COSMEDIX" },
      // Mặt nạ: dưới định mức (min 20, tồn 12)
      { sku: "MN-DUONGAM", code: "LOT-MN-01", exp: 200, qty: 12, cost: 90000, sup: "NCC-COSMEDIX" },
      // Collagen: sắp hết hạn 20 ngày
      { sku: "COLLAGEN-90", code: "LOT-COL-01", exp: 20, qty: 15, cost: 350000, sup: "NCC-WELLNUTRI" },
      { sku: "VITA-MULTI", code: "LOT-VITA-01", exp: 500, qty: 25, cost: 220000, sup: "NCC-WELLNUTRI" },
      { sku: "TD-OAILUONG", code: "LOT-TD-01", exp: 600, qty: 18, cost: 120000, sup: "NCC-SPAPRO" },
      // Vật tư tiêu hao (QUANTITY, không HSD)
      { sku: "BONG-TAYTRANG", code: null, exp: null, qty: 60, cost: 25000, sup: "NCC-SPAPRO" },
      { sku: "KHAN-SPA", code: null, exp: null, qty: 35, cost: 18000, sup: "NCC-SPAPRO" }, // dưới định mức 40
      { sku: "GANGTAY-NITRILE", code: null, exp: null, qty: 50, cost: 95000, sup: "NCC-SPAPRO" },
      // Thiết bị
      { sku: "MAY-XONGHOI", code: null, exp: null, qty: 3, cost: 2500000, sup: "NCC-SPAPRO" },
      { sku: "DEN-LED-TRILIEU", code: null, exp: null, qty: 2, cost: 4200000, sup: "NCC-SPAPRO" },
    ];

    for (const b of batches) {
      const batch = await prisma.stockBatch.create({
        data: {
          productId: productByS[b.sku],
          warehouseId: khoTong.id,
          batchCode: b.code,
          expiryDate: b.exp == null ? null : daysFromNow(b.exp),
          quantity: b.qty,
          unitCost: b.cost,
          supplierId: sups[b.sup],
        },
      });
      await prisma.stockMovement.create({
        data: {
          productId: productByS[b.sku],
          warehouseId: khoTong.id,
          batchId: batch.id,
          type: "INBOUND",
          quantity: b.qty,
          refType: "SEED",
          note: "Tồn đầu kỳ",
        },
      });
    }
  }

  // ---- Liệu trình dịch vụ + định mức tiêu hao ----
  if ((await prisma.service.count()) === 0) {
    const serviceData = [
      {
        code: "SPA-BASIC",
        name: "Chăm sóc da cơ bản",
        price: 350000,
        items: [
          { sku: "SR-VITC-30", qty: 0.2 },
          { sku: "BONG-TAYTRANG", qty: 0.1 },
          { sku: "KHAN-SPA", qty: 0.5 },
        ],
      },
      {
        code: "SPA-MASK",
        name: "Liệu trình đắp mặt nạ dưỡng ẩm",
        price: 450000,
        items: [
          { sku: "MN-DUONGAM", qty: 0.1 },
          { sku: "TD-OAILUONG", qty: 0.05 },
          { sku: "KHAN-SPA", qty: 0.5 },
        ],
      },
      {
        code: "SPA-SUN",
        name: "Chống nắng & bảo vệ da",
        price: 250000,
        items: [
          { sku: "KEM-SPF50", qty: 0.15 },
          { sku: "BONG-TAYTRANG", qty: 0.1 },
        ],
      },
    ];
    for (const s of serviceData) {
      await prisma.service.create({
        data: {
          code: s.code,
          name: s.name,
          price: s.price,
          items: {
            create: s.items.map((i) => ({ productId: productByS[i.sku], quantity: i.qty })),
          },
        },
      });
    }
  }

  // ---- Tài sản / thiết bị (serial + bảo hành) ----
  if ((await prisma.asset.count()) === 0) {
    interface A {
      sku: string;
      serial: string;
      status: "IN_STOCK" | "IN_USE" | "MAINTENANCE" | "RETIRED";
      warranty: number; // ngày kể từ hôm nay (âm = đã hết bảo hành)
      location?: string;
    }
    const assetData: A[] = [
      { sku: "MAY-XONGHOI", serial: "XH-2024-001", status: "IN_USE", warranty: 40, location: "Phòng trị liệu 1" },
      { sku: "MAY-XONGHOI", serial: "XH-2024-002", status: "IN_USE", warranty: 400, location: "Phòng trị liệu 2" },
      { sku: "MAY-XONGHOI", serial: "XH-2023-003", status: "MAINTENANCE", warranty: -20, location: "Kho kỹ thuật" },
      { sku: "DEN-LED-TRILIEU", serial: "LED-2024-001", status: "IN_USE", warranty: 200, location: "Phòng trị liệu 1" },
      { sku: "DEN-LED-TRILIEU", serial: "LED-2022-002", status: "IN_STOCK", warranty: -120 },
    ];
    let idx = 0;
    for (const a of assetData) {
      idx += 1;
      await prisma.asset.create({
        data: {
          code: `TS-${String(idx).padStart(4, "0")}`,
          productId: productByS[a.sku],
          serialNumber: a.serial,
          warehouseId: khoTong.id,
          status: a.status,
          location: a.location,
          purchaseDate: daysFromNow(-500),
          warrantyUntil: daysFromNow(a.warranty),
          supplierId: sups["NCC-SPAPRO"],
        },
      });
    }
  }

  // ---- Cấu hình công ty mặc định ----
  await prisma.companySetting.upsert({
    where: { id: "company" },
    update: {},
    create: {
      id: "company",
      name: "Sophia Wellness",
      address: "Spa & Wellness",
    },
  });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: "SEED", entityType: "System", detail: "Khởi tạo dữ liệu mẫu" },
  });

  console.log("✓ Seed hoàn tất.");
  console.log("  Đăng nhập: admin@sophia.vn / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
