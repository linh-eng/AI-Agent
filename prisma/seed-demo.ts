// =============================================================================
// SEED DEMO (nghiệm thu giao diện) — DỮ LIỆU MINH HỌA, KHÔNG PHẢI KHÁCH THẬT.
//
// Chạy SAU `npm run db:seed` (seed nền). Bổ sung theo chiều RỘNG để nghiệm thu UX:
//   * ~7 khách hàng ở nhiều trạng thái (mới / tư vấn / booking / đang phác đồ /
//     hoàn thành / follow-up).
//   * Brand Klapp; công nghệ RF, HIFU; dịch vụ + sản phẩm demo.
//   * Protocol DEMO (nội bộ, nhiều bước, CÓ VERSION) — ghi rõ là minh họa, KHÔNG
//     phải protocol chuyên môn chính thức của brand.
//   * Phác đồ nhiều buổi + Before/After (ảnh placeholder thật) + đề xuất sản phẩm
//     (Essential/Recommended/Optional) + báo giá 3 phương án (Cơ bản/Khuyến nghị/
//     Chuyên sâu) + dặn dò + CSKH + thanh toán.
//   * Kho vật tư spa + tồn; chiến dịch marketing + lead.
//
// Idempotent: nếu đã có KH-100001 thì bỏ qua (chạy lại không nhân đôi).
// =============================================================================
import "dotenv/config"; // nạp .env (Windows/Linux) không cần set env thủ công
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { consumeFromContainer, consumeFromCustomerMaterial } from "../src/lib/spa-material-service";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const prisma = new PrismaClient();

const STORAGE_DIR = process.env.STORAGE_DIR ?? `${process.cwd()}/var/uploads`;

// Sinh 1 PNG đặc màu (WxH) hợp lệ (chuẩn PNG có CRC) — ảnh Before/After demo.
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePng(w: number, h: number, rgb: [number, number, number]): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type 2 (RGB)
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3;
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}
const PNG_BEFORE = makePng(240, 160, [120, 144, 200]); // xanh dương nhạt
const PNG_AFTER = makePng(240, 160, [130, 190, 140]);  // xanh lá nhạt

async function writeBlob(key: string, buf: Buffer) {
  const full = path.join(STORAGE_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf, { mode: 0o600 });
}

async function main() {
  if (await prisma.customer.findUnique({ where: { code: "KH-100001" } })) {
    console.log("ℹ️  Dữ liệu demo đã tồn tại (KH-100001) — bỏ qua để không nhân đôi.");
    return;
  }
  console.log("🌱 Seed DỮ LIỆU DEMO...");

  // --- Brand / Công nghệ / Dịch vụ / Sản phẩm bổ sung ---
  const klapp = await prisma.brand.upsert({
    where: { code: "BR-KLAPP" }, update: {},
    create: { code: "BR-KLAPP", name: "Klapp", description: "Klapp Cosmetics (Đức) — chăm sóc da chuyên sâu" },
  });
  const techRF = await prisma.technology.upsert({
    where: { code: "CN-RF" }, update: {},
    create: { code: "CN-RF", name: "RF nâng cơ", group: "RF", deviceModel: "Thermage-like", area: "Mặt/cổ", durationMinutes: 45, indications: "Chảy xệ, lão hóa", contraindications: "Thai kỳ, cấy ghép kim loại" },
  });
  const techHIFU = await prisma.technology.upsert({
    where: { code: "CN-HIFU" }, update: {},
    create: { code: "CN-HIFU", name: "HIFU nâng cơ", group: "HIFU", deviceModel: "Ultraformer-like", area: "Mặt/cằm", durationMinutes: 60, indications: "Nâng cơ, gọn hàm", contraindications: "Thai kỳ, viêm da" },
  });

  const catFacial = await prisma.serviceCategory.upsert({ where: { code: "DM-FACIAL" }, update: {}, create: { code: "DM-FACIAL", name: "Chăm sóc da mặt" } });
  const catLaser = await prisma.serviceCategory.upsert({ where: { code: "DM-LASER" }, update: {}, create: { code: "DM-LASER", name: "Công nghệ cao" } });

  const svcRF = await prisma.service.upsert({
    where: { code: "DV-RF-01" }, update: {},
    create: { code: "DV-RF-01", name: "RF nâng cơ mặt", categoryId: catLaser.id, durationMinutes: 45, standardPrice: 1_800_000, expectedCost: 500_000 },
  });
  const svcHIFU = await prisma.service.upsert({
    where: { code: "DV-HIFU-01" }, update: {},
    create: { code: "DV-HIFU-01", name: "Nâng cơ HIFU", categoryId: catLaser.id, durationMinutes: 60, standardPrice: 6_000_000, expectedCost: 1_800_000 },
  });
  await prisma.service.upsert({
    where: { code: "DV-PEEL-01" }, update: {},
    create: { code: "DV-PEEL-01", name: "Peel da sinh học", categoryId: catFacial.id, durationMinutes: 40, standardPrice: 900_000, expectedCost: 300_000 },
  });

  const spKlappSerum = await prisma.spaProduct.upsert({
    where: { sku: "SP-KLAPP-CSERUM" }, update: {},
    create: { sku: "SP-KLAPP-CSERUM", name: "Klapp Vitamin C Serum", brandId: klapp.id, category: "Serum", productType: "HOME_CARE", sellingPrice: 1_500_000, cost: 520_000, benefits: "Chống oxy hóa, làm sáng" },
  });
  const spKlappMask = await prisma.spaProduct.upsert({
    where: { sku: "SP-KLAPP-MASK" }, update: {},
    create: { sku: "SP-KLAPP-MASK", name: "Klapp Hydra Mask", brandId: klapp.id, category: "Mặt nạ", productType: "PROFESSIONAL", sellingPrice: 0, cost: 280_000 },
  });
  const spCleanser = await prisma.spaProduct.upsert({
    where: { sku: "SP-GEL-CLEANSER" }, update: {},
    create: { sku: "SP-GEL-CLEANSER", name: "Gel rửa mặt dịu nhẹ", category: "Làm sạch", productType: "HOME_CARE", sellingPrice: 350_000, cost: 120_000 },
  });

  // --- Protocol DEMO (nội bộ, nhiều bước, có VERSION) — MINH HỌA ---
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DEMO-GLOW" }, update: {},
    create: {
      code: "PROTO-DEMO-GLOW",
      name: "DEMO — Quy trình dưỡng sáng 5 bước (minh họa)",
      kind: "INTERNAL",
      status: "ACTIVE",
      version: 2,
      purpose: "DỮ LIỆU DEMO để minh họa tính năng Protocol nhiều bước + version. KHÔNG phải phác đồ chuyên môn chính thức.",
      suitableFor: "Da xỉn màu (minh họa)",
      contraindications: "Da đang kích ứng (minh họa)",
      steps: { items: [
        { name: "Tẩy trang & làm sạch", durationMinutes: 10 },
        { name: "Tẩy tế bào chết enzyme", durationMinutes: 15 },
        { name: "Điện di Vitamin C", durationMinutes: 20 },
        { name: "Mặt nạ cấp ẩm", durationMinutes: 15 },
        { name: "Chống nắng & dặn dò", durationMinutes: 10 },
      ] },
      durationMinutes: 70,
      recommendedFreq: "1 tuần/lần",
      recommendedCount: 8,
      changeLog: { items: [{ version: 2, note: "DEMO: thêm bước điện di Vitamin C", at: "2026-08-01" }] },
      createdBy: "Phạm Chuyên Viên",
    },
  });

  // --- Kho vật tư spa + tồn (để màn Tồn kho có dữ liệu) ---
  const whSpa = await prisma.warehouse.upsert({
    where: { code: "K-SPA-VT" }, update: {},
    create: { code: "K-SPA-VT", name: "Kho vật tư Spa", countsAsAvailable: true },
  });
  const prodTip = await prisma.product.upsert({
    where: { sku: "VT-LASER-TIP" }, update: {},
    create: { sku: "VT-LASER-TIP", name: "Đầu tip Laser Pico", trackingMode: "LOT", uom: "Cái" },
  });
  const prodKim = await prisma.product.upsert({
    where: { sku: "VT-KIM-VIKIM" }, update: {},
    create: { sku: "VT-KIM-VIKIM", name: "Kim vi kim (hộp)", trackingMode: "LOT", uom: "Hộp" },
  });
  await prisma.lot.upsert({
    where: { productId_lotNumber_warehouseId: { productId: prodTip.id, lotNumber: "LOT-TIP-2026A", warehouseId: whSpa.id } }, update: {},
    create: { lotNumber: "LOT-TIP-2026A", productId: prodTip.id, warehouseId: whSpa.id, quantity: 50 },
  });
  await prisma.lot.upsert({
    where: { productId_lotNumber_warehouseId: { productId: prodKim.id, lotNumber: "LOT-KIM-2026A", warehouseId: whSpa.id } }, update: {},
    create: { lotNumber: "LOT-KIM-2026A", productId: prodKim.id, warehouseId: whSpa.id, quantity: 30 },
  });

  // --- Chiến dịch marketing + lead bổ sung ---
  const campTiktok = await prisma.marketingCampaign.upsert({
    where: { code: "CAMP-TIKTOK-2026" }, update: {},
    create: { code: "CAMP-TIKTOK-2026", name: "TikTok Trẻ hóa Thu 2026", channel: "TikTok Ads", startDate: new Date("2026-08-01"), endDate: new Date("2026-10-31"), budget: 40_000_000, cost: 12_000_000, owner: "Vũ Marketing" },
  });
  await prisma.lead.upsert({ where: { code: "LEAD-100001" }, update: {}, create: { code: "LEAD-100001", name: "Nguyễn Thu Trang", phone: "0933111222", source: "TikTok", campaignId: campTiktok.id, status: "CONTACTED" } });
  await prisma.lead.upsert({ where: { code: "LEAD-100002" }, update: {}, create: { code: "LEAD-100002", name: "Lý Gia Bảo", phone: "0977888999", source: "TikTok", campaignId: campTiktok.id, status: "BOOKED" } });

  // --- Khách hàng ở nhiều trạng thái ---
  // 1) MỚI
  const kMoi = await prisma.customer.create({
    data: { code: "KH-100001", fullName: "Lê Minh Anh", gender: "FEMALE", phone: "0900100001", source: "Zalo", group: "Thường", assignedTo: "Lê Thị CSKH", campaignId: campTiktok.id, dob: new Date("1994-03-18"), legacyId: "MYSPA-8842", legacySource: "MySpa" },
  });
  await prisma.crmActivity.create({ data: { customerId: kMoi.id, type: "INTERNAL_NOTE", content: "Khách mới để lại số qua TikTok, chưa tư vấn.", performedBy: "Lê Thị CSKH", occurredAt: new Date("2026-08-05T02:00:00Z") } });

  // 2) ĐANG TƯ VẤN
  const kTuVan = await prisma.customer.create({
    data: { code: "KH-100002", fullName: "Trần Bảo Ngọc", gender: "FEMALE", phone: "0900100002", source: "Giới thiệu", group: "Thường", assignedTo: "Phạm Chuyên Viên", goals: "Trẻ hóa, nâng cơ", dob: new Date("1996-08-20") },
  });
  await prisma.assessment.create({ data: { customerId: kTuVan.id, name: "Da chảy xệ nhẹ", area: "Đường viền hàm", severity: "Nhẹ", description: "Bắt đầu chùng nhẹ vùng hàm", assessedBy: "Phạm Chuyên Viên" } });
  await prisma.crmActivity.create({ data: { customerId: kTuVan.id, type: "CONSULT", content: "Tư vấn HIFU vs RF, khách đang cân nhắc ngân sách.", result: "Đang cân nhắc", performedBy: "Phạm Chuyên Viên", occurredAt: new Date("2026-08-06T04:00:00Z"), nextAction: "Gửi báo giá", followUpDate: new Date("2026-08-12T02:00:00Z"), followUpOwner: "Phạm Chuyên Viên" } });
  await prisma.task.create({ data: { title: "Gửi báo giá HIFU cho khách Bảo Ngọc", customerId: kTuVan.id, assignee: "Phạm Chuyên Viên", dueDate: new Date("2026-08-12T02:00:00Z"), priority: "NORMAL", status: "OPEN", createdBy: "Phạm Chuyên Viên" } });

  // 3) ĐÃ BOOKING (chưa thực hiện)
  const kBooking = await prisma.customer.create({
    data: { code: "KH-100003", fullName: "Phạm Gia Hân", gender: "FEMALE", phone: "0900100003", source: "Facebook", group: "Thường", assignedTo: "Nguyễn Lễ Tân" },
  });
  await prisma.booking.create({ data: { code: "BK-100001", customerId: kBooking.id, serviceId: svcRF.id, scheduledAt: new Date("2026-08-18T07:00:00Z"), durationMinutes: 45, room: "Phòng 2", bed: "Giường A", machine: "Máy RF #1", technician: "Phạm Chuyên Viên", master: "Trần Quản Lý", performer: "Phạm Chuyên Viên", status: "CONFIRMED", price: 1_800_000 } });

  // 4) ĐANG THỰC HIỆN PHÁC ĐỒ (đầy đủ) — có portal
  const kDangPD = await prisma.customer.create({
    data: { code: "KH-100004", fullName: "Đỗ Thùy Linh", gender: "FEMALE", phone: "0900100004", email: "linh.do@example.com", source: "Facebook Ads", group: "VIP", assignedTo: "Phạm Chuyên Viên", goals: "Trẻ hóa, nâng cơ mặt", tags: ["nâng cơ", "VIP"], campaignId: campTiktok.id, dob: new Date("1993-08-30") },
  });
  await prisma.assessment.create({ data: { customerId: kDangPD.id, name: "Chảy xệ vùng má - hàm", area: "Má, hàm", severity: "Vừa", description: "Chùng da vùng má, đường hàm chưa gọn", assessedBy: "Phạm Chuyên Viên", indicators: { do_dan_hoi: "trung bình" } } });
  const planLinh = await prisma.treatmentPlan.create({
    data: {
      code: "TP-100001", customerId: kDangPD.id, name: "Phác đồ nâng cơ 6 buổi", version: 1, status: "ACTIVE",
      diagnosis: "Lão hóa nhẹ-vừa vùng má/hàm", goals: "Nâng cơ, gọn đường hàm sau 6 buổi", totalPrice: 24_000_000, createdBy: "Phạm Chuyên Viên",
      stages: { create: [ { name: "Chuẩn bị", orderIndex: 0 }, { name: "Nâng cơ", orderIndex: 1 }, { name: "Duy trì", orderIndex: 2 } ] },
    },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  const bkLinh1 = await prisma.booking.create({ data: { code: "BK-100002", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: new Date("2026-07-25T07:00:00Z"), durationMinutes: 45, room: "Phòng 2", performer: "Phạm Chuyên Viên", status: "COMPLETED", price: 1_800_000 } });
  const sLinh1 = await prisma.treatmentSession.create({
    data: {
      planId: planLinh.id, stageId: planLinh.stages[0].id, customerId: kDangPD.id, bookingId: bkLinh1.id, serviceId: svcRF.id,
      sessionNumber: 1, name: "RF nâng cơ buổi 1", status: "COMPLETED", scheduledAt: new Date("2026-07-25T07:00:00Z"), performedAt: new Date("2026-07-25T07:15:00Z"),
      performer: "Phạm Chuyên Viên", objective: "RF vùng má", actualParams: { nang_luong: "làm ấm 42°C" }, conditionBefore: "Da chùng nhẹ", conditionAfter: "Săn hơn tức thì", customerFeedback: "Ưng ý", plannedCost: 500_000, actualCost: 480_000, price: 1_800_000, checkedBy: "Trần Quản Lý",
    },
  });

  // --- CSKH follow-up (mục 31–35): quy trình chăm sóc sau dịch vụ + sinh nhật ---
  await prisma.followUpTemplate.create({
    data: {
      code: "CS-000001", name: "Chăm sóc sau liệu trình", trigger: "AFTER_SERVICE", createdBy: "Lê Thị CSKH",
      description: "Quy trình hỏi thăm & nhắc lịch sau buổi điều trị.",
      steps: { create: [
        { orderIndex: 0, dayOffset: 1, channel: "ZALO", title: "Hỏi thăm phản ứng sau 1 ngày", script: "Chào chị, sau buổi hôm qua da mình có bị đỏ/ngứa gì không ạ?", checklist: ["Hỏi phản ứng da", "Nhắc kiêng nắng 48h", "Nhắc uống đủ nước"] },
        { orderIndex: 1, dayOffset: 3, channel: "SMS", title: "Nhắc dùng sản phẩm tại nhà", script: "Nhắc chị dùng serum sáng/tối theo hướng dẫn nhé.", checklist: ["Xác nhận đang dùng đúng"] },
        { orderIndex: 2, dayOffset: 14, channel: "IN_PERSON", title: "Mời đặt lịch buổi kế", script: "Đã đến lịch buổi kế, mời chị sắp xếp thời gian ạ.", checklist: ["Chốt ngày buổi kế"] },
      ] },
    },
  });
  await prisma.followUpTemplate.create({
    data: {
      code: "CS-000002", name: "Chúc mừng sinh nhật", trigger: "BIRTHDAY", createdBy: "Lê Thị CSKH",
      description: "Gửi lời chúc + ưu đãi sinh nhật.",
      steps: { create: [
        { orderIndex: 0, dayOffset: 0, channel: "ZALO", title: "Gửi lời chúc + voucher sinh nhật", script: "Chúc mừng sinh nhật chị! Spa gửi tặng ưu đãi sinh nhật...", checklist: ["Gửi voucher", "Ghi nhận phản hồi"] },
      ] },
    },
  });

  // --- Giá sàn (mục 25–26): khai báo chi phí cấu thành cho dịch vụ RF ---
  // Chi phí: nhân sự 700k (KTV+master) + vận hành 150k + khấu hao 200k + vật tư 250k
  // + phòng 100k = 1.400.000; biên tối thiểu 15% → giá sàn 1.610.000 (giá chuẩn RF
  // 1.800.000 > sàn: OK). Bán < 1.610.000 sẽ bị chặn/cần duyệt.
  await prisma.servicePriceFloor.create({
    data: { serviceId: svcRF.id, laborCost: 700_000, operationCost: 150_000, depreciationCost: 200_000, materialCost: 250_000, roomCost: 100_000, minMarginPercent: 15, updatedBy: "Trần Quản Lý" },
  });

  // --- Nhân sự (mục 22–24): đa vai trò + phân công buổi kèm phí ---
  const nvKTV = await prisma.employee.create({ data: { code: "NV-000001", fullName: "Phạm Chuyên Viên", phone: "0911000001", roles: ["Kỹ thuật viên", "Tư vấn"], defaultFee: 200_000 } });
  const nvMaster = await prisma.employee.create({ data: { code: "NV-000002", fullName: "Trần Quản Lý", phone: "0911000002", roles: ["Master", "Quản lý", "Kiểm tra"], defaultFee: 500_000 } });
  await prisma.employee.create({ data: { code: "NV-000003", fullName: "Lê Thị CSKH", phone: "0911000003", roles: ["CSKH", "Lễ tân"], defaultFee: 100_000 } });
  await prisma.employee.create({ data: { code: "NV-000004", fullName: "Đỗ Thu Ngân", phone: "0911000004", roles: ["Sales", "Lễ tân"], defaultFee: 100_000 } });
  // Phân công buổi RF #1: KTV chính + Master kiểm tra (tổng phí 700k).
  await prisma.sessionStaff.create({ data: { sessionId: sLinh1.id, employeeId: nvKTV.id, staffName: nvKTV.fullName, role: "PRIMARY", fee: 200_000 } });
  await prisma.sessionStaff.create({ data: { sessionId: sLinh1.id, employeeId: nvMaster.id, staffName: nvMaster.fullName, role: "CHECKER", fee: 500_000 } });

  // --- Đánh giá sau buổi (mục 36–37) ---
  await prisma.sessionReview.create({
    data: {
      sessionId: sLinh1.id, customerId: kDangPD.id, satisfactionScore: 5, technicianScore: 5, technicianName: "Phạm Chuyên Viên",
      comment: "Rất hài lòng, da săn chắc rõ.", wouldReturn: true,
      technicianReport: "Da đáp ứng tốt với RF, không kích ứng. Đề xuất buổi HIFU đúng lịch.", reviewedBy: "Lê Thị CSKH",
    },
  });
  const sLinh2 = await prisma.treatmentSession.create({
    data: {
      planId: planLinh.id, stageId: planLinh.stages[1].id, customerId: kDangPD.id, serviceId: svcHIFU.id,
      sessionNumber: 2, name: "HIFU nâng cơ buổi 2", status: "PLANNED", scheduledAt: new Date("2026-08-20T07:00:00Z"),
      objective: "HIFU đường hàm", plannedParams: { line: 3, do_sau: "4.5mm" }, plannedCost: 1_800_000, price: 6_000_000, preCare: "Không nặn mụn, không rượu bia 24h trước",
    },
  });
  // Before/After ảnh thật (placeholder) cho buổi 1
  await writeBlob("demo/before-linh.png", PNG_BEFORE);
  await writeBlob("demo/after-linh.png", PNG_AFTER);
  await prisma.mediaAsset.createMany({
    data: [
      { storageKey: "demo/before-linh.png", filename: "truoc-buoi1.png", contentType: "image/png", size: 70, kind: "BEFORE_IMAGE", customerId: kDangPD.id, sessionId: sLinh1.id, sharedWithCustomer: true, uploadedBy: "Phạm Chuyên Viên" },
      { storageKey: "demo/after-linh.png", filename: "sau-buoi1.png", contentType: "image/png", size: 70, kind: "AFTER_IMAGE", customerId: kDangPD.id, sessionId: sLinh1.id, sharedWithCustomer: true, uploadedBy: "Phạm Chuyên Viên" },
    ],
  });
  // Đề xuất sản phẩm: Essential / Recommended / Optional
  await prisma.productRecommendation.createMany({
    data: [
      { customerId: kDangPD.id, spaProductId: spKlappSerum.id, priority: "ESSENTIAL", reason: "Chống oxy hóa, duy trì hiệu quả nâng cơ", createdBy: "Phạm Chuyên Viên" },
      { customerId: kDangPD.id, spaProductId: spCleanser.id, priority: "RECOMMENDED", reason: "Làm sạch dịu nhẹ hằng ngày", createdBy: "Phạm Chuyên Viên" },
    ],
  });
  await prisma.careInstruction.upsert({
    where: { code: "CARE-DEMO-POST-RF" }, update: {},
    create: { code: "CARE-DEMO-POST-RF", title: "Dặn dò sau RF/HIFU (demo)", kind: "POST_CARE", category: "RF/HIFU", status: "ACTIVE", content: "Uống đủ nước, tránh nắng, dùng chống nắng SPF50, không xông hơi 3 ngày.", createdBy: "Phạm Chuyên Viên" },
  });
  // --- Vật tư khách hàng (riêng KH — Hồ sơ 360°) ---
  await prisma.customerMaterial.create({
    data: { code: "VTKH-100001", customerId: kDangPD.id, name: "Kem chống nắng SPF50 (gói VIP)", unit: "tuýp", allocatedQty: 10, usedQty: 3, unitCost: 120_000, planId: planLinh.id, status: "ACTIVE", note: "Cấp kèm phác đồ nâng cơ", createdBy: "Phạm Chuyên Viên" },
  });
  // --- Hướng dẫn chăm sóc ĐÃ GỬI cho khách (instance, snapshot nội dung) ---
  await prisma.careInstructionInstance.create({
    data: { kind: "POST_CARE", title: "Dặn dò sau RF buổi 1", content: "Uống đủ nước, tránh nắng, dùng chống nắng SPF50, không xông hơi 3 ngày.", customerId: kDangPD.id, sessionId: sLinh1.id, deliveredVia: "ZALO", deliveredAt: new Date("2026-07-25T10:00:00Z"), providedBy: "Lê Thị CSKH" },
  });
  // --- Việc follow-up CSKH đang chờ ---
  await prisma.task.create({
    data: { title: "Gọi hỏi thăm sau RF buổi 1", customerId: kDangPD.id, assignee: "Lê Thị CSKH", dueDate: new Date("2026-08-19T02:00:00Z"), priority: "NORMAL", status: "OPEN", channel: "ZALO", createdBy: "Lê Thị CSKH" },
  });
  // --- Booking SẮP TỚI (HIFU buổi 2) để hiển thị "Booking tiếp theo" ---
  await prisma.booking.create({
    data: { code: "BK-100004", customerId: kDangPD.id, serviceId: svcHIFU.id, scheduledAt: new Date("2026-08-20T07:00:00Z"), durationMinutes: 60, room: "Phòng 3", bed: "Giường B", machine: "Máy HIFU #1", technician: "Phạm Chuyên Viên", master: "Trần Quản Lý", performer: "Phạm Chuyên Viên", status: "CONFIRMED", price: 6_000_000 },
  });
  // --- Biểu mẫu đã áp cho khách (snapshot schema, không đổi mẫu gốc) ---
  const skinForm = await prisma.formTemplate.findUnique({ where: { code: "FORM-SKIN-ASSESS" } });
  if (skinForm) {
    await prisma.formInstance.create({
      data: { templateId: skinForm.id, templateVersion: skinForm.version, schemaSnapshot: skinForm.schema as any, customerId: kDangPD.id, planId: planLinh.id, name: "Phiếu đánh giá da – Đỗ Thùy Linh", status: "COMPLETED", completedBy: "Phạm Chuyên Viên", completedAt: new Date("2026-07-25T07:00:00Z"), createdBy: "Phạm Chuyên Viên" },
    });
  }
  await prisma.crmActivity.create({ data: { customerId: kDangPD.id, type: "CALL", content: "Nhắc lịch HIFU buổi 2, khách xác nhận.", result: "Xác nhận", performedBy: "Lê Thị CSKH", occurredAt: new Date("2026-08-10T03:00:00Z"), nextAction: "Chuẩn bị phòng HIFU", followUpDate: new Date("2026-08-19T02:00:00Z"), followUpOwner: "Lê Thị CSKH" } });
  // Báo giá 3 phương án — ĐÃ CHỐT phương án "Khuyến nghị" → tạo HÓA ĐƠN → thu một phần.
  const proposalLinh = await prisma.treatmentProposal.create({
    data: {
      code: "PROP-100001", customerId: kDangPD.id, title: "Phương án nâng cơ 2026", status: "ACCEPTED", createdBy: "Phạm Chuyên Viên",
      options: { create: [
        { kind: "ESSENTIAL", name: "Cơ bản", orderIndex: 0, sessions: 4, totalPrice: 7_200_000, items: { create: [ { itemType: "SERVICE", name: "RF nâng cơ mặt", quantity: 4, unitPrice: 1_800_000, unitCost: 500_000, orderIndex: 0 } ] } },
        { kind: "RECOMMENDED", name: "Khuyến nghị", orderIndex: 1, sessions: 6, totalPrice: 11_900_000, discount: 400_000, items: { create: [ { itemType: "SERVICE", name: "RF nâng cơ mặt", quantity: 6, unitPrice: 1_800_000, unitCost: 500_000, orderIndex: 0 }, { itemType: "PRODUCT", name: "Klapp Vitamin C Serum", quantity: 1, unitPrice: 1_500_000, unitCost: 520_000, isHomeCare: true, orderIndex: 1 } ] } },
        { kind: "PREMIUM", name: "Chuyên sâu", orderIndex: 2, sessions: 6, totalPrice: 37_500_000, discount: 1_500_000, items: { create: [ { itemType: "SERVICE", name: "Nâng cơ HIFU", quantity: 6, unitPrice: 6_000_000, unitCost: 1_800_000, orderIndex: 0 }, { itemType: "PRODUCT", name: "Klapp Vitamin C Serum", quantity: 1, unitPrice: 1_500_000, unitCost: 520_000, isHomeCare: true, orderIndex: 1 } ] } },
      ] },
    },
    include: { options: { include: { items: { orderBy: { orderIndex: "asc" } } } } },
  });
  const chosen = proposalLinh.options.find((o) => o.kind === "RECOMMENDED")!;
  const agreedLinh = 11_900_000;
  await prisma.treatmentProposal.update({
    where: { id: proposalLinh.id },
    data: {
      acceptedOptionId: chosen.id, acceptedAt: new Date("2026-08-01T02:00:00Z"), acceptedBy: "Đỗ Thùy Linh", agreedPrice: agreedLinh,
      acceptedSnapshot: { optionId: chosen.id, kind: chosen.kind, name: chosen.name, discount: 400_000, computedTotal: agreedLinh, items: chosen.items.map((it) => ({ itemType: it.itemType, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, isHomeCare: it.isHomeCare })) },
    },
  });
  // Hóa đơn từ báo giá đã chốt (subtotal 12,300,000 − chiết khấu 400,000 = 11,900,000).
  const invLinh = await prisma.invoice.create({
    data: {
      code: "HD-000001", customerId: kDangPD.id, proposalId: proposalLinh.id, planId: planLinh.id, status: "PARTIAL",
      subtotal: 12_300_000, discount: 400_000, total: agreedLinh, createdBy: "Đỗ Thu Ngân",
      items: { create: chosen.items.map((it, i) => ({ name: it.name, quantity: it.quantity ?? 1, unitPrice: Number(it.unitPrice ?? 0), amount: Number(it.unitPrice ?? 0) * (it.quantity ?? 1), note: it.isHomeCare ? "Sản phẩm tại nhà" : null, orderIndex: i })) },
    },
  });
  // Thu 2 đợt vào hóa đơn (tổng 8.000.000 ≤ tổng phải thu 11.900.000) → còn phải
  // thu 3.900.000. Mọi khoản thu đều gắn hóa đơn nên "Đã thanh toán" luôn ≤ "Tổng
  // phải thu" (không có tiền dư trộn vào).
  await prisma.payment.create({ data: { customerId: kDangPD.id, invoiceId: invLinh.id, amount: 5_000_000, method: "TRANSFER", receivedBy: "Đỗ Thu Ngân", note: "Đặt cọc hóa đơn nâng cơ (đợt 1)", paidAt: new Date("2026-08-01T03:00:00Z") } });
  await prisma.payment.create({ data: { customerId: kDangPD.id, invoiceId: invLinh.id, amount: 3_000_000, method: "CASH", receivedBy: "Đỗ Thu Ngân", note: "Thanh toán đợt 2 hóa đơn nâng cơ", paidAt: new Date("2026-08-08T03:00:00Z") } });
  await prisma.customerPortalAccount.upsert({
    where: { customerId: kDangPD.id }, update: {},
    create: { customerId: kDangPD.id, email: "linh.do@example.com", passwordHash: await hashPassword("khach123") },
  });

  // 5) ĐÃ HOÀN THÀNH
  const kXong = await prisma.customer.create({
    data: { code: "KH-100005", fullName: "Vũ Khánh Chi", gender: "FEMALE", phone: "0900100005", source: "Giới thiệu", group: "VIP", assignedTo: "Phạm Chuyên Viên", goals: "Trị mụn" },
  });
  const planChi = await prisma.treatmentPlan.create({
    data: { code: "TP-100002", customerId: kXong.id, name: "Phác đồ trị mụn 4 buổi", version: 1, status: "COMPLETED", goals: "Sạch mụn viêm", totalPrice: 6_000_000, createdBy: "Phạm Chuyên Viên",
      stages: { create: [ { name: "Điều trị", orderIndex: 0 } ] } },
    include: { stages: true },
  });
  let sChi1: any = null;
  for (let i = 1; i <= 4; i++) {
    const s = await prisma.treatmentSession.create({ data: { planId: planChi.id, stageId: planChi.stages[0].id, customerId: kXong.id, sessionNumber: i, name: `Trị mụn buổi ${i}`, status: "COMPLETED", performedAt: new Date(`2026-06-${10 + i}T07:00:00Z`), performer: "Phạm Chuyên Viên", actualCost: 300_000, price: 1_500_000, checkedBy: "Trần Quản Lý" } });
    if (i === 1) sChi1 = s;
  }
  await prisma.payment.create({ data: { customerId: kXong.id, planId: planChi.id, amount: 6_000_000, method: "CASH", receivedBy: "Đỗ Thu Ngân", note: "Thanh toán đủ phác đồ trị mụn", paidAt: new Date("2026-06-11T09:00:00Z") } });
  await prisma.crmActivity.create({ data: { customerId: kXong.id, type: "INTERNAL_NOTE", content: "Hoàn thành phác đồ, khách hài lòng, giới thiệu bạn.", result: "Rất hài lòng", performedBy: "Lê Thị CSKH", occurredAt: new Date("2026-07-01T03:00:00Z") } });

  // 6) ĐANG FOLLOW-UP
  const kFollow = await prisma.customer.create({
    data: { code: "KH-100006", fullName: "Hoàng Yến Nhi", gender: "FEMALE", phone: "0900100006", source: "Facebook", group: "Thường", assignedTo: "Lê Thị CSKH", goals: "Duy trì sau trị nám" },
  });
  await prisma.crmActivity.create({ data: { customerId: kFollow.id, type: "CALL", content: "Follow-up sau 1 tháng, da ổn định, tư vấn duy trì.", result: "Ổn định", performedBy: "Lê Thị CSKH", occurredAt: new Date("2026-08-08T03:00:00Z"), nextAction: "Mời gói duy trì", followUpDate: new Date("2026-08-22T02:00:00Z"), followUpOwner: "Lê Thị CSKH" } });
  await prisma.task.create({ data: { title: "Mời khách Yến Nhi gói duy trì hằng tháng", customerId: kFollow.id, assignee: "Lê Thị CSKH", dueDate: new Date("2026-08-22T02:00:00Z"), priority: "LOW", status: "OPEN", createdBy: "Lê Thị CSKH" } });

  // 7) Khách nam — booking + đánh giá
  const kNam = await prisma.customer.create({
    data: { code: "KH-100007", fullName: "Bùi Tuấn Kiệt", gender: "MALE", phone: "0900100007", source: "Google", group: "Thường", assignedTo: "Nguyễn Lễ Tân", goals: "Trị sẹo rỗ" },
  });
  await prisma.assessment.create({ data: { customerId: kNam.id, name: "Sẹo rỗ hai bên má", area: "Má", severity: "Vừa", description: "Sẹo box/rolling nông", assessedBy: "Phạm Chuyên Viên" } });
  await prisma.booking.create({ data: { code: "BK-100003", customerId: kNam.id, serviceId: svcRF.id, scheduledAt: new Date("2026-08-21T08:00:00Z"), durationMinutes: 45, room: "Phòng 3", machine: "Máy RF #2", technician: "Phạm Chuyên Viên", performer: "Phạm Chuyên Viên", status: "NEW", price: 1_800_000 } });

  // ==========================================================================
  // DEMO VẬT TƯ — 2 trường hợp bắt buộc.
  // ==========================================================================
  // A) Kho vật tư sử dụng: JetPeel Solution (1 lọ 100ml, giá vốn 2.000.000₫, định mức 5ml/buổi).
  const jetpeel = await prisma.usageMaterial.create({
    data: { code: "VT-JETPEEL", name: "JetPeel Solution Demo", unit: "ml", category: "Dung dịch", expectedPerSession: 5, lowThreshold: 20, createdBy: "Phạm Chuyên Viên" },
  });
  const jetContainer = await prisma.materialContainer.create({
    data: { usageMaterialId: jetpeel.id, containerNo: "JETPEEL-2026-01", initialQty: 100, remainingQty: 100, unit: "ml", costSnapshot: 2_000_000, openedAt: new Date("2026-08-01"), expiryDate: new Date("2026-09-15"), status: "IN_USE", createdBy: "Phạm Chuyên Viên" },
  });
  // Customer A (Đỗ Thùy Linh) dùng 5ml; Customer B (Vũ Khánh Chi) dùng 7ml; A dùng tiếp 6ml.
  await consumeFromContainer(jetContainer.id, { sessionId: sLinh1.id, performedBy: "Phạm Chuyên Viên", quantity: 5 });
  await consumeFromContainer(jetContainer.id, { sessionId: sChi1?.id ?? null, performedBy: "Phạm Chuyên Viên", quantity: 7 });
  await consumeFromContainer(jetContainer.id, { sessionId: sLinh2.id, performedBy: "Phạm Chuyên Viên", quantity: 6 });
  // -> còn lại 82ml; chi phí: 100k + 140k + 120k (đơn giá 20.000₫/ml).

  // B) Vật tư khách hàng: Customer A có 10 đơn vị riêng; buổi 1 dùng 3, buổi 2 dùng 2 -> còn 5.
  const custMat = await prisma.customerMaterial.create({
    data: { code: "VTKH-DEMO-01", customerId: kDangPD.id, name: "Bộ kit dưỡng tại nhà (demo)", unit: "đơn vị", allocatedQty: 10, unitCost: 50_000, status: "ACTIVE", createdBy: "Phạm Chuyên Viên" },
  });
  await consumeFromCustomerMaterial(custMat.id, { sessionId: sLinh1.id, performedBy: "Phạm Chuyên Viên", quantity: 3 });
  await consumeFromCustomerMaterial(custMat.id, { sessionId: sLinh2.id, performedBy: "Phạm Chuyên Viên", quantity: 2 });
  // -> đã dùng 5, còn 5. (Khách khác KHÔNG dùng được — chặn ở service, có test.)

  console.log("   Vật tư demo: JetPeel 100ml (còn 82ml), Vật tư khách hàng 10đv (còn 5).");
  console.log("✅ Seed DEMO hoàn tất: 7 khách (KH-100001..007), brand Klapp, CN RF/HIFU,");
  console.log("   protocol DEMO có version, kho vật tư spa, 2 chiến dịch, báo giá 3 phương án.");
  console.log("   Cổng khách demo #2: linh.do@example.com / khach123 (KH-100004).");
}

main()
  .catch((e) => { console.error("❌ Seed DEMO lỗi:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
