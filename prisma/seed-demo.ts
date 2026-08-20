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
import { createFloorVersion, transitionFloorVersion } from "../src/lib/price-floor-service";
import { parseVnLocal } from "../src/lib/timezone";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const prisma = new PrismaClient();

// Thời gian nghiệp vụ nhập bằng GIỜ VN → lưu true-UTC (chuẩn Asia/Ho_Chi_Minh, xem
// src/lib/timezone.ts). `vnts("2026-08-20T08:00:00")` = 08:00 VN → 01:00Z.
const vnts = (isoVn: string) => parseVnLocal(isoVn.replace(/(\.\d+)?Z$/i, ""));

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
  const svcFacial = await prisma.service.upsert({
    where: { code: "DV-FACIAL-01" }, update: {},
    create: { code: "DV-FACIAL-01", name: "Facial làm sạch sâu", categoryId: catFacial.id, durationMinutes: 60, standardPrice: 900_000, expectedCost: 300_000 },
  });

  // === Redesign P1 · SOP chuẩn hóa: DMK Enzyme Treatment (5 bước · sản phẩm/định mức · công nghệ · phương án) ===
  const brDMK = await prisma.brand.upsert({ where: { code: "BR-DMK" }, update: {}, create: { code: "BR-DMK", name: "DMK", description: "Danné Montague-King — enzyme therapy (Úc/Mỹ)" } });
  const techLED = await prisma.technology.upsert({
    where: { code: "CN-LED" }, update: {},
    create: { code: "CN-LED", name: "Ánh sáng LED sinh học", group: "LED", deviceModel: "Bio-LED", area: "Mặt", durationMinutes: 10, indications: "Kháng viêm, phục hồi", contraindications: "Nhạy sáng" },
  });

  // === Danh mục CÔNG NGHỆ CAO của phòng dịch vụ (theo thiết bị khách khai) ===
  const hiTechs: { code: string; name: string; group: string; area?: string; indications?: string; contraindications?: string; deviceModel?: string }[] = [
    { code: "CN-INSHAPE", name: "Inshape (EMS + RF) — Body & vùng chậu", group: "EMS + RF", area: "Body, vùng chậu, cơ sàn chậu / vùng kín nữ", indications: "Săn cơ, giảm mỡ, phục hồi cơ sàn chậu, se khít vùng kín", contraindications: "Thai kỳ, cấy ghép kim loại/điện tử, đang hành kinh (vùng chậu)" },
    { code: "CN-WINNAGE", name: "Winnage for Face (EMS + RF)", group: "EMS + RF", area: "Mặt: má (cheek), mắt (eye), nọng cằm (double chin), trán (forehead)", indications: "Nâng cơ mặt, giảm nọng, săn chắc vùng mắt/trán", contraindications: "Thai kỳ, cấy ghép kim loại vùng mặt" },
    { code: "CN-RF-ENDO", name: "RF nội mô (Endo RF)", group: "RF", area: "Mặt & Body", indications: "Làm săn chắc, trẻ hóa nội mô, cải thiện chảy xệ", contraindications: "Thai kỳ, cấy ghép kim loại" },
    { code: "CN-TISSUE-REPAIR", name: "Chăm sóc vùng mô tổn thương", group: "Phục hồi mô", area: "Vùng da/mô tổn thương", indications: "Hỗ trợ phục hồi mô tổn thương, làm lành" },
    { code: "CN-LYMPH", name: "Chăm sóc bạch huyết", group: "Dẫn lưu bạch huyết", area: "Mặt & Body", indications: "Dẫn lưu bạch huyết, giảm phù, thải độc, thư giãn" },
    { code: "CN-COLD-PLASMA", name: "Plasma lạnh chăm sóc vết thương", group: "Plasma", area: "Vùng vết thương", indications: "Kháng khuẩn, hỗ trợ lành vết thương", contraindications: "Theo chỉ định chuyên môn" },
    { code: "CN-PHOTOCOAG", name: "Quang đông chăm sóc body", group: "Quang đông", area: "Body", indications: "Chăm sóc body bằng công nghệ quang đông" },
    { code: "CN-JETPEEL", name: "JetPeel (áp lực) — Tóc / Face / Body", group: "JetPeel", area: "Tóc, Mặt, Body", indications: "Làm sạch, đưa dưỡng chất bằng áp lực; chăm sóc tóc/da/body" },
    { code: "CN-CELLINAS", name: "RF vi điểm CellinaS", group: "RF vi điểm (Fractional RF)", deviceModel: "CellinaS", area: "Mặt & Body", indications: "Trẻ hóa, se khít lỗ chân lông, sẹo rỗ, tái tạo bằng RF vi điểm", contraindications: "Thai kỳ, da đang viêm nhiễm cấp" },
    { code: "CN-FINEBEAM", name: "Laser Finebeam", group: "Laser", deviceModel: "Finebeam", area: "Mặt & Body", indications: "Điều trị sắc tố/trẻ hóa theo chỉ định laser" },
    { code: "CN-ADVATX", name: "Laser Advatx", group: "Laser", deviceModel: "AdvaTx", area: "Mặt & Body", indications: "Mạch máu, đỏ da, sắc tố, trẻ hóa (laser vàng/hồng ngoại)" },
    { code: "CN-FORMA-LIGHT", name: "LPS Forma Light (đầu HR / AC / SR / Dr. Platon)", group: "IPL / LPS", deviceModel: "Forma Light", area: "Mặt & Body", indications: "Đa năng theo đầu tip: HR (triệt lông), AC (mụn), SR (trẻ hóa da), Dr. Platon" },
    { code: "CN-CO2", name: "Laser CO2 (Fractional CO2)", group: "Laser", deviceModel: "CO2", area: "Mặt & Body", indications: "Tái tạo bề mặt, sẹo rỗ, nốt ruồi/mụn thịt, trẻ hóa", contraindications: "Thai kỳ, da đang nhiễm trùng, sẹo lồi" },
  ];
  for (const t of hiTechs) {
    await prisma.technology.upsert({ where: { code: t.code }, update: {}, create: { code: t.code, name: t.name, group: t.group, area: t.area ?? null, indications: t.indications ?? null, contraindications: t.contraindications ?? null, deviceModel: t.deviceModel ?? null } });
  }
  console.log(`   Công nghệ cao phòng dịch vụ: ${hiTechs.length} công nghệ (Inshape/Winnage/RF nội mô/JetPeel/CellinaS/Finebeam/Advatx/Forma Light/CO2…).`);

  // ② Bảng đơn giá NHÂN SỰ theo vai trò (dùng cho chi phí nhân sự trong Giá vốn dịch vụ).
  const roleRates: { code: string; roleName: string; certified: boolean; baseFee: number; bonus: number; tips: number; commission: number; commissionPercent?: number }[] = [
    { code: "VR-000001", roleName: "Kỹ thuật viên", certified: true, baseFee: 250_000, bonus: 50_000, tips: 30_000, commission: 0, commissionPercent: 0 },
    { code: "VR-000002", roleName: "Kỹ thuật viên", certified: false, baseFee: 150_000, bonus: 20_000, tips: 20_000, commission: 0 },
    { code: "VR-000003", roleName: "Master", certified: true, baseFee: 500_000, bonus: 100_000, tips: 50_000, commission: 0 },
    { code: "VR-000004", roleName: "Bác sĩ", certified: true, baseFee: 800_000, bonus: 150_000, tips: 0, commission: 0 },
    { code: "VR-000005", roleName: "Sales CV", certified: false, baseFee: 100_000, bonus: 0, tips: 0, commission: 200_000, commissionPercent: 5 },
    { code: "VR-000006", roleName: "Sales NV", certified: false, baseFee: 80_000, bonus: 0, tips: 0, commission: 120_000, commissionPercent: 3 },
    // Tour fee (phí tour theo dịch vụ) — theo bảng lương THNG: có CC 30k, không CC 10k.
    { code: "VR-000007", roleName: "Tour fee (dịch vụ)", certified: true, baseFee: 30_000, bonus: 0, tips: 0, commission: 0 },
    { code: "VR-000008", roleName: "Tour fee (dịch vụ)", certified: false, baseFee: 10_000, bonus: 0, tips: 0, commission: 0 },
    // Dịch vụ nhẹ (gội đầu / nail / chiếu đèn…) — tour fee cố định 10k.
    { code: "VR-000009", roleName: "Gội đầu / Nail", certified: false, baseFee: 10_000, bonus: 0, tips: 0, commission: 0 },
  ];
  for (const r of roleRates) {
    await prisma.staffRoleRate.upsert({
      where: { code: r.code },
      update: { baseFee: r.baseFee, bonus: r.bonus, tips: r.tips, commission: r.commission, commissionPercent: r.commissionPercent ?? null },
      create: { code: r.code, roleName: r.roleName, certified: r.certified, baseFee: r.baseFee, bonus: r.bonus, tips: r.tips, commission: r.commission, commissionPercent: r.commissionPercent ?? null },
    });
  }
  console.log(`   Đơn giá nhân sự theo vai trò: ${roleRates.length} vai trò (KTV có/chưa CC · Master · Bác sĩ · Sales CV/NV) — dùng cho chi phí nhân sự Giá vốn.`);
  const spDmkCleanser = await prisma.spaProduct.upsert({ where: { sku: "SP-DMK-CLEANSER" }, update: {}, create: { sku: "SP-DMK-CLEANSER", name: "DMK Deep Pore Cleanser", brandId: brDMK.id, category: "Làm sạch", productType: "PROFESSIONAL", sellingPrice: 0, cost: 100_000 } });
  const spDmkEnzyme1 = await prisma.spaProduct.upsert({ where: { sku: "SP-DMK-ENZ1" }, update: {}, create: { sku: "SP-DMK-ENZ1", name: "DMK Enzyme Masque #1", brandId: brDMK.id, category: "Enzyme", productType: "PROFESSIONAL", sellingPrice: 0, cost: 200_000 } });
  const spDmkEnzyme2 = await prisma.spaProduct.upsert({ where: { sku: "SP-DMK-ENZ2" }, update: {}, create: { sku: "SP-DMK-ENZ2", name: "DMK Enzyme Masque #2", brandId: brDMK.id, category: "Enzyme", productType: "PROFESSIONAL", sellingPrice: 0, cost: 250_000 } });
  const spDmkMist = await prisma.spaProduct.upsert({ where: { sku: "SP-DMK-MIST" }, update: {}, create: { sku: "SP-DMK-MIST", name: "DMK Herb & Mineral Mist", brandId: brDMK.id, category: "Toner", productType: "PROFESSIONAL", sellingPrice: 0, cost: 60_000 } });

  // === Thông tin chi tiết sản phẩm DMK (theo tài liệu đào tạo khách gửi) ===
  const dmkProducts = [
    { sku: "SP-DMK-SEBUM", name: "DMK Sebum Soak", category: "Làm sạch chuyên sâu", volume: "60ml",
      ingredients: "Isopentyldiol (kéo hoạt chất bề mặt xoáy sâu vào nang lông/tuyến dầu); Hoa cỏ ba lá đỏ (giải phóng dầu ứ đọng, kiềm dầu, thu nhỏ lỗ chân lông); Yucca, saponin (làm sạch sâu, kháng khuẩn); Dầu vỏ chanh vàng (kháng khuẩn, khử trùng, làm se, giảm viêm, bong sừng nhẹ). Tính kiềm nhẹ pH 8-9.",
      benefits: "Sạch bít tắc, dễ lấy mụn, tăng thẩm thấu; làm mềm nang lông, làm loãng dầu, tạo kênh dẫn đẩy sâu hoạt chất. Không phải tẩy trang/tẩy da chết; sạch hơn BHA nhưng không làm da khô/đỏ/rát; dùng được cho da yếu.",
      suitableFor: "Tất cả KH buổi đầu tiên (dù da không quá nhiều dầu). Từ buổi 2: da còn nhiều dầu thì tiếp tục làm, da ít dầu có thể bỏ qua.",
      contraindications: "Da mẫn cảm nhiều; da quá khô mất nước thì để buổi 2 mới làm (da khô mẫn ít vẫn làm được).",
      usage: "Chuyên nghiệp (tại spa): rửa mặt → trộn 1ml Sebum Soak + 1ml Aqua d'herb, ủ nilon + khăn ấm 3-5 phút (có thể 6-8 phút tùy độ bã nhờn) → lau bớt sản phẩm, lấy mụn → lau sạch, sát khuẩn. Định lượng bán chiết: 5ml Sebum Soak + 5ml Aqua d'herb.",
      frequency: "Tại nhà: 1ml Sebum Soak + 1ml Aqua d'herb, thoa như kem dưỡng, để 5 phút (KHÔNG ủ nóng), rửa sạch nước ấm — 1-2 lần/tuần (da phải đủ ẩm để tránh kích ứng/viêm)." },
    { sku: "SP-DMK-EPITOXYL", name: "DMK Epitoxyl (Skin Cleansing Tonic)", category: "Tiêu độc da", volume: "60ml",
      ingredients: "Tảo bẹ giàu khoáng chất và kali (chống viêm, cầm máu); Muối biển tiêu độc bề mặt, hút độc tố & tạp chất từ tầng sâu lên bề mặt; Kali sulfua biến độc tố & tạp chất thành dạng khí bay hơi khỏi da.",
      benefits: "Tiêu độc dạng nam châm lỏng hút độc tố, cặn mỹ phẩm và tạp chất lên bề mặt da. Chỉ 3 phút trả lại làn da sạch sâu, thông thoáng; an toàn với da dễ phản ứng; dùng định kỳ giúp nền da tươi sáng, giàu sức sống, dễ hấp thu dinh dưỡng.",
      suitableFor: "1-2 lần/tuần cho mọi loại da, đặc biệt: da mụn bít tắc; thường xuyên phải trang điểm; thường xuyên tiếp xúc không khí ô nhiễm, khói bụi; hút thuốc, rượu bia, sử dụng nhiều loại thuốc.",
      usage: "Chuyên nghiệp: 1ml Epitoxyl ra bông tẩy trang, lau đều mặt/cổ/ức (tránh vùng dưới mắt), để 3-5 phút (có thể xông hơi) rồi lau sạch. Trong quy trình: sau Sebum Soak & lấy mụn → lau Epitoxyl → peel.", frequency: "Tại nhà: sau rửa mặt/tẩy da chết, lau Epitoxyl rồi làm tiếp các bước dưỡng — 1-2 lần/tuần." },
    { sku: "SP-DMK-PROZYME", name: "DMK Prozyme (Exfoliating Enzyme Powder)", category: "Trị liệu bề mặt (enzyme)",
      ingredients: "Kaolin (đất sét trắng: Kẽm kháng viêm, Silic nhôm liền sẹo & sát khuẩn, silica kiềm dầu, canxi tạo lớp biểu bì); Papain (từ đu đủ) & Bromelain (từ dứa) — enzyme phân giải protein thành peptide & axit amin. KHÔNG chứa axit (BHA).",
      benefits: "Da nhiều dầu bít tắc (có mụn hoặc không): làm da sạch, ráo, bớt mụn, se khít lỗ chân lông. Sạch tương đương BHA nhưng: không khô, không đỏ rát, không bong, không kích ứng, không đổ ngược dầu.",
      suitableFor: "Da nhiều dầu (dù có mụn hay không) làm luôn buổi đầu; da nhiều dầu mà mỏng yếu mẫn cảm; mụn kích ứng do cort/rượu thuốc; da lão hóa/nám lì khó hấp thu & chuyển hóa; da nam giới. Cứ da có nhiều dầu thì dùng Prozyme.",
      contraindications: "Da khô thiếu dầu.",
      usage: "Chuyên nghiệp (product monograph): 2gr bột Prozyme pha 4ml Aqua d'herb, quét lên da rồi ủ nóng 15-25 phút tùy độ sừng, sau đó quét Enzyme 1 pha Exoderma Peel để dọn nốt phần sừng còn lại. Điều kiện sử dụng: enzyme papain/bromelain chỉ hoạt động khi ĐỦ ẨM và ĐỦ NHIỆT — bắt buộc ủ nóng đúng/đủ (khăn/bộ ủ nóng nhất trong mức chịu được + xông hơi + thay khăn liên tục); nếu không đạt hiệu quả cần kiểm tra lại bước ủ nóng. (Lưu ý: khung 15-25 phút là của product monograph, KHÔNG gộp với timing của protocol Acne Body.)" },
    { sku: "SP-DMK-CRYO", name: "DMK Cryo Pro-X (Exfoliating Cold Gel)", category: "Peel lạnh", volume: "120ml",
      benefits: "Peel lạnh: thư giãn da, giảm đỏ, giảm viêm, giảm kích ứng; hạn chế tác dụng phụ của axit (nóng, đỏ, rát, châm chích). Hạ nhiệt da kích thích cơ chế tự cân bằng nhiệt (đẩy tuần hoàn đưa máu lên mô da) → da phục hồi nhanh, hồng hào, căng, giàu sức sống, đều màu, xử lý quầng thâm. Đặc điểm: không nóng đỏ, không bong tróc, không đau rát, không tăng sắc tố.",
      suitableFor: "Các tình trạng da viêm, đỏ nóng, dễ phản ứng, mụn, trứng cá đỏ; da trì trệ tuần hoàn kém, bọng mắt, nọng cằm; lão hóa & chùng nhão, mao mạch, giãn mao mạch, nhăn chằng chéo." },
    { sku: "SP-DMK-QUICKPEEL", name: "DMK Quick Peel (Exfoliating Cleansing Gel)", category: "Peel nóng (hồi sinh da)", volume: "120ml",
      ingredients: "Vanillyl butyl ether (tạo hiệu ứng nhiệt giả); Dầu quế; Kojic dipalmitate (ức chế tế bào sắc tố); Beta-Carotene (điều chỉnh thay mới tế bào, giúp da tươi trẻ, mềm mướt).",
      benefits: "Hồi sinh da tái xỉn: bơm nguồn máu tươi mới, đả thông các mao mạch nhỏ li ti, đào thải độc tố & viêm nhiễm; ức chế sản sinh melanin, ngăn ngừa sẹo thâm sau mụn & sưng viêm; loại bỏ nhẹ da chết & bức bí, giúp da mềm mịn, sạch hơn, đáp ứng sản phẩm tốt hơn.",
      suitableFor: "Da tái xanh ánh vàng; da xỉn màu không sức sống; sắc thái không đồng đều (chỗ sáng chỗ tối); da miễn dịch yếu, có mao mạch; da trứng cá đỏ; da nhiều vết thâm; mụn sưng tấy nhẹ, mụn đỏ thâm sẹo.",
      contraindications: "Da mỏng yếu, dễ đỏ.",
      usage: "Chuyên nghiệp: tổng thời gian tiếp xúc 3-5 phút; tinh chỉnh theo phản ứng da (không cố định thành một mốc phút duy nhất)." },
    { sku: "SP-DMK-PROALPHA1", name: "DMK Pro Alpha #1 (Peel Serum)", category: "Peel AHA", volume: "60ml",
      ingredients: "pH 2.8, nồng độ 15%. AHAs kết hợp: Glycolic (bong sừng, sáng mịn da), Lactic & Malic (thúc đẩy thay mới tế bào, hút nước giúp da căng mọng), Citric (dưỡng ẩm, làm sáng). Kết hợp với Super Bright, Pro Alpha 2 thành hàng chục công thức trẻ hóa/sắc tố.",
      benefits: "Công thức AHA tiên tiến: (1) bong rụng sừng, da tươi sáng mềm mại; (2) hút nước lên bề mặt, căng mọng, giảm nhăn; (3) làm sáng, thúc đẩy thay mới tế bào. Giảm sừng, mịn mượt da, xóa nhăn cho da ít dầu.",
      contraindications: "Da quá nhiều dầu.",
      usage: "Chuyên nghiệp — dùng độc lập (da dày sừng, khỏe): 2 ml, ủ nóng (warm occlusion) 5-8 phút. Khi pha Bihaku (1ml Pro Alpha 1 + 1ml Super Bright) để giảm nồng độ axit cho da sừng vừa phải (peel nhẹ như tẩy da chết, axit 5-8%). Bihaku 1 ngày (giảm sừng, tươi mới, căng mọng), 7 ngày (làm sáng, trị nám 20-30% bề mặt), 12 ngày (dày khỏe, chấp nhận bong 20-30% tùy đáp ứng của KH). KH bắt buộc dùng tại nhà tối thiểu: Beta Gel, Melanotech Drops, Super Bright." },
    { sku: "SP-DMK-PROALPHA2", name: "DMK Pro Alpha #2 (Booster Serum)", category: "Boosting serum sắc tố", volume: "60ml",
      ingredients: "Công thức kết hợp glycolic acid, lactic acid và salicylic acid.",
      benefits: "Boosting serum bẻ gãy mọi liên kết sắc tố: (1) bẻ gãy liên kết giữa các tế bào sắc tố; (2) tối ưu hóa tái tạo tế bào. Nhờ đó Pro Alpha 2 tối đa hiệu quả thay mới làn da theo cấp số nhân." },
    { sku: "SP-DMK-SUPERBRIGHT", name: "DMK Super Bright (Skin Brightening Creme)", category: "Làm sáng / sắc tố", volume: "60ml",
      ingredients: "Bearberry (làm se, thu nhỏ lỗ chân lông); Chiết xuất rễ cam thảo (ức chế melanin, làm sáng mô, chống oxy hóa, giữ ẩm); Ursolic acid (ngăn hình thành hắc sắc tố); Phytic acid (chống oxy hóa, vô hiệu hóa tyrosine); Retinyl palmitate (chống oxy hóa, bong da chết); Kojic Acid; Magnesium ascorbyl phosphate (Vitamin C); Mulberry; Mitracarpus Scaber Extract (harounocide).",
      benefits: "Sản phẩm làm sáng cao cấp, công nghệ nghịch chuyển đột phá. Hiệu quả như hydroquinone nhưng KHÔNG chứa Hydroquinone: tác động lớp thượng bì, làm trắng sáng, loại bỏ & ức chế tăng sinh hắc sắc tố mà không có tác dụng phụ nguy hiểm.",
      suitableFor: "Nám; sáng đều màu da toàn mặt." },
    { sku: "SP-DMK-ALKALINE", name: "DMK Alkaline Wash", category: "Tẩy sừng kiềm mạnh", volume: "180ml", type: "PROFESSIONAL",
      benefits: "Dung dịch kiềm cao (pH cao) hòa tan lớp sừng già cỗi, dầu thừa và lông tơ trên bề mặt; làm sạch sâu, thông thoáng nang lông, chuẩn bị nền da cho các bước peel/enzyme thẩm thấu tốt hơn.",
      suitableFor: "Da dày sừng, nhiều dầu bít tắc, lỗ chân lông to; hỗ trợ giảm lông tơ. Thao tác chuyên môn tại spa, kiểm soát thời gian chặt chẽ.",
      contraindications: "Da mỏng yếu, đang kích ứng/viêm nặng; không tự dùng tại nhà." },
    { sku: "SP-DMK-PORERED", name: "DMK Pore Reduction", category: "Se khít lỗ chân lông", volume: "30ml", type: "BOTH",
      benefits: "Giảm viêm và thu nhỏ lỗ chân lông (theo tài liệu DMK). Kiềm dầu, làm mịn bề mặt và cải thiện kết cấu da.",
      suitableFor: "Da dầu, lỗ chân lông to, da sần sùi kém mịn.",
      usage: "Chuyên nghiệp — bôi giảm viêm & ức chế sắc tố sau điều trị bề mặt: 7 giọt. Trong ủ siêu dưỡng: 0.4ml (7 giọt)." },
    { sku: "SP-DMK-MELANOTECH", name: "DMK Melanotech Drops", category: "Trị nám / sắc tố", volume: "30ml", type: "BOTH",
      benefits: "Ức chế tăng sắc tố tầng sâu (theo tài liệu DMK). Hỗ trợ làm mờ tăng sắc tố, đều màu da; phối hợp trong liệu trình làm sáng/trị nám.",
      suitableFor: "Nám, tàn nhang, thâm sau mụn, da không đều màu.",
      usage: "Chuyên nghiệp — bôi ức chế sắc tố: 7 giọt. Trong ủ siêu dưỡng: 0.4ml (7 giọt)." },
    { sku: "SP-DMK-ENBIOMENT", name: "DMK Enbioment Serum", category: "Cân bằng hệ vi sinh da", volume: "30ml", type: "BOTH",
      benefits: "Khôi phục sự đa dạng và cân bằng của hệ vi sinh (microbiome) trên da (theo tài liệu DMK); củng cố hàng rào bảo vệ, giảm nhạy cảm.",
      suitableFor: "Da yếu, mất cân bằng, dễ kích ứng, da sau liệu trình xâm lấn.",
      usage: "Chuyên nghiệp — trong ủ siêu dưỡng: 1ml." },
    { sku: "SP-DMK-BETAGEL", name: "DMK Beta Gel", category: "Phục hồi / kháng viêm", volume: "30ml", type: "BOTH",
      benefits: "Phục hồi da hư tổn, sửa chữa hệ miễn dịch của da (theo tài liệu DMK). Chứa Beta-glucan: làm dịu, kháng viêm, cấp ẩm và làm dịu mẩn đỏ. Có cả ngữ cảnh dùng trong dịch vụ (phục hồi/recovery) lẫn tại nhà — KHÔNG chỉ là chăm sóc tại nhà.",
      suitableFor: "Da mụn viêm, da đỏ kích ứng, da sau peel/laser.",
      usage: "Chuyên nghiệp (ủ siêu dưỡng / recovery sau trị liệu): 1ml. Tại nhà (phục hồi): bôi 3-4 lần/ngày, giai đoạn phục hồi tích cực 4 lần/ngày." },
    { sku: "SP-DMK-FIBROMAXC", name: "DMK FibroMax C", category: "Vitamin C / săn chắc", volume: "30ml", type: "HOME_CARE",
      benefits: "Phức hợp Vitamin C và dưỡng chất hỗ trợ tổng hợp collagen, chống oxy hóa, làm sáng và tăng độ săn chắc, đàn hồi cho da.",
      suitableFor: "Da lão hóa, chùng nhão, xỉn màu, thiếu sức sống." },
    { sku: "SP-DMK-HMMIST-HC", name: "DMK Herb & Mineral Mist (Home-care)", category: "Xịt khoáng cân bằng", volume: "240ml", type: "HOME_CARE",
      benefits: "Xịt khoáng đẩy sâu tinh chất và tái thiết lập màng axit (theo tài liệu DMK); cấp ẩm tức thì, làm dịu, tăng thẩm thấu dưỡng chất ở bước sau.",
      suitableFor: "Mọi loại da; dùng sau làm sạch và trước/giữa các bước dưỡng.",
      usage: "Ủ siêu dưỡng: 0.5ml (6 lần xịt). Chăm sóc sau: cấp ẩm 3 lần/ngày." },
    { sku: "SP-DMK-SEBAE", name: "DMK Seba-E", category: "Dầu Vitamin E phục hồi", volume: "15ml", type: "HOME_CARE",
      benefits: "Dầu Vitamin E cô đặc: dưỡng ẩm sâu, chống oxy hóa, làm mềm và hỗ trợ làm mờ sẹo, vết rạn; làm dịu vùng da khô căng.",
      suitableFor: "Da khô, thiếu ẩm, sẹo, vùng da bong tróc; dùng khu trú.",
      usage: "Chấm lượng nhỏ lên vùng sẹo/khô, massage nhẹ." },
    { sku: "SP-DMK-HERBALPIG", name: "DMK Herbal Pigment Oil", category: "Dầu thảo mộc sắc tố", volume: "15ml", type: "PROFESSIONAL",
      benefits: "Dầu thảo mộc hỗ trợ liệu trình xử lý sắc tố, nuôi dưỡng và làm dịu da trong/sau bước trị nám.",
      suitableFor: "Da nám, tăng sắc tố; dùng trong liệu trình chuyên môn." },
    { sku: "SP-DMK-CONTRADERM", name: "DMK Contra-Derm", category: "Làm dịu da nhạy cảm", volume: "30ml", type: "HOME_CARE",
      benefits: "Làm dịu, giảm đỏ và giảm phản ứng cho da nhạy cảm, dễ kích ứng; củng cố khả năng chịu đựng của da.",
      suitableFor: "Da nhạy cảm, trứng cá đỏ (rosacea), da phản ứng, giãn mao mạch." },
    { sku: "SP-DMK-SOLAR", name: "DMK Solar Damage", category: "Phục hồi da tổn thương do nắng", volume: "30ml", type: "HOME_CARE",
      benefits: "Hỗ trợ phục hồi da tổn thương do ánh nắng: làm dịu, chống oxy hóa và cải thiện các dấu hiệu lão hóa quang học (sạm, khô, nhăn do nắng).",
      suitableFor: "Da sạm nắng, lão hóa do ánh nắng, khô ráp." },
    { sku: "SP-DMK-ACTROL", name: "DMK Actrol Powder", category: "Bột khóa viêm", volume: "10g", type: "BOTH",
      benefits: "Bột khóa viêm: hỗ trợ hút dịch viêm, hút dầu thừa và tạo lớp màng bảo vệ vật lý cho vùng điều trị.",
      suitableFor: "Da dầu, da mụn, vùng viêm/vùng nhiều dầu.",
      usage: "Chuyên nghiệp (bước kết thúc) & tại nhà: dùng chổi Enzyme khô phủ 1 lớp thật mỏng lên vùng điều trị hoặc vùng nhiều dầu." },
  ];
  for (const p of dmkProducts) {
    const data = { name: p.name, brandId: brDMK.id, category: p.category,
      productType: ((p as any).type ?? "PROFESSIONAL") as "PROFESSIONAL" | "HOME_CARE" | "BOTH",
      ingredients: (p as any).ingredients ?? null, benefits: p.benefits ?? null, suitableFor: p.suitableFor ?? null,
      contraindications: (p as any).contraindications ?? null, usage: (p as any).usage ?? null, frequency: (p as any).frequency ?? null, volume: p.volume ?? null };
    await prisma.spaProduct.upsert({ where: { sku: p.sku }, update: data, create: { sku: p.sku, ...data } });
  }
  console.log(`   Thông tin chi tiết ${dmkProducts.length} sản phẩm DMK (thành phần/công dụng/chỉ định/CCĐ/cách dùng/tần suất/dung tích).`);

  const svcDMK = await prisma.service.findUnique({ where: { code: "DV-DMK-ENZ" } });
  if (!svcDMK) {
    await prisma.service.create({
      data: {
        code: "DV-DMK-ENZ", name: "DMK Enzyme Treatment", categoryId: catFacial.id, status: "ACTIVE",
        durationMinutes: 83, standardPrice: 2_500_000, expectedCost: 700_000, version: 1,
        technologyIds: [techLED.id], defaultTechnologyId: techLED.id,
        staffRequirements: [{ role: "Kỹ thuật viên", quantity: 1, required: true }],
        steps: {
          create: [
            {
              sortOrder: 0, name: "Làm sạch da", durationMinutes: 10, technique: "Massage làm sạch 2 lần", isRequired: true,
              products: { create: [{ spaProductId: spDmkCleanser.id, name: "DMK Deep Pore Cleanser", quantity: 5, unit: "ml", isRequired: true, sortOrder: 0 }] },
            },
            {
              sortOrder: 1, name: "Detox (LED)", durationMinutes: 15, technique: "Chiếu LED sinh học kháng viêm", isRequired: true,
              technologies: { create: [{ technologyId: techLED.id, notes: "Bước sóng đỏ 630nm, 10–15 phút" }] },
            },
            {
              sortOrder: 2, name: "Build (xịt khoáng)", durationMinutes: 8, technique: "Xịt khoáng cân bằng ẩm", isRequired: true,
              products: { create: [{ spaProductId: spDmkMist.id, name: "DMK Herb & Mineral Mist", quantity: 3, unit: "ml", isRequired: true, sortOrder: 0 }] },
            },
            {
              sortOrder: 3, name: "Đắp Enzyme Masque", durationMinutes: 40, technique: "Đắp enzyme, giữ 40 phút (plasmatic effect)", isRequired: true,
              warnings: "Chống chỉ định: da đang viêm cấp, dị ứng enzyme. Không dùng cho phụ nữ có thai 3 tháng đầu.",
              conditionText: "Chọn loại enzyme theo tình trạng da",
              options: {
                create: [
                  { sortOrder: 0, name: "Enzyme #1 (da thường/nhạy cảm)", selectMode: "SINGLE_SELECT", isDefault: false, spaProductId: spDmkEnzyme1.id, quantity: 5, unit: "g", durationMinutes: 40 },
                  { sortOrder: 1, name: "Enzyme #2 (da dày/nhiều dầu)", selectMode: "SINGLE_SELECT", isDefault: true, spaProductId: spDmkEnzyme2.id, quantity: 5, unit: "g", durationMinutes: 40 },
                  { sortOrder: 2, name: "Không đắp enzyme (da quá nhạy cảm)", selectMode: "OPTIONAL", isDefault: false, conditionText: "Bỏ qua khi da phản ứng" },
                ],
              },
            },
            {
              sortOrder: 4, name: "Phục hồi & bảo vệ", durationMinutes: 10, technique: "Thoa serum phục hồi + kem chống nắng", isRequired: true,
              products: { create: [{ name: "Serum phục hồi + kem chống nắng", quantity: 2, unit: "ml", isRequired: false, sortOrder: 0 }] },
            },
          ],
        },
      } as any,
    });
  }

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
  const protoDemo = await prisma.brandProtocol.upsert({
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
  // Protocol thứ 2 (đóng vai "Protocol B") để minh họa Kế hoạch vs Thực tế khi buổi đổi protocol.
  const protoLift = await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DEMO-LIFT" }, update: {},
    create: {
      code: "PROTO-DEMO-LIFT",
      name: "DEMO — Quy trình nâng cơ HIFU (minh họa)",
      kind: "INTERNAL", status: "ACTIVE", version: 1,
      purpose: "DỮ LIỆU DEMO minh họa protocol thay thế khi buổi thực tế khác kế hoạch.",
      steps: { items: [{ name: "Đánh dấu vùng", durationMinutes: 10 }, { name: "Bắn HIFU theo line", durationMinutes: 40 }, { name: "Làm dịu & dặn dò", durationMinutes: 10 }] },
      durationMinutes: 60, recommendedFreq: "1 tháng/lần", recommendedCount: 3,
      createdBy: "Phạm Chuyên Viên",
    },
  });

  // === Protocol DMK theo BƯỚC (đúng bảng trị liệu DMK: Bước · Tên trị liệu · Mục đích) ===
  // Nguồn: bảng "Hệ thống trị liệu" DMK do khách hàng cung cấp. Lưu steps.items = {group,name,purpose}.
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-ACNE" }, update: {},
    create: {
      code: "PROTO-DMK-ACNE", name: "DMK — Hệ thống trị liệu cho da mụn", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Trị liệu da mụn theo hệ thống DMK (chọn 1 trị liệu bề mặt phù hợp tình trạng).",
      steps: { items: [
        { group: "Detox", name: "Sebum Soak, Epitoxyl", purpose: "Tan dầu, tăng thấm hút chuyển hóa" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Prozyme", purpose: "Da nhiều dầu, dày sừng, viêm" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Cryo Pro-X", purpose: "Mụn trên nền da yếu, mụn loạn khuẩn; da bớt sừng dầu, bít tắc, cần thải độc, phục hồi cấu trúc; mụn viêm, mụn nội tiết, sẹo đỏ trên nền da yếu" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Quick Peel + Cryo Pro-X", purpose: "Mụn nội tiết, mụn cục chưa có đầu" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Alkaline Wash", purpose: "Xử lý nhiều vấn đề sừng – mụn viêm – mụn chai xơ – sẹo" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Desquamate", purpose: "Giảm sừng hiệu quả và an toàn cho da mẫn cảm hoặc sau Alkaline Wash" },
        { group: "Trị liệu bề mặt (chọn 1)", name: "Actrol Powder", purpose: "" },
        { group: "Phục hồi", name: "Enzyme (pha Aqua hoặc Exoderma) — Enzyme 1,2,3", purpose: "Giảm sưng nề; nhanh lành thương; phục hồi cấu trúc" },
        { group: "Tăng đề kháng / Khóa viêm", name: "Beta Gel, Solar Damage, Actrol Powder", purpose: "" },
      ] },
      recommendedFreq: "7–14 ngày/lần", createdBy: "Trần Quản Lý",
    },
  });
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-AGING" }, update: {},
    create: {
      code: "PROTO-DMK-AGING", name: "DMK — Hệ thống trị liệu lão hóa", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Trị liệu lão hóa theo hệ thống DMK (chọn trị liệu bề mặt theo tình trạng da).",
      steps: { items: [
        { group: "Detox", name: "Sebum Soak, Epitoxyl", purpose: "Mở kênh dẫn, tăng thấm hút chuyển hóa" },
        { group: "Trị liệu bề mặt", name: "Prozyme", purpose: "Da không làm sạch tốt, có dầu, bít tắc" },
        { group: "Trị liệu bề mặt", name: "Pro Alpha 1", purpose: "Da dày sừng, nhiều nếp nhăn nông" },
        { group: "Trị liệu bề mặt", name: "Bihaku 1 ngày (Pro Alpha 1 + Super Bright)", purpose: "Da sừng vừa, da cần làm tươi mới, giàu sức sống" },
        { group: "Trị liệu bề mặt", name: "Cryo Pro-X", purpose: "Da hơi mỏng, cần cải thiện sắc thái, chuyển hóa, đều màu, quầng thâm bọng mắt" },
        { group: "Trị liệu bề mặt", name: "Quick Peel", purpose: "Da khỏe ít sừng, tái xỉn, cần cải thiện sắc thái, chuyển hóa, đều màu, quầng thâm bọng mắt" },
        { group: "Trị liệu bề mặt", name: "Bihaku 7 ngày, 12 ngày", purpose: "Da khỏe cần cải thiện cả bề mặt và sắc tố" },
        { group: "Trị liệu bề mặt", name: "RP", purpose: "Nhăn sâu" },
        { group: "Phục hồi", name: "Enzyme 1", purpose: "Bề mặt, nhăn" },
        { group: "Phục hồi", name: "Enzyme 1,2,3", purpose: "Nhăn sâu, cơ, mao mạch" },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-PIGMENT" }, update: {},
    create: {
      code: "PROTO-DMK-PIGMENT", name: "DMK — Hệ thống trị liệu sắc tố", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Trị liệu sắc tố theo hệ thống DMK: loại bỏ → dày khỏe da/tăng đáp ứng → ức chế làm sáng → sửa chữa hàng rào bảo vệ.",
      steps: { items: [
        { group: "Loại bỏ", name: "Desquamate", purpose: "" },
        { group: "Loại bỏ", name: "Cryo Pro-X", purpose: "" },
        { group: "Loại bỏ", name: "Quick Peel", purpose: "" },
        { group: "Loại bỏ", name: "Bihaku", purpose: "" },
        { group: "Loại bỏ", name: "Alkaline Wash", purpose: "" },
        { group: "Dày khỏe da, tăng đáp ứng", name: "Enzyme 1", purpose: "Bình thường TB sắc tố" },
        { group: "Dày khỏe da, tăng đáp ứng", name: "Enzyme 1,2,3", purpose: "Dày khỏe da, giảm mỏng đỏ; thu nhỏ mao mạch" },
        { group: "Ức chế, làm sáng", name: "Melanotech Drops", purpose: "" },
        { group: "Ức chế, làm sáng", name: "Melanotech Crème", purpose: "" },
        { group: "Ức chế, làm sáng", name: "Super Bright", purpose: "" },
        { group: "Ức chế, làm sáng", name: "Direct Vitamin C Serum", purpose: "" },
        { group: "Ức chế, làm sáng", name: "FibroMax C", purpose: "" },
        { group: "Ức chế, làm sáng", name: "Revitosin", purpose: "" },
        { group: "Ức chế, làm sáng", name: "Revise A", purpose: "" },
        { group: "Sửa chữa hàng rào bảo vệ", name: "Bộ Enbioment", purpose: "Hàng rào vi sinh" },
        { group: "Sửa chữa hàng rào bảo vệ", name: "Dầu khoáng", purpose: "Hàng rào hóa học" },
        { group: "Sửa chữa hàng rào bảo vệ", name: "EFA Ultra", purpose: "Hàng rào vật lý" },
        { group: "Sửa chữa hàng rào bảo vệ", name: "Beta Gel", purpose: "Miễn dịch nội sinh" },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-BIHAKU" }, update: {},
    create: {
      code: "PROTO-DMK-BIHAKU", name: "DMK — Bihaku 7–14 ngày (lịch trình)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Lịch trình Bihaku tại spa + tại nhà (7–14 ngày). Bihaku 1 = 1ml Pro Alpha 1 + 1ml Super Bright.",
      steps: { items: [
        { group: "Ngày 1", name: "Tại spa: Sebum Soak → Enzyme 1 pha Desquamate → bôi Bihaku", purpose: "Chiết về nhà mỗi loại 3ml (Bihaku 1 = 1ml Pro Alpha 1 + 1ml Bright)" },
        { group: "Ngày 2,3,4", name: "Tại nhà: rửa mặt, 1 lớp mỏng Beta Gel → bôi hỗn hợp Bihaku", purpose: "Ngày 4 nếu da hồng nhiều, có bong thì có thể ngừng" },
        { group: "Ngày 5,6", name: "Dưỡng (sáng & tối)", purpose: "" },
        { group: "Ngày 7", name: "Tại spa: RM → Epitoxyl → Enzyme 1 pha Desquamate → bôi Bihaku", purpose: "Chiết về nhà mỗi loại 2ml" },
        { group: "Ngày 8,9", name: "Tại nhà: rửa mặt, 1 lớp mỏng Beta Gel → bôi hỗn hợp Bihaku", purpose: "" },
        { group: "Ngày 10,11", name: "Dưỡng (sáng & tối)", purpose: "" },
        { group: "Ngày 12–14", name: "Tại spa: RM → Epitoxyl → Enzyme 1 pha Desquamate → cấp dưỡng như bình thường", purpose: "" },
      ] },
      recommendedFreq: "Liệu trình 7–14 ngày", createdBy: "Trần Quản Lý",
    },
  });
  // Ma trận chọn trị liệu theo tình trạng da (Da nhiều dầu / Da ít dầu).
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-SKIN-MATRIX" }, update: {},
    create: {
      code: "PROTO-DMK-SKIN-MATRIX", name: "DMK — Chọn trị liệu theo tình trạng da (nhiều dầu / ít dầu)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Bảng quyết định chọn trị liệu theo tình trạng da (yếu → rất khỏe) và độ dầu (da nhiều dầu / da ít dầu).",
      steps: { items: [
        { group: "Yếu, mẫn cảm", name: "Da nhiều dầu", purpose: "Sebum Soak; Enzyme" },
        { group: "Yếu, mẫn cảm", name: "Da ít dầu", purpose: "Sebum Soak (cân nhắc); Enzyme pha Exoderma Peel" },
        { group: "Hơi yếu", name: "Da nhiều dầu", purpose: "Sebum Soak; Prozyme; Enzyme" },
        { group: "Hơi yếu", name: "Da ít dầu", purpose: "Thường đi kèm hơi đỏ, khô căng, mụn nội tiết, quầng thâm, da không đều màu — Sebum Soak bắt buộc; Cryo (peel lạnh); Enzyme" },
        { group: "Khỏe", name: "Da nhiều dầu", purpose: "Sebum Soak; Prozyme; Enzyme" },
        { group: "Khỏe", name: "Da ít dầu", purpose: "Sebum Soak 3 phút; dày sừng → Pro Alpha 1; sừng vừa phải → Bihaku 1 ngày; hầu như không sừng/quầng thâm/da tái xỉn vàng → Peel nóng Quick Peel → Enzyme pha Aqua d'herb" },
        { group: "Rất khỏe, dày sừng, mụn viêm, sẹo lõm", name: "Da nhiều dầu", purpose: "Alkaline Wash + Enzyme" },
        { group: "Rất khỏe, dày sừng, mụn viêm, sẹo lõm", name: "Da ít dầu", purpose: "Bihaku 7 ngày; Bihaku 12 ngày; Pro Alpha 1" },
      ] },
      recommendedFreq: "Tùy tình trạng da", createdBy: "Trần Quản Lý",
    },
  });
  // Kết thúc trị liệu — da khô ít dầu (sản phẩm kết thúc + cách dùng).
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-FINISH-DRY" }, update: {},
    create: {
      code: "PROTO-DMK-FINISH-DRY", name: "DMK — Kết thúc trị liệu (da khô ít dầu)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Quy trình sản phẩm kết thúc trị liệu cho da khô, ít dầu.",
      steps: { items: [
        { group: "Sản phẩm kết thúc", name: "Pore Reductions", purpose: "Giảm đỏ, giảm viêm, ngừa kích ứng, thu nhỏ lỗ chân lông — 2 giọt mỗi vùng, nhỏ đến đâu xoa luôn đến đó" },
        { group: "Sản phẩm kết thúc", name: "Melanotech Drops", purpose: "Chống tăng sinh sắc tố tầng sâu — 2 giọt mỗi vùng, nhỏ đến đâu xoa luôn đến đó" },
        { group: "Sản phẩm kết thúc", name: "Enbioment Serum", purpose: "Tái tạo hệ vi sinh, làm dịu da đỏ rát, mẫn cảm — 1ml toàn mặt, bôi nhiều hơn ở vùng khô đỏ rát" },
        { group: "Sản phẩm kết thúc", name: "Beta Gel", purpose: "Tăng cường miễn dịch nội sinh, phục hồi tổn thương — 1ml toàn mặt, bôi nhiều hơn ở vùng khô đỏ rát" },
        { group: "Sản phẩm kết thúc", name: "Herbal Pigment Oil", purpose: "Thay thế chất dầu tự nhiên trên bề mặt da cho da thiếu dầu — 3 giọt chấm đều toàn mặt" },
        { group: "Sản phẩm kết thúc", name: "Herb & Mineral Mist", purpose: "Xịt khoáng đẩy sâu tinh chất, tái thiết lập màng axit — xịt 5 xịt toàn mặt" },
        { group: "Sản phẩm kết thúc", name: "Solar Damage Gel", purpose: "Dưỡng ẩm và khóa ẩm tầng sâu — 1ml toàn mặt" },
        { group: "Sản phẩm kết thúc", name: "Soleil Defence SPF50+", purpose: "Bảo vệ da khỏi tia UVA và UVB" },
      ] },
      recommendedFreq: "Mỗi buổi", createdBy: "Trần Quản Lý",
    },
  });
  // Kết thúc dịch vụ — da dầu mụn (sản phẩm kết thúc + cách dùng).
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-FINISH-ACNE" }, update: {},
    create: {
      code: "PROTO-DMK-FINISH-ACNE", name: "DMK — Kết thúc dịch vụ (da dầu mụn)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Quy trình sản phẩm kết thúc dịch vụ cho da dầu mụn.",
      steps: { items: [
        { group: "Sản phẩm kết thúc", name: "Pore Reductions", purpose: "Giảm đỏ, giảm viêm, ngừa kích ứng, thu nhỏ lỗ chân lông — 2 giọt mỗi vùng, nhỏ đến đâu xoa luôn đến đó" },
        { group: "Sản phẩm kết thúc", name: "Melanotech", purpose: "Chống tăng sinh sắc tố tầng sâu — 2 giọt mỗi vùng, nhỏ đến đâu xoa luôn đến đó" },
        { group: "Sản phẩm kết thúc", name: "Beta Gel", purpose: "Tăng cường miễn dịch nội sinh, phục hồi tổn thương — 1ml toàn mặt, bôi nhiều hơn ở vùng viêm" },
        { group: "Sản phẩm kết thúc", name: "Herb & Mineral Mist", purpose: "Xịt khoáng đẩy sâu tinh chất, tái thiết lập màng axit — xịt 5 xịt toàn mặt" },
        { group: "Sản phẩm kết thúc", name: "Solar Damage Gel", purpose: "Dưỡng ẩm và khóa ẩm tầng sâu — 1ml toàn mặt" },
        { group: "Sản phẩm kết thúc", name: "Actrol Powder", purpose: "Tạo màng khóa viêm, hút dịch và dầu thừa — dùng chổi Enzyme khô để phủ 1 lớp thật mỏng toàn mặt" },
      ] },
      recommendedFreq: "Mỗi buổi", createdBy: "Trần Quản Lý",
    },
  });
  // --- Protocol tổ hợp Enzyme (từ ảnh đào tạo DMK đợt 3) ---
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-ALPHAZYME" }, update: {},
    create: {
      code: "PROTO-DMK-ALPHAZYME", name: "DMK — Alphazyme (Pro Alpha 1 + Prozyme)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Tổ hợp Pro Alpha 1 + Prozyme.", suitableFor: "Mụn ẩn, bít tắc, viêm; se khít lỗ chân lông (LCL); da dày sừng, thâm mụn.",
      steps: { items: [
        { group: "Tại nhà (ngày 2-6)", name: "Theo dõi phản ứng", purpose: "Da có thể đỏ, nóng rát sau 1-2 ngày trị liệu." },
        { group: "Tại nhà (ngày 2-6)", name: "Sau 3 ngày", purpose: "Home Enzyme hoặc Home Micro peel => Acu Masque / Hydrating Masque." },
        { group: "SP phục hồi", name: "EFA", purpose: "4 viên/ngày." },
        { group: "SP phục hồi", name: "Beta Gel", purpose: "Phục hồi da." },
        { group: "SP phục hồi", name: "Dầu Herbal + xịt Herb", purpose: "Bổ sung dầu, tái thiết lập màng axit." },
        { group: "SP phục hồi", name: "C serum hoặc bột", purpose: "Chống oxy hóa, làm sáng." },
        { group: "SP phục hồi", name: "Kem Dưỡng", purpose: "Cấp ẩm." },
        { group: "SP đặc trị mụn bít tắc", name: "Tối 1: Revitosin", purpose: "Đặc trị mụn bít tắc." },
        { group: "SP đặc trị mụn bít tắc", name: "Tối 2", purpose: "Dùng SP trị mụn như bình thường." },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-HYDRADERMAZE" }, update: {},
    create: {
      code: "PROTO-DMK-HYDRADERMAZE", name: "DMK — Hydradermaze (Prozyme + Pro Alpha 1)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Tổ hợp Prozyme + Pro Alpha 1.", suitableFor: "Mụn bít tắc sâu; lão hóa, nhăn sâu, tổn thương do nắng.",
      steps: { items: [
        { group: "Làm sạch", name: "Rửa mặt", purpose: "Không Sebum Soak. Dùng Epitoxyl." },
        { group: "Trị liệu", name: "Prozyme", purpose: "Ủ nóng 10-20 phút toàn mặt.", durationMinutes: 20 },
        { group: "Trị liệu", name: "Pro Alpha 1", purpose: "Pro Alpha 1 (5-8 phút) toàn mặt hoặc chỉ vùng bít tắc. Lấy mụn — chườm đá nếu cần.", durationMinutes: 8 },
        { group: "Trị liệu", name: "Enzyme 1 (Exo)", purpose: "Drops — Pore. Enzyme 1 (Aqua)." },
        { group: "Kết thúc dịch vụ", name: "Pore - Drops - Beta Gel", purpose: "Xịt Herb + Contra-Derm + Actrol." },
        { group: "Tại nhà", name: "Theo dõi phản ứng", purpose: "Da có thể đỏ, nóng rát sau 1-2 ngày trị liệu." },
        { group: "Tại nhà", name: "Sau 3 ngày", purpose: "Home Enzyme hoặc Home Micro peel => Acu Masque / Hydrating Masque." },
        { group: "SP phục hồi", name: "EFA (4 viên/ngày), Beta Gel, Dầu Herbal + xịt Herb, C serum/bột, Kem Dưỡng", purpose: "Bộ sản phẩm phục hồi tại nhà." },
        { group: "SP đặc trị mụn bít tắc", name: "Tối 1: Revitosin — Tối 2: SP trị mụn bình thường", purpose: "Luân phiên đặc trị mụn bít tắc." },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  // --- Alkaline Wash: quy trình điều trị vùng MẶT (8 bước) + lưu ý thao tác + chăm sóc sau ---
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-ALKALINE-FACE" }, update: {},
    create: {
      code: "PROTO-DMK-ALKALINE-FACE", name: "DMK — Alkaline Wash (quy trình điều trị vùng Mặt)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Quy trình điều trị Alkaline Wash toàn mặt hoặc theo vùng.",
      contraindications: "Bắt buộc đeo găng tay khi làm dịch vụ; dùng chổi quét nhanh tay; chia nhỏ các vùng để điều trị.",
      steps: { items: [
        { group: "Bước 1 — Làm sạch", name: "Tẩy trang, rửa mặt (Deep Pore)", purpose: "Nếu TRIỆT LÔNG thì bỏ qua bước rửa mặt." },
        { group: "Bước 2 — Chuẩn bị", name: "Quét Exoderma Peel", purpose: "Bảo vệ lông mày, chân tóc." },
        { group: "Bước 3 — Điều trị", name: "Quét hỗn hợp Alkaline Wash", purpose: "Đeo găng. Quét lên từng vùng da." },
        { group: "Bước 4 — Trung hòa", name: "Lau Alkaline Wash", purpose: "Trung hòa ngay bằng Exo." },
        { group: "Bước 5 — Điều trị", name: "Tiếp tục các vùng còn lại", purpose: "Làm Alkaline Wash & trung hòa cho các vùng còn lại. Lau sạch. Lấy mụn." },
        { group: "Bước 6 — Chườm đá", name: "Chườm đá 1-2 phút", purpose: "Không lau Exoderma Peel.", durationMinutes: 2 },
        { group: "Bước 7 — Phục hồi", name: "Pore Reduction, Melanotech Drops, Actrol Powder, Enzyme 1 (Exo)", purpose: "Thoa Pore Reduction, Melanotech Drops; phủ Actrol Powder mỏng toàn mặt; đắp Enzyme 1 (Exo); lau sạch." },
        { group: "Bước 8 — Bảo vệ", name: "Kết thúc trị liệu", purpose: "Pore Reduction, Melanotech Drops, Beta Gel, Actrol Powder." },
        { group: "Lưu ý thao tác", name: "Mụn loạn khuẩn — 1 phút", purpose: "Căn đúng thời gian loại bỏ. Không thao tác trên da; một số điểm mụn viêm có thể tự mở hoặc rỉ dịch." },
        { group: "Lưu ý thao tác", name: "Mụn viêm & sẹo đỏ — 2 phút", purpose: "Căn đúng thời gian loại bỏ. Không thao tác trên da; sau khi loại bỏ Kiềm da chỉ sáng hơn, không hồng, chậm chích." },
        { group: "Lưu ý thao tác", name: "Nám — 1 phút", purpose: "Căn đúng thời gian loại bỏ." },
        { group: "Lưu ý thao tác", name: "Triệt lông — 3-5 phút", purpose: "Tẩy trang, không rửa mặt. Pha hỗn hợp Kiềm đặc hơn; quét theo chiều sợi lông. Khi thấy sợi lông hơi nổi lên trên là đạt." },
        { group: "Lưu ý thao tác", name: "Sẹo rỗ lâu năm — 5-7 phút", purpose: "Đổ Kiềm trên da 3 phút, xoa nhẹ vào điểm/vùng sẹo rồi để yên thêm 1 phút. Hỏi cảm giác KH; khi thấy hồng nhẹ thì loại bỏ ngay." },
        { group: "Sau 2-3 ngày (đến khi da đóng vảy/khô) — 4 lần/ngày", name: "Sữa rửa mặt Deep Pore / Enbioment Cleanser", purpose: "Rửa nhanh toàn mặt, sáng tối." },
        { group: "Sau 2-3 ngày (đến khi da đóng vảy/khô) — 4 lần/ngày", name: "Beta Gel (serum phục hồi)", purpose: "4 lần/ngày." },
        { group: "Sau 2-3 ngày (đến khi da đóng vảy/khô) — 4 lần/ngày", name: "Actrol Powder (bột khóa viêm)", purpose: "Phủ lớp mỏng lên vùng điều trị hoặc nhiều dầu, 4 lần/ngày." },
        { group: "Từ ngày thứ 3 (đến khi da đóng vảy/khô hoàn toàn)", name: "Sữa rửa mặt Deep Pore / Enbioment Cleanser", purpose: "Rửa nhanh toàn mặt." },
        { group: "Từ ngày thứ 3 (đến khi da đóng vảy/khô hoàn toàn)", name: "Beta Gel (phục hồi)", purpose: "3-4 lần/ngày." },
        { group: "Từ ngày thứ 3 (đến khi da đóng vảy/khô hoàn toàn)", name: "Đặc trị", purpose: "Có thể dùng SP làm trắng sáng (sau 3 ngày), giảm sừng (sau 6 ngày)." },
        { group: "Từ ngày thứ 3 (đến khi da đóng vảy/khô hoàn toàn)", name: "Cấp ẩm — Herb & Mineral Mist, Solar Damage Gel", purpose: "3 lần/ngày." },
        { group: "Từ ngày thứ 3 (đến khi da đóng vảy/khô hoàn toàn)", name: "Actrol Powder (bột khóa viêm)", purpose: "Chỉ phủ 1 lần/ngày lên vùng điều trị hoặc nhiều dầu. Ngưng hẳn nếu da đã khô hoàn toàn." },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  // --- Desquamate: điều trị da mẫn cảm, dày sừng (Enzyme #1) ---
  await prisma.brandProtocol.upsert({
    where: { code: "PROTO-DMK-DESQUAMATE" }, update: {},
    create: {
      code: "PROTO-DMK-DESQUAMATE", name: "DMK — Desquamate (điều trị da mẫn cảm, dày sừng)", kind: "BRAND", brandId: brDMK.id,
      status: "ACTIVE", version: 1, compositionMode: "LEGACY_STEPS",
      purpose: "Điều trị bề mặt bằng Desquamate + đắp Enzyme #1, ủ siêu dưỡng cho da mẫn cảm, dày sừng.",
      steps: { items: [
        { group: "Chuẩn bị dụng cụ", name: "Dụng cụ", purpose: "Mặt rửa mặt (2), bát pha sản phẩm (3), chổi Enzyme (2), chổi peel (1), khăn to (2), nước nóng, mặt nạ nilon/màng bọc thực phẩm." },
        { group: "1. Làm sạch & tiêu độc", name: "Rửa mặt", purpose: "Rửa mặt bằng Deep Pore Cleanser." },
        { group: "1. Làm sạch & tiêu độc", name: "Tiêu độc bằng Epitoxyl", purpose: "1-2ml Epitoxyl ra bông, lau đều mặt & cổ, để 3-5p tùy độc tố/tổn thương gốc tự do, lau sạch bằng nước ấm và thấm khô." },
        { group: "2. Điều trị bề mặt", name: "Desquamate", purpose: "2ml Desquamate, chổi peel quét đều toàn mặt & cổ. Ủ nilon + khăn nóng 10-20 phút (10 phút da khỏe/mẫn cảm nhiều, 20 phút da dày sừng). Lau sạch bằng bông mềm.", durationMinutes: 20 },
        { group: "3. Giảm viêm & ức chế sắc tố", name: "Pore Reduction Plus (7 giọt) + Melanotech Drops (7 giọt)", purpose: "Bôi SP giảm viêm và ức chế sắc tố." },
        { group: "4. Đắp Enzyme #1", name: "Pha mặt nạ Enzyme #1", purpose: "Enzyme #1: 7gr + Aqua d'herb: 6ml. Bắt buộc dùng chổi Enzyme; đánh nhanh tay tạo hỗn hợp sánh, không nhão/chảy." },
        { group: "4. Đắp Enzyme #1", name: "Quét & ủ mặt nạ Enzyme", purpose: "Quét theo hệ bạch huyết từ xương quai xanh lên. KH nằm cố định, hạn chế nói chuyện trong 45 phút.", durationMinutes: 45 },
        { group: "4. Đắp Enzyme #1", name: "Lau mặt nạ Enzyme", purpose: "Pha 0.3ml Deep Pore Cleanser với nước ấm tạo bọt, quét lên làm mềm mặt nạ; ủ khăn ấm ẩm 1 phút rồi lau sạch." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Pore Reduction Plus — 0.4ml (7 giọt)", purpose: "Giảm viêm và thu nhỏ lỗ chân lông." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Melanotech Drops — 0.4ml (7 giọt)", purpose: "Ức chế tăng sắc tố tầng sâu." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Enbioment Serum — 1ml", purpose: "Khôi phục sự đa dạng và cân bằng của hệ vi sinh trên da." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Beta Gel — 1ml", purpose: "Phục hồi da hư tổn, sửa chữa hệ miễn dịch của da." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Herbal Pigment Oil — 0.2ml (5 giọt)", purpose: "Bổ sung dầu cho da thiếu dầu, tái thiết lập màng axit." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Herb & Mineral Mist — 0.5ml (6 lần xịt)", purpose: "Xịt khoáng đẩy sâu tinh chất và tái thiết lập màng axit." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Kem dưỡng theo tình trạng da — 1gr", purpose: "Cấp ẩm và sửa chữa các vấn đề da." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "Solar Damage Gel — 0.5ml", purpose: "Dưỡng ẩm và khóa ẩm tầng sâu." },
        { group: "5. Ủ siêu dưỡng sau Enzyme #1", name: "KCN Soleil Défense SPF 50 — 0.5ml", purpose: "Bảo vệ da khỏi tia UVA và UVB." },
      ] },
      recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
    },
  });
  // === Quy trình DỊCH VỤ DMK theo bước (DV01–DV09, từ bảng đào tạo khách gửi) ===
  // Khối tái sử dụng: chọn peel (2 biến thể) + phục hồi hàng rào bảo vệ da.
  const peelChoice5 = (g: string) => [
    { group: g, name: "3.1 Desquamate", purpose: "Dành cho da yếu, khô, mất nước, sần rát (10-20 phút)." },
    { group: g, name: "3.2 Pro Alpha #1", purpose: "Dành cho da khô, thiếu nước, sần, muốn căng bóng (5-8 phút)." },
    { group: g, name: "3.3 Bihaku (Pro Alpha 1 + Super Bright)", purpose: "Da khô, thiếu nước, sần, muốn căng bóng và sáng da, giảm sạm nám (5-8 phút)." },
    { group: g, name: "3.4 Prozyme", purpose: "Dành cho da nhiều dầu, bít tắc, mụn, quá dày sừng (10-20 phút)." },
    { group: g, name: "3.5 Quick Peel", purpose: "Da không đều màu, tối xỉn, thâm quầng mắt, rãnh rỗng, mụn viêm, thâm đỏ, giãn mạch máu (3-5 phút)." },
  ];
  const peelChoice6 = (g: string) => [
    { group: g, name: "RVT", purpose: "Desquamate: loại bỏ sừng nhẹ nhàng. Red Vein + Herb Mineral: giảm thâm đỏ, viêm sâu, giãn mạch (15 phút)." },
    { group: g, name: "Hydradermaze", purpose: "Prozyme: giảm sừng, bít tắc, dầu nhờn. Pro Alpha 1: da căng mọng giảm nhăn." },
    { group: g, name: "Alphazyme", purpose: "Pro Alpha 1: da căng mọng giảm nhăn. Prozyme: giảm sừng, bít tắc, dầu nhờn." },
    { group: g, name: "Alkaline Wash", purpose: "Xử lý nhiều vấn đề cùng lúc: mụn, sẹo, viêm, bít tắc hoặc da kháng trị (2-3 phút/vùng, 3 vùng/mặt)." },
    { group: g, name: "Rhinovac", purpose: "Alkaline Wash + Pro Alpha 1: làm mềm mô sừng, giảm bít tắc sâu, da dày sừng khô, mụn ẩn, sẹo (18 phút)." },
    { group: g, name: "Vitamin A Peel (Option 1)", purpose: "Pro Alpha 1 + Pro Alpha 2 + Revitosin: trẻ hóa, thu nhỏ LCL, sáng da, giảm bít tắc sâu (10 phút)." },
  ];
  const barrierRecovery = (g: string) => [
    { group: g, name: "Pore Reduction", purpose: "Thu nhỏ lỗ chân lông, giảm viêm." },
    { group: g, name: "Melanotech Drops", purpose: "Chống tăng sinh sắc tố tầng sâu." },
    { group: g, name: "Enbioment Serum", purpose: "Phục hồi hệ vi sinh, giảm đỏ rát." },
    { group: g, name: "Beta Gel", purpose: "Tăng cường miễn dịch, làm lành, khỏe da." },
    { group: g, name: "Herbal Pigment Oil", purpose: "Mô phỏng tuyến dầu tốt cho da." },
    { group: g, name: "Herb & Mineral Mist", purpose: "Xịt khoáng cấp nước dạng phân cực." },
    { group: g, name: "Solar Damage", purpose: "Cấp nước tầng sâu, không bết dính." },
    { group: g, name: "Actrol Powder (nếu có mụn viêm và vết thương hở)", purpose: "Giảm viêm, hút dịch, se viêm." },
  ];
  const enzyme1 = (g: string) => ({ group: g, name: "Trị liệu Enzyme Therapy #1", purpose: "Phục hồi da chuyên sâu từ bên trong: kích hoạt tuần hoàn; thanh lọc hệ bạch huyết; thúc đẩy các men enzyme hoạt động tối ưu.", durationMinutes: 45 });
  const dmkServices: { code: string; name: string; purpose: string; items: any[] }[] = [
    { code: "PROTO-DMK-DV01", name: "DMK_DV01 — Detox sạch sâu nang lông, giảm dầu, mụn (60 phút)", purpose: "Quy trình dịch vụ detox sạch sâu, giảm dầu, mụn.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tẩy da chết", purpose: "Loại bỏ lớp sừng cằn cỗi, giúp da hấp thu dưỡng chất tốt hơn.", durationMinutes: 4 },
      { group: "B3", name: "Ủ Sebum Soak", purpose: "Làm loãng bã nhờn, nới lỏng bít tắc, sạch sâu nang lông.", durationMinutes: 5 },
      { group: "B4", name: "Hút dầu + làm sạch", purpose: "", durationMinutes: 5 },
      { group: "B5", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      { group: "B6", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      { group: "B7", name: "Đắp mặt nạ Acu Masque", purpose: "Giảm viêm, dịu da, kiểm soát bã nhờn.", durationMinutes: 20 },
      { group: "B8", name: "Phục hồi khóa dưỡng: Solar Damage + Actrol Powder", purpose: "Cấp nước, dịu và khỏe da; kháng khuẩn, se viêm.", durationMinutes: 3 },
    ] },
    { code: "PROTO-DMK-DV02", name: "DMK_DV02 — Detox sạch sâu nang lông, căng bóng, sáng mịn (60 phút)", purpose: "Quy trình dịch vụ detox + căng bóng, sáng mịn.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tẩy da chết", purpose: "Loại bỏ lớp sừng cằn cỗi, giúp da hấp thu dưỡng chất tốt hơn.", durationMinutes: 4 },
      { group: "B3", name: "Ủ Sebum Soak", purpose: "Làm loãng bã nhờn, nới lỏng bít tắc, sạch sâu nang lông.", durationMinutes: 5 },
      { group: "B4", name: "Hút dầu + làm sạch", purpose: "", durationMinutes: 5 },
      { group: "B5", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      { group: "B6", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      { group: "B7", name: "Đắp mặt nạ Hydrating Masque", purpose: "Cấp nước sâu, làm dịu da, giúp da căng bóng, láng mịn.", durationMinutes: 20 },
      { group: "B8", name: "Phục hồi khóa dưỡng: Dầu Herbal Pigment Oil + Xịt Herb Mineral Mist; Solar Damage", purpose: "Thiết lập màng acid tức thì, tránh mất nước qua da; cấp nước, dịu và khỏe da.", durationMinutes: 3 },
    ] },
    { code: "PROTO-DMK-DV03", name: "DMK_DV03 — Trị liệu Peel chuyên sâu, thay mới bề mặt da (50-70 phút)", purpose: "Peel chuyên sâu thay mới bề mặt da; chọn chương trình peel theo tình trạng da.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      ...peelChoice5("B3 — Chọn chương trình Peel (peel chồng peel)"),
      { group: "B4", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      { group: "B5", name: "Đắp mặt nạ Hydrating Masque", purpose: "Cấp nước tầng sâu cho da.", durationMinutes: 20 },
      { group: "B6", name: "Phục hồi khóa dưỡng: Dầu Herbal Pigment Oil + Xịt Herb Mineral Mist; Solar Damage; Actrol Powder (nếu có mụn viêm)", purpose: "Thiết lập màng acid tức thì, tránh mất nước qua da; cấp nước, dịu và khỏe da.", durationMinutes: 3 },
    ] },
    { code: "PROTO-DMK-DV04", name: "DMK_DV04 — Công nghệ Enzyme Therapy #1, phục hồi da từ gốc (65-85 phút)", purpose: "Enzyme Therapy #1 phục hồi da từ gốc.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tẩy da chết", purpose: "Loại bỏ lớp sừng cằn cỗi, giúp da hấp thu dưỡng chất tốt hơn.", durationMinutes: 4 },
      { group: "B3", name: "Sebum Soak", purpose: "Làm loãng bã nhờn, nới lỏng bít tắc, sạch sâu nang lông.", durationMinutes: 5 },
      { group: "B4", name: "Hút dầu — làm sạch", purpose: "", durationMinutes: 5 },
      { group: "B5", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      { group: "B6", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      enzyme1("B7"),
      ...barrierRecovery("B8 — Phục hồi các hàng rào bảo vệ da"),
    ] },
    { code: "PROTO-DMK-DV05", name: "DMK_DV05 — (Cộng thêm) Enzyme siết cơ theo vùng (Enzyme 2)", purpose: "Add-on siết cơ theo vùng (chỉ đắp vùng mặt, rãnh cười). KH muốn cải thiện thêm nâng cơ, giảm nhăn.", items: [
      { group: "Enzyme siết cơ", name: "Trị liệu Enzyme Therapy #2", purpose: "Tác động lên 57 nhóm cơ vùng mặt, cổ; giúp da săn chắc, cải thiện rõ nếp nhăn, da mịn màng căng bóng." },
      { group: "Phạm vi", name: "Siết cơ theo vùng", purpose: "Chỉ đắp vùng mặt, rãnh cười." },
    ] },
    { code: "PROTO-DMK-DV06", name: "DMK_DV06 — (Cộng thêm) Enzyme siết cơ toàn diện (Enzyme 2+3)", purpose: "Add-on siết cơ toàn diện vùng mặt, cổ, ức. KH muốn cải thiện thêm nâng cơ, giảm nhăn.", items: [
      { group: "Enzyme siết cơ", name: "Trị liệu Enzyme Therapy #2", purpose: "Tác động lên 57 nhóm cơ vùng mặt, cổ; giúp da săn chắc, cải thiện rõ nếp nhăn, da mịn màng căng bóng." },
      { group: "Enzyme siết cơ", name: "Trị liệu Enzyme Therapy #3", purpose: "Bắt buộc kết hợp cùng Enzyme 2 để tăng hiệu quả cải thiện cơ, đốt cháy mỡ thừa, hỗ trợ thành mạch." },
      { group: "Phạm vi", name: "Siết cơ toàn diện", purpose: "Vùng mặt, cổ, ức." },
    ] },
    { code: "PROTO-DMK-DV07", name: "DMK_DV07 — Trị liệu Peel chuyên sâu kết hợp phục hồi đa tầng Enzyme Therapy (85-105 phút)", purpose: "Peel chuyên sâu + Enzyme Therapy #1.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Ủ Sebum Soak", purpose: "Làm loãng bã nhờn, nới lỏng bít tắc, sạch sâu nang lông.", durationMinutes: 5 },
      { group: "B3", name: "Hút dầu + làm sạch", purpose: "", durationMinutes: 5 },
      { group: "B4", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      { group: "B5", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      ...peelChoice5("B6 — Chọn chương trình Peel"),
      enzyme1("B7"),
      ...barrierRecovery("B8 — Phục hồi các hàng rào bảo vệ da"),
    ] },
    { code: "PROTO-DMK-DV08", name: "DMK_DV08 — Tái cấu trúc peel đa tầng (peel chồng peel) (50-70 phút)", purpose: "Tái cấu trúc peel đa tầng theo tình trạng da.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      ...peelChoice6("B3 — Chọn chương trình Peel"),
      { group: "B4", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      ...barrierRecovery("B5 — Phục hồi các hàng rào bảo vệ da"),
    ] },
    { code: "PROTO-DMK-DV09", name: "DMK_DV09 — Trị liệu Peel đa tầng kết hợp phục hồi đa tầng Enzyme Therapy (90-100 phút)", purpose: "Peel đa tầng + Enzyme Therapy #1.", items: [
      { group: "B1", name: "Tẩy trang + rửa mặt", purpose: "Loại bỏ lớp trang điểm, KCN, bụi bẩn trên da.", durationMinutes: 3 },
      { group: "B2", name: "Tiêu độc Epitoxyl", purpose: "Thải độc, se viêm, cho da rạng rỡ.", durationMinutes: 5 },
      ...peelChoice6("B3 — Chọn chương trình Peel"),
      { group: "B4", name: "Lấy mụn (nếu có)", purpose: "", durationMinutes: 15 },
      enzyme1("B5"),
      ...barrierRecovery("B6 — Phục hồi các hàng rào bảo vệ da"),
    ] },
  ];
  for (const s of dmkServices) {
    await prisma.brandProtocol.upsert({
      where: { code: s.code }, update: {},
      create: { code: s.code, name: s.name, kind: "BRAND", brandId: brDMK.id, status: "ACTIVE", version: 1,
        compositionMode: "LEGACY_STEPS", purpose: s.purpose, steps: { items: s.items }, recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý" },
    });
  }
  console.log("   Protocol DMK theo bước: ACNE(9)+AGING(10)+PIGMENT(18)+BIHAKU(7)+SKIN-MATRIX(8)+FINISH-DRY(8)+FINISH-ACNE(6)+ALPHAZYME(9)+HYDRADERMAZE(9)+ALKALINE-FACE(21)+DESQUAMATE(17).");
  console.log(`   Quy trình dịch vụ DMK: ${dmkServices.map((s) => s.code.replace("PROTO-DMK-", "")).join("+")} (${dmkServices.length} DV).`);

  // === Giá lẻ dịch vụ DMK (DV01–DV09) + giảm giá VIP (từ "Bảng giá trị liệu DMK gợi ý cho đại lý") ===
  // retail = cột GIÁ LẺ; vip = cột GIÁ (3 buổi trở lên) — VIP hưởng mức thấp hơn.
  const catDMKsv = await prisma.serviceCategory.upsert({ where: { code: "DM-DMK" }, update: {}, create: { code: "DM-DMK", name: "Trị liệu DMK" } });
  const dmkPrices: Record<string, { retail: number; vip: number; minutes: number; name: string }> = {
    DV01: { retail: 450_000, vip: 360_000, minutes: 60, name: "DMK_DV01 — Detox sạch sâu, giảm dầu mụn" },
    DV02: { retail: 450_000, vip: 360_000, minutes: 60, name: "DMK_DV02 — Detox căng bóng, sáng mịn" },
    DV03: { retail: 700_000, vip: 560_000, minutes: 60, name: "DMK_DV03 — Peel chuyên sâu, thay mới bề mặt da" },
    DV04: { retail: 1_150_000, vip: 950_000, minutes: 75, name: "DMK_DV04 — Enzyme Therapy #1, phục hồi da từ gốc" },
    DV05: { retail: 630_000, vip: 500_000, minutes: 30, name: "DMK_DV05 — (Cộng thêm) Enzyme siết cơ theo vùng" },
    DV06: { retail: 980_000, vip: 780_000, minutes: 30, name: "DMK_DV06 — (Cộng thêm) Enzyme siết cơ toàn diện" },
    DV07: { retail: 1_650_000, vip: 1_350_000, minutes: 95, name: "DMK_DV07 — Peel chuyên sâu + Enzyme Therapy" },
    DV08: { retail: 1_050_000, vip: 850_000, minutes: 60, name: "DMK_DV08 — Tái cấu trúc peel đa tầng" },
    DV09: { retail: 2_150_000, vip: 1_750_000, minutes: 95, name: "DMK_DV09 — Peel đa tầng + Enzyme Therapy" },
  };
  for (const s of dmkServices) {
    const key = s.code.replace("PROTO-DMK-", "");
    const p = dmkPrices[key];
    if (!p) continue;
    const proto = await prisma.brandProtocol.findUnique({ where: { code: s.code }, select: { id: true } });
    const svc = await prisma.service.upsert({
      where: { code: "DV-DMK-" + key },
      update: { standardPrice: p.retail }, // "cập nhật giá lẻ" khi chạy lại
      create: { code: "DV-DMK-" + key, name: p.name, categoryId: catDMKsv.id, status: "ACTIVE", durationMinutes: p.minutes, standardPrice: p.retail, expectedCost: 0, version: 1, defaultProtocolId: proto?.id ?? null },
    });
    const hasVip = await prisma.priceRule.findFirst({ where: { targetType: "SERVICE", targetId: svc.id, priceType: "VIP" } });
    if (!hasVip) await prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: svc.id, targetName: p.name, priceType: "VIP", price: p.vip, isActive: true, createdBy: "Trần Quản Lý" } });
  }
  console.log("   Giá lẻ + giảm giá VIP cho 9 dịch vụ DMK (DV01–DV09): lẻ 450k–2.150k, VIP 360k–1.750k.");

  // === DMK ENZYME BODY (phục hồi/săn chắc/tái tạo da cơ thể) — bảng giá body ===
  // retail = GIÁ LẺ; vip = LIỆU TRÌNH 03 LẦN (thấp hơn). Gói toàn diện = 1 dịch vụ combo.
  const catDMKbody = await prisma.serviceCategory.upsert({ where: { code: "DM-DMK-BODY" }, update: {}, create: { code: "DM-DMK-BODY", name: "DMK Enzyme Body" } });
  const dmkBody: { code: string; name: string; retail: number; vip?: number; minutes: number }[] = [
    { code: "DV-DMK-BODY-BUNG", name: "DMK Enzyme Body — Vùng bụng", retail: 1_080_000, vip: 890_000, minutes: 60 },
    { code: "DV-DMK-BODY-BAPTAY", name: "DMK Enzyme Body — Vùng bắp tay", retail: 800_000, vip: 690_000, minutes: 60 },
    { code: "DV-DMK-BODY-DUI", name: "DMK Enzyme Body — Vùng đùi", retail: 1_080_000, vip: 890_000, minutes: 60 },
    { code: "DV-DMK-BODY-MONG", name: "DMK Enzyme Body — Vùng mông", retail: 1_950_000, vip: 1_750_000, minutes: 60 },
    // Gói toàn diện (bụng + bắp tay + đùi + mông) — giá trọn gói.
    { code: "DV-DMK-BODY-FULL", name: "DMK Enzyme Body — Toàn diện (bụng·bắp tay·đùi·mông)", retail: 4_650_000, minutes: 120 },
  ];
  for (const b of dmkBody) {
    const svc = await prisma.service.upsert({
      where: { code: b.code },
      update: { standardPrice: b.retail }, // "cập nhật giá bán" khi chạy lại
      create: { code: b.code, name: b.name, categoryId: catDMKbody.id, status: "ACTIVE", durationMinutes: b.minutes, standardPrice: b.retail, expectedCost: 0, version: 1 },
    });
    if (b.vip != null) {
      const hasVip = await prisma.priceRule.findFirst({ where: { targetType: "SERVICE", targetId: svc.id, priceType: "VIP" } });
      if (!hasVip) await prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: svc.id, targetName: b.name, priceType: "VIP", price: b.vip, isActive: true, createdBy: "Trần Quản Lý" } });
      else await prisma.priceRule.updateMany({ where: { targetType: "SERVICE", targetId: svc.id, priceType: "VIP" }, data: { price: b.vip, targetName: b.name } });
    }
  }
  console.log("   DMK Enzyme Body: 4 vùng (bụng/bắp tay/đùi/mông) lẻ 800k–1.950k · liệu trình 3 lần 690k–1.750k + gói toàn diện 4.650.000₫.");

  // === Redesign P2 · Protocol compose NHIỀU Service (coexistence) — "Điều trị sắc tố kết hợp" ===
  const techPico = await prisma.technology.upsert({
    where: { code: "CN-PICO" }, update: {},
    create: { code: "CN-PICO", name: "Laser Pico", group: "Laser", deviceModel: "PicoSure-like", area: "Mặt", durationMinutes: 30, indications: "Nám, sắc tố", contraindications: "Thai kỳ, da rám nắng cấp" },
  });
  const svcLaserPico = await prisma.service.upsert({
    where: { code: "DV-PICO-01" }, update: {},
    create: {
      code: "DV-PICO-01", name: "Laser Pico điều trị sắc tố", categoryId: catLaser.id, status: "ACTIVE", durationMinutes: 30, standardPrice: 2_000_000, expectedCost: 400_000, version: 1,
      technologyIds: [techPico.id], defaultTechnologyId: techPico.id,
      steps: { create: [
        { sortOrder: 0, name: "Tê ủ", durationMinutes: 15, technique: "Ủ tê 15 phút", isRequired: true },
        { sortOrder: 1, name: "Bắn Laser Pico", durationMinutes: 12, technique: "Bắn theo vùng sắc tố", isRequired: true, technologies: { create: [{ technologyId: techPico.id, notes: "Spot theo mức độ nám" }] } },
        { sortOrder: 2, name: "Làm dịu", durationMinutes: 3, technique: "Đắp dịu + chống nắng", isRequired: true },
      ] },
    },
  });
  const svcRecovery = await prisma.service.upsert({
    where: { code: "DV-RECOVERY-01" }, update: {},
    create: {
      code: "DV-RECOVERY-01", name: "Recovery phục hồi da", categoryId: catFacial.id, status: "ACTIVE", durationMinutes: 20, standardPrice: 600_000, expectedCost: 150_000, version: 1,
      steps: { create: [
        { sortOrder: 0, name: "Đắp mặt nạ phục hồi", durationMinutes: 15, isRequired: true },
        { sortOrder: 1, name: "Thoa serum + chống nắng", durationMinutes: 5, isRequired: true },
      ] },
    },
  });
  const svcDmkForCompose = await prisma.service.findUnique({ where: { code: "DV-DMK-ENZ" } });
  const protoCompose = await prisma.brandProtocol.findUnique({ where: { code: "PROTO-PIGMENT-COMBO" } });
  if (!protoCompose && svcDmkForCompose) {
    await prisma.brandProtocol.create({
      data: {
        code: "PROTO-PIGMENT-COMBO", name: "Điều trị sắc tố kết hợp (compose)", kind: "INTERNAL", status: "ACTIVE", version: 1,
        compositionMode: "SERVICES",
        purpose: "Phác đồ chuẩn compose từ NHIỀU dịch vụ — mỗi dịch vụ giữ SOP riêng (Redesign P2).",
        suitableFor: "Nám, tăng sắc tố sau viêm", contraindications: "Thai kỳ, da đang tổn thương",
        recommendedFreq: "2–4 tuần/lần", recommendedCount: 5, createdBy: "Phạm Chuyên Viên",
        services: {
          create: [
            { sortOrder: 0, serviceId: svcDmkForCompose.id, isRequired: true, serviceVersionSnapshot: svcDmkForCompose.version, conditionText: "Chọn enzyme theo tình trạng da", recommendedVariants: [{ stepName: "Đắp Enzyme Masque", optionName: "Enzyme #2 (da dày/nhiều dầu)" }] },
            { sortOrder: 1, serviceId: svcLaserPico.id, isRequired: true, serviceVersionSnapshot: svcLaserPico.version, notes: "Bắn sau khi da đã được enzyme làm sạch" },
            { sortOrder: 2, serviceId: svcRecovery.id, isRequired: false, serviceVersionSnapshot: svcRecovery.version, conditionText: "Thêm khi da nhạy cảm/đỏ nhiều" },
          ],
        },
      },
    });
  }

  // --- CẤU HÌNH DỊCH VỤ đầy đủ (mục 3): công nghệ/protocol/nhân sự/tài nguyên/vật tư định mức ---
  // Dịch vụ 1 — RF nâng cơ mặt (Công nghệ cao): RF, KTV chính bắt buộc, Máy RF, vật tư định mức.
  await prisma.service.update({
    where: { id: svcRF.id },
    data: {
      status: "ACTIVE", machineMinutes: 45, technologyIds: [techRF.id], defaultTechnologyId: techRF.id,
      protocolIds: [protoDemo.id], defaultProtocolId: protoDemo.id,
      staffRequirements: [{ role: "Kỹ thuật viên", quantity: 1, required: true }],
      resourceRequirements: { room: { required: true, default: "Phòng 2" }, machine: { required: true, default: "Máy RF #1" }, bed: { required: false, default: "" } },
      materialStandards: { deleteMany: {}, create: [{ name: "Gel dẫn RF", quantity: 1, unit: "lần", required: true, orderIndex: 0 }] },
    },
  });
  // Dịch vụ 2 — Nâng cơ HIFU: HIFU, KTV chính + Master bắt buộc + Hỗ trợ tùy chọn, Máy HIFU, vật tư.
  await prisma.service.update({
    where: { id: svcHIFU.id },
    data: {
      status: "ACTIVE", machineMinutes: 60, technologyIds: [techHIFU.id], defaultTechnologyId: techHIFU.id,
      protocolIds: [protoDemo.id], defaultProtocolId: protoDemo.id,
      staffRequirements: [
        { role: "Kỹ thuật viên", quantity: 1, required: true },
        { role: "Master", quantity: 1, required: true },
        { role: "Tư vấn", quantity: 1, required: false },
      ],
      resourceRequirements: { room: { required: true, default: "Phòng 3" }, machine: { required: true, default: "Máy HIFU #1" }, bed: { required: false, default: "" } },
      materialStandards: { deleteMany: {}, create: [{ name: "Gel siêu âm HIFU", quantity: 2, unit: "tuýp", required: true, orderIndex: 0 }] },
    },
  });
  // Dịch vụ 3 — Facial làm sạch sâu (Chăm sóc da mặt): KHÔNG bắt buộc máy, KTV chính, protocol, sản phẩm.
  await prisma.service.update({
    where: { id: svcFacial.id },
    data: {
      status: "ACTIVE", protocolIds: [protoDemo.id], defaultProtocolId: protoDemo.id,
      staffRequirements: [{ role: "Kỹ thuật viên", quantity: 1, required: true }],
      resourceRequirements: { room: { required: true, default: "Phòng 1" }, machine: { required: false, default: "" }, bed: { required: false, default: "" } },
      materialStandards: { deleteMany: {}, create: [
        { name: "Klapp Hydra Mask", quantity: 1, unit: "lần", required: true, spaProductId: spKlappMask.id, orderIndex: 0 },
        { name: "Gel rửa mặt dịu nhẹ", quantity: 1, unit: "lần", required: false, spaProductId: spCleanser.id, orderIndex: 1 },
      ] },
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
  await prisma.crmActivity.create({ data: { customerId: kMoi.id, type: "INTERNAL_NOTE", content: "Khách mới để lại số qua TikTok, chưa tư vấn.", performedBy: "Lê Thị CSKH", occurredAt: vnts("2026-08-05T02:00:00") } });

  // 2) ĐANG TƯ VẤN
  const kTuVan = await prisma.customer.create({
    data: { code: "KH-100002", fullName: "Trần Bảo Ngọc", gender: "FEMALE", phone: "0900100002", source: "Giới thiệu", group: "Thường", assignedTo: "Phạm Chuyên Viên", goals: "Trẻ hóa, nâng cơ", dob: new Date("1996-08-20") },
  });
  await prisma.assessment.create({ data: { customerId: kTuVan.id, name: "Da chảy xệ nhẹ", area: "Đường viền hàm", severity: "Nhẹ", description: "Bắt đầu chùng nhẹ vùng hàm", assessedBy: "Phạm Chuyên Viên" } });
  await prisma.crmActivity.create({ data: { customerId: kTuVan.id, type: "CONSULT", content: "Tư vấn HIFU vs RF, khách đang cân nhắc ngân sách.", result: "Đang cân nhắc", performedBy: "Phạm Chuyên Viên", occurredAt: vnts("2026-08-06T04:00:00"), nextAction: "Gửi báo giá", followUpDate: vnts("2026-08-12T02:00:00"), followUpOwner: "Phạm Chuyên Viên" } });
  await prisma.task.create({ data: { title: "Gửi báo giá HIFU cho khách Bảo Ngọc", customerId: kTuVan.id, assignee: "Phạm Chuyên Viên", dueDate: vnts("2026-08-12T02:00:00"), priority: "NORMAL", status: "OPEN", createdBy: "Phạm Chuyên Viên" } });

  // 3) ĐÃ BOOKING (chưa thực hiện)
  const kBooking = await prisma.customer.create({
    data: { code: "KH-100003", fullName: "Phạm Gia Hân", gender: "FEMALE", phone: "0900100003", source: "Facebook", group: "Thường", assignedTo: "Nguyễn Lễ Tân" },
  });
  await prisma.booking.create({ data: { code: "BK-100001", customerId: kBooking.id, serviceId: svcRF.id, scheduledAt: vnts("2026-08-18T07:00:00"), durationMinutes: 45, room: "Phòng 2", bed: "Giường A", machine: "Máy RF #1", technician: "Phạm Chuyên Viên", master: "Trần Quản Lý", performer: "Phạm Chuyên Viên", status: "CONFIRMED", price: 1_800_000 } });

  // 4) ĐANG THỰC HIỆN PHÁC ĐỒ (đầy đủ) — có portal
  const kDangPD = await prisma.customer.create({
    data: { code: "KH-100004", fullName: "Đỗ Thùy Linh", gender: "FEMALE", phone: "0900100004", email: "linh.do@example.com", source: "Facebook Ads", group: "VIP", assignedTo: "Phạm Chuyên Viên", goals: "Trẻ hóa, nâng cơ mặt", tags: ["nâng cơ", "VIP"], campaignId: campTiktok.id, dob: new Date("1993-08-30") },
  });
  await prisma.assessment.create({ data: { customerId: kDangPD.id, name: "Chảy xệ vùng má - hàm", area: "Má, hàm", severity: "Vừa", description: "Chùng da vùng má, đường hàm chưa gọn", assessedBy: "Phạm Chuyên Viên", indicators: { do_dan_hoi: "trung bình" } } });
  const planLinh = await prisma.treatmentPlan.create({
    data: {
      code: "TP-100001", customerId: kDangPD.id, name: "Phác đồ trẻ hóa 8 buổi", version: 1, status: "ACTIVE",
      diagnosis: "Lão hóa nhẹ-vừa vùng má/hàm", goals: "Trẻ hóa, nâng cơ, gọn đường hàm sau 8 buổi",
      totalPrice: 32_000_000, createdBy: "Phạm Chuyên Viên", designer: "Phạm Chuyên Viên",
      approver: "Trần Quản Lý", approvedAt: vnts("2026-08-15T02:00:00"),
      plannedStartDate: new Date("2026-08-20"), plannedEndDate: new Date("2026-12-20"),
      note: "Phác đồ demo minh họa 4 lớp: Phác đồ → Giai đoạn → Buổi dự kiến → Lần thực hiện.",
      stages: { create: [
        { name: "Chuẩn bị", orderIndex: 0, description: "Làm sạch sâu, ổn định nền da", status: "IN_PROGRESS",
          plannedStartDate: new Date("2026-08-20"), plannedEndDate: new Date("2026-08-27"), plannedSessions: 2, frequencyValue: 7, frequencyUnit: "DAY" },
        { name: "Can thiệp", orderIndex: 1, description: "RF/HIFU nâng cơ chuyên sâu", status: "PENDING",
          plannedStartDate: new Date("2026-09-03"), plannedEndDate: new Date("2026-09-24"), plannedSessions: 4, frequencyValue: 7, frequencyUnit: "DAY" },
        { name: "Phục hồi", orderIndex: 2, description: "Phục hồi, cấp ẩm sau can thiệp", status: "PENDING",
          plannedStartDate: new Date("2026-10-08"), plannedEndDate: new Date("2026-10-08"), plannedSessions: 1, frequencyValue: 14, frequencyUnit: "DAY" },
        { name: "Duy trì", orderIndex: 3, description: "Duy trì kết quả định kỳ", status: "PENDING",
          plannedStartDate: new Date("2026-11-08"), plannedEndDate: new Date("2026-11-08"), plannedSessions: 1, frequencyValue: 1, frequencyUnit: "MONTH" },
      ] },
    },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  const bkLinh1 = await prisma.booking.create({ data: { code: "BK-100002", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: vnts("2026-07-25T07:00:00"), durationMinutes: 45, room: "Phòng 2", performer: "Phạm Chuyên Viên", status: "COMPLETED", price: 1_800_000 } });
  const sLinh1 = await prisma.treatmentSession.create({
    data: {
      code: "SS-100001",
      planId: planLinh.id, stageId: planLinh.stages[0].id, customerId: kDangPD.id, bookingId: bkLinh1.id, serviceId: svcRF.id,
      sessionNumber: 1, name: "RF nâng cơ buổi 1", status: "COMPLETED", scheduledAt: vnts("2026-07-25T07:00:00"), performedAt: vnts("2026-07-25T07:15:00"),
      performer: "Phạm Chuyên Viên", objective: "RF vùng má", actualParams: { nang_luong: "làm ấm 42°C" }, conditionBefore: "Da chùng nhẹ", conditionAfter: "Săn hơn tức thì", customerFeedback: "Ưng ý", plannedCost: 500_000, actualCost: 480_000, price: 1_800_000, checkedBy: "Trần Quản Lý",
      // KẾ HOẠCH buổi (khớp thực tế) + ghim version thực hiện = 1
      plannedServiceId: svcRF.id, plannedTechnologyId: techRF.id, plannedProtocolId: protoDemo.id, technologyId: techRF.id, brandProtocolId: protoDemo.id,
      plannedDate: new Date("2026-07-25"), plannedMaterials: { text: "Gel RF 5 ml" }, actualMaterials: { text: "Gel RF 5 ml" }, versionAtExecution: 1,
    },
  });

  // --- CSKH follow-up (mục 9): quy trình chăm sóc sau dịch vụ + sinh nhật ---
  const tplCare = await prisma.followUpTemplate.create({
    data: {
      code: "CS-000001", name: "Chăm sóc sau liệu trình", trigger: "AFTER_SERVICE", createdBy: "Lê Thị CSKH",
      version: 1,
      description: "Quy trình hỏi thăm & nhắc lịch sau buổi điều trị.",
      steps: { create: [
        { orderIndex: 0, dayOffset: 1, channel: "ZALO", title: "Hỏi thăm phản ứng sau 1 ngày", script: "Chào chị, sau buổi hôm qua da mình có bị đỏ/ngứa gì không ạ?", checklist: ["Hỏi phản ứng da", "Nhắc kiêng nắng 48h", "Nhắc uống đủ nước"] },
        { orderIndex: 1, dayOffset: 3, channel: "SMS", title: "Nhắc dùng sản phẩm tại nhà", script: "Nhắc chị dùng serum sáng/tối theo hướng dẫn nhé.", checklist: ["Xác nhận đang dùng đúng"] },
        { orderIndex: 2, dayOffset: 14, channel: "IN_PERSON", title: "Mời đặt lịch buổi kế", script: "Đã đến lịch buổi kế, mời chị sắp xếp thời gian ạ.", checklist: ["Chốt ngày buổi kế"] },
      ] },
    },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  await prisma.followUpTemplate.create({
    data: {
      code: "CS-000002", name: "Chúc mừng sinh nhật", trigger: "BIRTHDAY", createdBy: "Lê Thị CSKH",
      version: 1,
      description: "Gửi lời chúc + ưu đãi sinh nhật.",
      steps: { create: [
        { orderIndex: 0, dayOffset: 0, channel: "ZALO", title: "Gửi lời chúc + voucher sinh nhật", script: "Chúc mừng sinh nhật chị! Spa gửi tặng ưu đãi sinh nhật...", checklist: ["Gửi voucher", "Ghi nhận phản hồi"] },
      ] },
    },
  });

  // Một LẦN ÁP quy trình CSKH thật cho KH-100004 (mốc 05/08 → có task quá hạn để
  // minh họa bộ lọc "Quá hạn"; task đầu đã hoàn thành có kết quả/kênh thực tế).
  const careAnchor = new Date("2026-08-05T00:00:00Z");
  const careInst = await prisma.careProcessInstance.create({
    data: {
      code: "CSI-000001", templateId: tplCare.id, templateCode: tplCare.code, templateName: tplCare.name,
      templateVersion: tplCare.version, trigger: tplCare.trigger, customerId: kDangPD.id, startDate: careAnchor,
      status: "ACTIVE", appliedBy: "Lê Thị CSKH",
    },
  });
  const careSnap = (s: (typeof tplCare.steps)[number]) => ({ stepId: s.id, orderIndex: s.orderIndex, dayOffset: s.dayOffset, channel: s.channel, title: s.title, script: s.script, checklist: s.checklist });
  const addCareDays = (n: number) => { const x = new Date(careAnchor); x.setDate(x.getDate() + n); return x; };
  // Bước 1 (+1 = 06/08): ĐÃ HOÀN THÀNH (có kết quả + kênh thực tế + audit qua editLog không cần)
  await prisma.task.create({ data: {
    title: tplCare.steps[0].title, description: tplCare.steps[0].script, customerId: kDangPD.id, assignee: "Lê Thị CSKH",
    dueDate: addCareDays(1), channel: tplCare.steps[0].channel, checklist: tplCare.steps[0].checklist as any,
    followUpTemplateId: tplCare.id, careProcessInstanceId: careInst.id, processStepId: tplCare.steps[0].id, processVersion: tplCare.version,
    stepSnapshot: careSnap(tplCare.steps[0]) as any, priority: "NORMAL", status: "DONE",
    completedAt: vnts("2026-08-06T03:30:00"), completedBy: "Lê Thị CSKH", completionNote: "Đã gọi Zalo, da ổn không đỏ ngứa.", actualChannel: "ZALO",
    checklistState: [true, true, true] as any, createdBy: "Lê Thị CSKH",
  } });
  // Bước 2 (+3 = 08/08): CHƯA XONG → QUÁ HẠN
  await prisma.task.create({ data: {
    title: tplCare.steps[1].title, description: tplCare.steps[1].script, customerId: kDangPD.id, assignee: "Lê Thị CSKH",
    dueDate: addCareDays(3), channel: tplCare.steps[1].channel, checklist: tplCare.steps[1].checklist as any,
    followUpTemplateId: tplCare.id, careProcessInstanceId: careInst.id, processStepId: tplCare.steps[1].id, processVersion: tplCare.version,
    stepSnapshot: careSnap(tplCare.steps[1]) as any, priority: "HIGH", status: "OPEN", createdBy: "Lê Thị CSKH",
  } });
  // Bước 3 (+14 = 19/08): sắp tới
  await prisma.task.create({ data: {
    title: tplCare.steps[2].title, description: tplCare.steps[2].script, customerId: kDangPD.id, assignee: "Lê Thị CSKH",
    dueDate: addCareDays(14), channel: tplCare.steps[2].channel, checklist: tplCare.steps[2].checklist as any,
    followUpTemplateId: tplCare.id, careProcessInstanceId: careInst.id, processStepId: tplCare.steps[2].id, processVersion: tplCare.version,
    stepSnapshot: careSnap(tplCare.steps[2]) as any, priority: "NORMAL", status: "OPEN", createdBy: "Lê Thị CSKH",
  } });
  // --- Giá sàn (mục 25–26): khai báo chi phí cấu thành cho dịch vụ RF ---
  // Chi phí: nhân sự 700k (KTV+master) + vận hành 150k + khấu hao 200k + vật tư 250k
  // + phòng 100k = 1.400.000; biên tối thiểu 15% → giá sàn 1.610.000 (giá chuẩn RF
  // 1.800.000 > sàn: OK). Bán < 1.610.000 sẽ bị chặn/cần duyệt.
  await prisma.servicePriceFloor.create({
    data: { serviceId: svcRF.id, laborCost: 700_000, operationCost: 150_000, depreciationCost: 200_000, materialCost: 250_000, roomCost: 100_000, minMarginPercent: 15, updatedBy: "Trần Quản Lý" },
  });

  // --- Nhân sự (mục 8, mở rộng từ mục 22–24): master data đa vai trò + phí có
  // hiệu lực + năng lực + lịch làm việc + nghỉ phép ---
  const hrTechRF = await prisma.technology.findFirst({ where: { name: { contains: "RF" } }, select: { id: true, name: true } });
  const hrTechHIFU = await prisma.technology.findFirst({ where: { name: { contains: "HIFU" } }, select: { id: true, name: true } });
  const nvKTV = await prisma.employee.create({ data: { code: "NV-000001", fullName: "Phạm Chuyên Viên", phone: "0911000001", email: "chuyenvien@sophia.com.vn", title: "Chuyên viên da", branch: "CS1", startDate: new Date("2024-03-01"), status: "ACTIVE", roles: ["Kỹ thuật viên", "Tư vấn"], defaultFee: 200_000 } });
  const nvMaster = await prisma.employee.create({ data: { code: "NV-000002", fullName: "Trần Quản Lý", phone: "0911000002", title: "Master/Quản lý", branch: "CS1", startDate: new Date("2023-01-10"), status: "ACTIVE", roles: ["Master", "Quản lý", "Kiểm tra"], defaultFee: 500_000 } });
  await prisma.employee.create({ data: { code: "NV-000003", fullName: "Lê Thị CSKH", phone: "0911000003", title: "CSKH", branch: "CS1", status: "ACTIVE", roles: ["CSKH", "Lễ tân"], defaultFee: 100_000 } });
  const nvSale = await prisma.employee.create({ data: { code: "NV-000004", fullName: "Đỗ Thu Ngân", phone: "0911000004", title: "Thu ngân/Lễ tân", branch: "CS1", status: "ACTIVE", roles: ["Sales", "Lễ tân"], defaultFee: 100_000 } });
  // Nhân sự đã NGHỈ VIỆC (mục 16): không được phân công booking/session mới; lịch sử giữ.
  await prisma.employee.create({ data: { code: "NV-000005", fullName: "Ngô Nghỉ Việc", phone: "0911000005", title: "KTV (cũ)", branch: "CS1", status: "RESIGNED", roles: ["Kỹ thuật viên"], defaultFee: 200_000 } });
  // Nhân viên Sophia spa STT 10 & 11 (theo Bảng lương THNG T07.2026 — chỉ lấy 2 NV spa).
  const nvKieu = await prisma.employee.create({ data: { code: "NV-000010", fullName: "Lê Diễm Kiều", title: "Nhân viên Spa", branch: "CS1", status: "ACTIVE", roles: ["Kỹ thuật viên", "Spa"], defaultFee: 30_000 } });
  const nvThanh = await prisma.employee.create({ data: { code: "NV-000011", fullName: "Thạch Thị Thanh", title: "Nhân viên Spa", branch: "CS1", status: "ACTIVE", roles: ["Kỹ thuật viên", "Spa"], defaultFee: 30_000 } });

  // --- HR-PH1 (demo): Branch master + branchId + employmentType + liên kết tài khoản ---
  // Chi nhánh chuẩn hóa từ chuỗi legacy "CS1"; giữ nguyên Employee.branch (String).
  const branchCS1 = await prisma.branch.upsert({
    where: { code: "CN-0001" },
    update: {},
    create: { code: "CN-0001", name: "CS1", timezone: "Asia/Ho_Chi_Minh", address: "Trụ sở chính", isActive: true },
  });
  await prisma.employee.updateMany({ where: { branch: "CS1" }, data: { branchId: branchCS1.id, employmentType: "MONTHLY" } });
  // Liên kết TÙY CHỌN 1-1 tài khoản đăng nhập ↔ hồ sơ nhân sự (self-view). Không tạo mới, không suy quyền.
  const cashierUser = await prisma.user.findUnique({ where: { email: "thungan@sophia.com.vn" } }).catch(() => null);
  if (cashierUser) {
    const already = await prisma.employee.findUnique({ where: { userId: cashierUser.id } }).catch(() => null);
    if (!already) await prisma.employee.update({ where: { code: "NV-000004" }, data: { userId: cashierUser.id } });
  }

  // HR-PH3 — demo đóng góp nhân sự thực tế cho buổi SS-100001 (2 nhân sự, có phút + trọng số).
  {
    const { ensureContributionTypes } = await import("../src/lib/contribution-service");
    await ensureContributionTypes();
    const tPrimary = await prisma.staffContributionType.findUnique({ where: { code: "PRIMARY_OPERATOR" } });
    const tMaster = await prisma.staffContributionType.findUnique({ where: { code: "MASTER_SUPERVISION" } });
    const exists = await prisma.sessionStaffContribution.count({ where: { treatmentSessionId: sLinh1.id } });
    if (exists === 0) {
      await prisma.sessionStaffContribution.create({ data: { treatmentSessionId: sLinh1.id, employeeId: nvKTV.id, employeeNameSnapshot: nvKTV.fullName, employeeRoleSnapshot: nvKTV.title, contributionTypeId: tPrimary?.id ?? null, contributionTypeCode: "PRIMARY_OPERATOR", actualMinutes: 45, weight: 0.7, status: "ACTIVE", source: "MANUAL", createdBy: "seed" } });
      await prisma.sessionStaffContribution.create({ data: { treatmentSessionId: sLinh1.id, employeeId: nvMaster.id, employeeNameSnapshot: nvMaster.fullName, employeeRoleSnapshot: nvMaster.title, contributionTypeId: tMaster?.id ?? null, contributionTypeCode: "MASTER_SUPERVISION", actualMinutes: 15, weight: 0.3, status: "ACTIVE", source: "MANUAL", createdBy: "seed" } });
    }
  }

  // Phí theo vai trò (mục 4): mỗi vai trò một mức; có HIỆU LỰC theo ngày (mục 5).
  await prisma.employeeRoleFee.createMany({ data: [
    { employeeId: nvKTV.id, role: "KTV chính", fee: 250_000, effectiveFrom: new Date("2024-03-01"), createdBy: "Trần Quản Lý" },
    { employeeId: nvKTV.id, role: "Hỗ trợ", fee: 100_000, effectiveFrom: new Date("2024-03-01"), createdBy: "Trần Quản Lý" },
    // Master: 500k đến hết 31/08/2026, từ 01/09/2026 tăng 600k (bản cũ đóng hạn) — mục 5.
    // effectiveTo = mốc EXCLUSIVE (bản 600k áp dụng TỪ 01/09) → ngày cuối còn hiệu lực = 31/08.
    { employeeId: nvMaster.id, role: "Master", fee: 500_000, effectiveFrom: new Date("2023-01-10"), effectiveTo: new Date("2026-09-01"), createdBy: "Ban giám đốc" },
    { employeeId: nvMaster.id, role: "Master", fee: 600_000, effectiveFrom: new Date("2026-09-01"), createdBy: "Ban giám đốc" },
    { employeeId: nvMaster.id, role: "Kiểm tra", fee: 200_000, effectiveFrom: new Date("2023-01-10"), createdBy: "Ban giám đốc" },
  ] });

  // Năng lực (mục 6): Phạm Chuyên Viên làm RF + HIFU + Facial.
  await prisma.employeeCompetence.createMany({ data: [
    { employeeId: nvKTV.id, kind: "TECHNOLOGY", refId: hrTechRF?.id ?? null, name: hrTechRF?.name ?? "RF" },
    { employeeId: nvKTV.id, kind: "TECHNOLOGY", refId: hrTechHIFU?.id ?? null, name: hrTechHIFU?.name ?? "HIFU" },
    { employeeId: nvKTV.id, kind: "SERVICE", refId: svcRF.id, name: "RF nâng cơ mặt" },
    { employeeId: nvKTV.id, kind: "SERVICE", refId: svcHIFU.id, name: "Nâng cơ HIFU" },
    // Master có năng lực HIFU (công nghệ + dịch vụ) — để demo lọc năng lực khác nhau.
    { employeeId: nvMaster.id, kind: "TECHNOLOGY", refId: hrTechHIFU?.id ?? null, name: hrTechHIFU?.name ?? "HIFU" },
    { employeeId: nvMaster.id, kind: "SERVICE", refId: svcHIFU.id, name: "Nâng cơ HIFU" },
    // NV-000004 khai báo năng lực CHỈ RF (không HIFU) → bị LOẠI khỏi gợi ý HIFU (demo lọc năng lực).
    { employeeId: nvSale.id, kind: "SERVICE", refId: svcRF.id, name: "RF nâng cơ mặt" },
  ] });

  // Chứng nhận (mục 7): 1 còn hạn + 1 đã hết hạn (để hiện cảnh báo).
  await prisma.employeeCertification.createMany({ data: [
    { employeeId: nvKTV.id, name: "Chứng chỉ vận hành HIFU", issuer: "Hãng ABC", issuedAt: new Date("2025-01-15"), expiresAt: new Date("2027-01-15") },
    { employeeId: nvKTV.id, name: "Chứng chỉ Laser cơ bản", issuer: "Sở Y tế", issuedAt: new Date("2023-06-01"), expiresAt: new Date("2025-06-01") },
  ] });

  // Lịch làm việc (mục 8): T2–T6, 08:00–17:00.
  await prisma.employeeSchedule.createMany({ data: [1, 2, 3, 4, 5].map((d) => ({ employeeId: nvKTV.id, dayOfWeek: d, startTime: "08:00", endTime: "17:00", shift: "Hành chính" })) });
  await prisma.employeeSchedule.createMany({ data: [1, 2, 3, 4, 5, 6].map((d) => ({ employeeId: nvMaster.id, dayOfWeek: d, startTime: "09:00", endTime: "18:00" })) });

  // Nghỉ phép (mục 9,22): Phạm Chuyên Viên nghỉ 20/08/2026 08:00–12:00 (giờ VN).
  // Lưu wall-clock VN (đóng Z) đồng nhất với Lịch hẹn/Buổi — xem src/lib/timezone.ts.
  await prisma.employeeLeave.create({ data: { employeeId: nvKTV.id, type: "ANNUAL", fromAt: vnts("2026-08-20T08:00:00"), toAt: vnts("2026-08-20T12:00:00"), reason: "Nghỉ phép cá nhân buổi sáng", createdBy: "Trần Quản Lý" } });

  // Phân công buổi RF #1: KTV chính + Master kiểm tra (fee SNAPSHOT — buổi cũ không đổi khi phí master đổi).
  // Buổi 1 thực hiện 25/07/2026 (trước 01/09) → phí Kiểm tra theo biểu HIỆN HÀNH lúc đó = 200k (snapshot).
  await prisma.sessionStaff.create({ data: { sessionId: sLinh1.id, employeeId: nvKTV.id, staffName: nvKTV.fullName, role: "PRIMARY", fee: 250_000 } });
  await prisma.sessionStaff.create({ data: { sessionId: sLinh1.id, employeeId: nvMaster.id, staffName: nvMaster.fullName, role: "CHECKER", fee: 200_000 } });

  // --- GIÁ SÀN v2 (mục 7): cost breakdown theo dòng + version + duyệt ---
  async function publishFloor(versionId: string) {
    await transitionFloorVersion(versionId, "submit", { canApprove: true });
    await transitionFloorVersion(versionId, "approve", { actor: "Trần Quản Lý", canApprove: true });
    await transitionFloorVersion(versionId, "activate", { actor: "Trần Quản Lý", canApprove: true });
  }
  // RF: V1 — Vật tư 250k + Nhân sự 400k + Máy 300k + Vận hành 100k + Khác 50k = 1.100.000;
  // biên 30% → giá sàn 1.572.000 (giá chuẩn 1.800.000 > sàn). ACTIVE.
  const rfV1 = await createFloorVersion({
    serviceId: svcRF.id, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000, createdBy: "Trần Quản Lý",
    changeReason: "Thiết lập giá sàn ban đầu",
    lines: [
      { category: "MATERIAL", name: "Gel dẫn RF", quantity: 1, unit: "lần", unitCost: 250_000, calcType: "FIXED", source: "Định mức dịch vụ" },
      { category: "STAFF", name: "Kỹ thuật viên chính", quantity: 1, unit: "người", unitCost: 400_000, calcType: "FIXED", source: "Fee vai trò" },
      { category: "MACHINE", name: "Máy RF #1", quantity: 1, unit: "buổi", calcType: "PER_SESSION", calcValue: 300_000, source: "Cấu hình dịch vụ" },
      { category: "OPERATION", name: "Vận hành (điện/nước/quản lý)", quantity: 1, calcType: "FIXED", calcValue: 100_000 },
      { category: "OTHER", name: "Chi phí khác", quantity: 1, unitCost: 50_000, calcType: "FIXED" },
    ],
  });
  await publishFloor(rfV1.id);
  // RF: V2 — giá gel tăng 250k→350k → tổng 1.200.000 → giá sàn 1.715.000. V1 hết hiệu lực.
  const rfV2 = await createFloorVersion({
    serviceId: svcRF.id, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000, createdBy: "Trần Quản Lý",
    changeReason: "Giá gel dẫn RF tăng từ 250.000 lên 350.000",
    lines: [
      { category: "MATERIAL", name: "Gel dẫn RF", quantity: 1, unit: "lần", unitCost: 350_000, calcType: "FIXED", source: "Định mức dịch vụ" },
      { category: "STAFF", name: "Kỹ thuật viên chính", quantity: 1, unit: "người", unitCost: 400_000, calcType: "FIXED", source: "Fee vai trò" },
      { category: "MACHINE", name: "Máy RF #1", quantity: 1, unit: "buổi", calcType: "PER_SESSION", calcValue: 300_000, source: "Cấu hình dịch vụ" },
      { category: "OPERATION", name: "Vận hành (điện/nước/quản lý)", quantity: 1, calcType: "FIXED", calcValue: 100_000 },
      { category: "OTHER", name: "Chi phí khác", quantity: 1, unitCost: 50_000, calcType: "FIXED" },
    ],
  });
  await publishFloor(rfV2.id);

  // HIFU: V1 — vật tư 2 tuýp×80k=160k + KTV 250k + Master 500k + Máy 300k + Phòng 100k +
  // Overhead 10% chi phí trực tiếp (131k) = 1.441.000; biên 30% → giá sàn 2.059.000. ACTIVE.
  const hifuV1 = await createFloorVersion({
    serviceId: svcHIFU.id, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000, createdBy: "Trần Quản Lý",
    changeReason: "Thiết lập giá sàn HIFU",
    lines: [
      { category: "MATERIAL", name: "Gel siêu âm HIFU", quantity: 2, unit: "tuýp", unitCost: 80_000, calcType: "FIXED", source: "Định mức dịch vụ" },
      { category: "STAFF", name: "Kỹ thuật viên chính", quantity: 1, unit: "người", unitCost: 250_000, calcType: "FIXED", source: "Fee vai trò" },
      { category: "STAFF", name: "Master", quantity: 1, unit: "người", unitCost: 500_000, calcType: "FIXED", source: "Fee vai trò" },
      { category: "MACHINE", name: "Máy HIFU #1", quantity: 1, unit: "buổi", calcType: "PER_SESSION", calcValue: 300_000, source: "Cấu hình dịch vụ" },
      { category: "ROOM", name: "Phòng điều trị", quantity: 1, unit: "buổi", calcType: "PER_SESSION", calcValue: 100_000, source: "Cấu hình dịch vụ" },
      { category: "OPERATION", name: "Overhead (10% chi phí trực tiếp)", calcType: "PERCENT_DIRECT", calcValue: 10 },
    ],
  });
  await publishFloor(hifuV1.id);

  // --- Đánh giá sau buổi (mục 36–37) ---
  await prisma.sessionReview.create({
    data: {
      sessionId: sLinh1.id, customerId: kDangPD.id, satisfactionScore: 5, technicianScore: 5, technicianName: "Phạm Chuyên Viên",
      comment: "Rất hài lòng, da săn chắc rõ.", wouldReturn: true,
      technicianReport: "Da đáp ứng tốt với RF, không kích ứng. Đề xuất buổi HIFU đúng lịch.", reviewedBy: "Lê Thị CSKH",
    },
  });
  // Buổi 2 (Chuẩn bị) — hoàn thành, khớp kế hoạch (RF).
  const sLinh2 = await prisma.treatmentSession.create({
    data: {
      code: "SS-100002",
      planId: planLinh.id, stageId: planLinh.stages[0].id, customerId: kDangPD.id, serviceId: svcRF.id,
      sessionNumber: 2, name: "RF làm sạch nền da buổi 2", status: "COMPLETED",
      plannedServiceId: svcRF.id, plannedTechnologyId: techRF.id, plannedProtocolId: protoDemo.id, technologyId: techRF.id, brandProtocolId: protoDemo.id,
      plannedDate: new Date("2026-08-27"), scheduledAt: vnts("2026-08-27T07:00:00"), performedAt: vnts("2026-08-27T07:15:00"), performer: "Phạm Chuyên Viên",
      plannedMaterials: { text: "Gel RF 5 ml" }, actualMaterials: { text: "Gel RF 5 ml" }, plannedCost: 500_000, actualCost: 500_000, price: 1_800_000, checkedBy: "Trần Quản Lý", versionAtExecution: 1,
    },
  });
  // Buổi 3 (Can thiệp) — MINH HỌA Kế hoạch ≠ Thực tế (mục 14–15) + Session đầy đủ (mục 5):
  // Kế hoạch: RF · Protocol A (GLOW) · vật tư 5 ml. Thực tế: HIFU · Protocol B (LIFT) · vật tư 7 ml.
  const sLinh3 = await prisma.treatmentSession.create({
    data: {
      code: "SS-100003",
      planId: planLinh.id, stageId: planLinh.stages[1].id, customerId: kDangPD.id,
      sessionNumber: 3, name: "Nâng cơ buổi 3", status: "COMPLETED",
      // Kế hoạch (snapshot, không đổi):
      plannedServiceId: svcRF.id, plannedTechnologyId: techRF.id, plannedProtocolId: protoDemo.id,
      plannedDate: new Date("2026-09-03"), plannedParams: { text: "RF 42°C, 3 line" }, plannedMaterials: { text: "Gel RF 5 ml" }, plannedCost: 500_000,
      // B — Trước khi thực hiện:
      conditionBefore: "Đường hàm chưa gọn, da vùng má chùng nhẹ", prevReaction: "Sau buổi 2 da hơi ửng nhẹ, hết sau 1 ngày", todayWish: "Muốn gọn đường hàm rõ hơn",
      warnings: "Da vùng má nhạy cảm nhẹ — giảm mức năng lượng, theo dõi phản ứng sau bắn", currentMeds: "Vitamin C uống",
      // C — Thực tế (đổi so với kế hoạch):
      serviceId: svcHIFU.id, technologyId: techHIFU.id, brandProtocolId: protoLift.id, treatmentArea: "Đường hàm 2 bên + dưới cằm",
      actualStartAt: vnts("2026-09-03T07:00:00"), actualEndAt: vnts("2026-09-03T08:00:00"),
      scheduledAt: vnts("2026-09-03T07:00:00"), performedAt: vnts("2026-09-03T07:20:00"), performer: "Phạm Chuyên Viên",
      objective: "Chuyển sang HIFU do da đáp ứng tốt", actualParams: { text: "HIFU 4.5mm, 3 line, mức 1.0J" }, actualMaterials: { text: "Gel siêu âm 7 ml" }, actualCost: 700_000,
      steps: { items: [{ name: "Đánh dấu vùng" }, { name: "Bắn HIFU theo line" }, { name: "Làm dịu & dặn dò" }] },
      // F — Sau khi thực hiện:
      conditionAfter: "Gọn hơn rõ, không sưng", customerFeedback: "Rất hài lòng", nextSuggestion: "Buổi 4 RF củng cố sau 7 ngày", followUpDate: new Date("2026-09-05"),
      price: 6_000_000, checkedBy: "Trần Quản Lý", versionAtExecution: 1,
    },
  });
  // Nhân sự buổi 3 (mục 35): KTV chính + Master + Hỗ trợ (phí snapshot).
  // Buổi 3 thực hiện 03/09/2026 (SAU 01/09) → phí Master theo biểu HIỆN HÀNH lúc đó = 600k (snapshot).
  // Đây là bằng chứng snapshot theo NGÀY DỊCH VỤ: buổi cũ (25/07) Master/Kiểm tra rate cũ; buổi 3
  // (03/09) Master 600k. Đổi phí master về sau KHÔNG đổi các buổi này.
  await prisma.sessionStaff.create({ data: { sessionId: sLinh3.id, employeeId: nvKTV.id, staffName: nvKTV.fullName, role: "PRIMARY", fee: 250_000 } });
  await prisma.sessionStaff.create({ data: { sessionId: sLinh3.id, employeeId: nvMaster.id, staffName: nvMaster.fullName, role: "MASTER", fee: 600_000 } });
  await prisma.sessionStaff.create({ data: { sessionId: sLinh3.id, employeeId: nvSale.id, staffName: nvSale.fullName, role: "ASSISTANT", fee: 100_000 } });
  // Before/After buổi 3: 1 ảnh chia sẻ khách + 1 ảnh nội bộ (mục 36).
  await writeBlob("demo/before-linh3.png", PNG_BEFORE);
  await writeBlob("demo/after-linh3.png", PNG_AFTER);
  await prisma.mediaAsset.createMany({ data: [
    { storageKey: "demo/before-linh3.png", filename: "truoc-buoi3.png", contentType: "image/png", size: 70, kind: "BEFORE_IMAGE", customerId: kDangPD.id, sessionId: sLinh3.id, sharedWithCustomer: true, uploadedBy: "Phạm Chuyên Viên" },
    { storageKey: "demo/after-linh3.png", filename: "sau-buoi3-noibo.png", contentType: "image/png", size: 70, kind: "AFTER_IMAGE", customerId: kDangPD.id, sessionId: sLinh3.id, sharedWithCustomer: false, uploadedBy: "Phạm Chuyên Viên" },
  ] });
  // Đánh giá + báo cáo nội bộ buổi 3 (mục 25-26).
  await prisma.sessionReview.create({ data: { sessionId: sLinh3.id, customerId: kDangPD.id, satisfactionScore: 5, technicianScore: 5, technicianName: "Phạm Chuyên Viên", comment: "Rất ưng, đường hàm gọn.", wouldReturn: true, technicianReport: "Da đáp ứng tốt HIFU, đề xuất giữ HIFU cho buổi can thiệp còn lại.", reviewedBy: "Phạm Chuyên Viên" } });
  // Buổi 4 (Can thiệp) — buổi DỰ KIẾN đã có LỊCH HẸN (mục 12): minh họa liên kết Buổi ↔ Booking.
  const bkLinh3 = await prisma.booking.create({
    data: { code: "BK-100020", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: vnts("2026-09-10T07:00:00"), durationMinutes: 60, room: "Phòng 2", technician: "Phạm Chuyên Viên", status: "CONFIRMED", confirmedAt: vnts("2026-09-05T02:00:00"), price: 1_800_000, createdBy: "Nguyễn Lễ Tân", planId: planLinh.id, stageId: planLinh.stages[1].id, sessionNumber: 4 },
  });
  await prisma.treatmentSession.create({
    data: {
      planId: planLinh.id, stageId: planLinh.stages[1].id, customerId: kDangPD.id, bookingId: bkLinh3.id, serviceId: svcRF.id,
      sessionNumber: 4, name: "RF nâng cơ buổi 4", status: "PLANNED", scheduledAt: vnts("2026-09-10T07:00:00"),
      plannedServiceId: svcRF.id, plannedTechnologyId: techRF.id, plannedProtocolId: protoDemo.id,
      plannedDate: new Date("2026-09-10"), objective: "RF vùng má buổi 4", plannedParams: { text: "RF 42°C" }, plannedMaterials: { text: "Gel RF 5 ml" }, plannedCost: 500_000, price: 1_800_000,
    },
  });
  // Buổi 5–8 dự kiến (chưa lên lịch) — đủ 8 buổi: Chuẩn bị 2 · Can thiệp 4 · Phục hồi 1 · Duy trì 1.
  for (const [num, stageIdx, plannedDate] of [[5, 1, "2026-09-17"], [6, 1, "2026-09-24"], [7, 2, "2026-10-08"], [8, 3, "2026-11-08"]] as const) {
    await prisma.treatmentSession.create({
      data: {
        planId: planLinh.id, stageId: planLinh.stages[stageIdx].id, customerId: kDangPD.id, serviceId: svcRF.id,
        sessionNumber: num, name: `Buổi ${num} (dự kiến)`, status: "PLANNED",
        plannedServiceId: svcRF.id, plannedTechnologyId: techRF.id, plannedProtocolId: protoDemo.id,
        plannedDate: new Date(plannedDate), plannedMaterials: { text: "Gel RF 5 ml" }, plannedCost: 500_000, price: 1_800_000,
      },
    });
  }
  // TẠO PHIÊN BẢN V2 (mục 16–19): lý do bắt buộc; buổi đã hoàn thành ghim ở V1 (đã set versionAtExecution=1).
  await prisma.treatmentPlanVersion.create({
    data: {
      planId: planLinh.id, fromVersion: 1, toVersion: 2,
      reason: "Khách đáp ứng chậm hơn dự kiến, cần kéo dài giai đoạn phục hồi.",
      summary: "Thêm 1 buổi phục hồi; đổi Protocol buổi can thiệp sang HIFU.",
      createdBy: "Phạm Chuyên Viên",
    },
  });
  await prisma.treatmentPlan.update({
    where: { id: planLinh.id },
    data: { version: 2, changeLog: { items: [{ fromVersion: 1, toVersion: 2, reason: "Khách đáp ứng chậm hơn dự kiến, cần kéo dài giai đoạn phục hồi.", changedBy: "Phạm Chuyên Viên", at: vnts("2026-09-05T02:00:00").toISOString() }] } },
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
    data: { kind: "POST_CARE", title: "Dặn dò sau RF buổi 1", content: "Uống đủ nước, tránh nắng, dùng chống nắng SPF50, không xông hơi 3 ngày.", customerId: kDangPD.id, sessionId: sLinh1.id, deliveredVia: "ZALO", deliveredAt: vnts("2026-07-25T10:00:00"), providedBy: "Lê Thị CSKH" },
  });
  // --- Việc follow-up CSKH đang chờ ---
  await prisma.task.create({
    data: { title: "Gọi hỏi thăm sau RF buổi 1", customerId: kDangPD.id, assignee: "Lê Thị CSKH", dueDate: vnts("2026-08-19T02:00:00"), priority: "NORMAL", status: "OPEN", channel: "ZALO", createdBy: "Lê Thị CSKH" },
  });
  // --- Lịch hẹn SẮP TỚI (HIFU buổi 2) — LIÊN KẾT PHÁC ĐỒ (Case 7) ---
  await prisma.booking.create({
    data: {
      code: "BK-100004", customerId: kDangPD.id, serviceId: svcHIFU.id, scheduledAt: vnts("2026-08-20T07:00:00"), durationMinutes: 60,
      room: "Phòng 3", bed: "Giường B", machine: "Máy HIFU #1", technician: "Phạm Chuyên Viên", master: "Trần Quản Lý", performer: "Phạm Chuyên Viên",
      status: "CONFIRMED", confirmedAt: vnts("2026-08-15T02:00:00"), price: 6_000_000, createdBy: "Nguyễn Lễ Tân",
      planId: planLinh.id, stageId: planLinh.stages[1].id, sessionNumber: 2, assistants: ["Đỗ Thu Ngân"],
    },
  });
  // --- Lịch hẹn ĐÃ ĐỔI LỊCH (Case 5) — có lịch sử đổi lịch ---
  await prisma.booking.create({
    data: {
      code: "BK-100005", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: vnts("2026-08-22T09:00:00"), durationMinutes: 60,
      room: "Phòng 2", technician: "Phạm Chuyên Viên", status: "CONFIRMED", price: 1_800_000, createdBy: "Nguyễn Lễ Tân",
      rescheduleHistory: [
        { from: vnts("2026-08-22T07:00:00").toISOString(), to: vnts("2026-08-22T09:00:00").toISOString(), oldResources: "KTV Phạm Chuyên Viên, Phòng 2", newResources: "KTV Phạm Chuyên Viên, Phòng 2", by: "Nguyễn Lễ Tân", at: vnts("2026-08-16T03:00:00").toISOString(), reason: "Khách bận buổi sáng sớm" },
      ],
    },
  });
  // --- Lịch hẹn ĐẶT ĐÈ trùng lịch có LÝ DO (Case 6) — chỉ người có quyền mới đè ---
  await prisma.booking.create({
    data: {
      code: "BK-100006", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: vnts("2026-08-20T07:30:00"), durationMinutes: 60,
      technician: "Phạm Chuyên Viên", room: "Phòng 1", status: "CONFIRMED", price: 1_800_000, createdBy: "Trần Quản Lý",
      overrideLog: [
        { by: "Trần Quản Lý", at: vnts("2026-08-17T04:00:00").toISOString(), reason: "Khách VIP yêu cầu đúng khung giờ", conflicts: ['Kỹ thuật viên "Phạm Chuyên Viên" (BK-100004)'] },
      ],
    },
  });

  // --- Danh mục TÀI NGUYÊN (Phòng/Giường/Máy) cho dropdown form Lịch hẹn ---
  const rP1 = await prisma.bookingResource.create({ data: { code: "PH-000001", name: "Phòng 1", type: "ROOM" } });
  const rP2 = await prisma.bookingResource.create({ data: { code: "PH-000002", name: "Phòng 2", type: "ROOM" } });
  await prisma.bookingResource.create({ data: { code: "PH-000003", name: "Phòng 3", type: "ROOM" } });
  await prisma.bookingResource.createMany({ data: [
    { code: "GI-000001", name: "Giường A", type: "BED", parentId: rP1.id },
    { code: "GI-000002", name: "Giường B", type: "BED", parentId: rP2.id },
  ] });
  await prisma.bookingResource.createMany({ data: [
    { code: "MAY-000001", name: "Máy RF #1", type: "MACHINE" },
    { code: "MAY-000002", name: "Máy RF #2", type: "MACHINE" },
    { code: "MAY-000003", name: "Máy HIFU #1", type: "MACHINE" },
  ] });

  // --- Lịch hẹn HÔM NAY (2026-08-13) đủ TRẠNG THÁI để xem View Ngày (mục 7–8) ---
  const KTV = "Phạm Chuyên Viên";
  const day = (h: number) => vnts(`2026-08-13T${String(h).padStart(2, "0")}:00:00`);
  await prisma.booking.create({ data: { code: "BK-100010", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(8), durationMinutes: 60, technician: KTV, room: "Phòng 1", status: "NEW", price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100011", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(9), durationMinutes: 60, technician: KTV, room: "Phòng 1", status: "CONFIRMED", confirmedAt: day(8), price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100012", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(10), durationMinutes: 60, technician: KTV, room: "Phòng 2", status: "ARRIVED", checkedInAt: day(10), price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100013", customerId: kDangPD.id, serviceId: svcHIFU.id, scheduledAt: day(11), durationMinutes: 60, technician: KTV, master: "Trần Quản Lý", room: "Phòng 3", machine: "Máy HIFU #1", status: "IN_PROGRESS", startedAt: day(11), price: 6_000_000, createdBy: "Nguyễn Lễ Tân", planId: planLinh.id, stageId: planLinh.stages[1].id, sessionNumber: 4, assistants: ["Đỗ Thu Ngân"] } });
  await prisma.booking.create({ data: { code: "BK-100014", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(13), durationMinutes: 60, technician: KTV, room: "Phòng 2", status: "COMPLETED", completedAt: day(14), price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100015", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(14), durationMinutes: 60, technician: "Lê Thị CSKH", room: "Phòng 1", status: "CANCELLED", cancelReason: "Khách báo bận đột xuất", cancelledBy: "Nguyễn Lễ Tân", cancelledAt: day(9), price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100016", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(15), durationMinutes: 60, technician: "Lê Thị CSKH", room: "Phòng 2", status: "NO_SHOW", noShowReason: "Không liên lạc được", noShowBy: "Nguyễn Lễ Tân", noShowAt: day(16), price: 1_800_000, createdBy: "Nguyễn Lễ Tân" } });
  await prisma.booking.create({ data: { code: "BK-100017", customerId: kDangPD.id, serviceId: svcRF.id, scheduledAt: day(16), durationMinutes: 60, technician: KTV, room: "Phòng 3", status: "CONFIRMED", confirmedAt: day(12), price: 1_800_000, createdBy: "Nguyễn Lễ Tân",
    rescheduleHistory: [ { from: vnts("2026-08-13T07:00:00").toISOString(), to: vnts("2026-08-13T16:00:00").toISOString(), oldResources: `KTV ${KTV}, Phòng 3`, newResources: `KTV ${KTV}, Phòng 3`, by: "Nguyễn Lễ Tân", at: vnts("2026-08-12T03:00:00").toISOString(), reason: "Khách yêu cầu đổi giờ sang chiều" } ] } });

  // === Redesign P3 · Booking NHIỀU dịch vụ (1 lần đến = 3 dịch vụ tuần tự) ===
  if (svcDmkForCompose && !(await prisma.booking.findUnique({ where: { code: "BK-100030" } }))) {
    const items = [svcDmkForCompose, svcLaserPico, svcRecovery];
    const total = items.reduce((s, x) => s + (x.durationMinutes ?? 0), 0); // 83+30+15 = 128
    await prisma.booking.create({
      data: {
        code: "BK-100030", customerId: kDangPD.id, serviceId: svcDmkForCompose.id, scheduledAt: day(17),
        durationMinutes: total, technician: KTV, room: "Phòng 1", status: "CONFIRMED", confirmedAt: day(16),
        price: Number(svcDmkForCompose.standardPrice), createdBy: "Nguyễn Lễ Tân",
        note: "Điều trị sắc tố kết hợp: DMK Enzyme + Laser Pico + Recovery",
        items: {
          create: items.map((s, i) => ({
            sortOrder: i, serviceId: s.id, durationSnapshot: s.durationMinutes,
            priceSnapshot: Number(s.standardPrice), note: i === 2 ? "Tùy chọn nếu da nhạy cảm" : null,
          })),
        },
      },
    });

    // === Redesign P4 · WALK-IN session (planId NULL) + 3 execution items + snapshot đông cứng ===
    const bk30 = await prisma.booking.findUnique({ where: { code: "BK-100030" }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (bk30 && !(await prisma.treatmentSession.findFirst({ where: { code: "SS-100030" } }))) {
      const wsess = await prisma.treatmentSession.create({
        data: {
          code: "SS-100030", planId: null, customerId: kDangPD.id, bookingId: bk30.id, sessionNumber: 1,
          name: "Walk-in điều trị sắc tố kết hợp", status: "COMPLETED", performer: KTV, performedAt: day(17),
          serviceId: svcDmkForCompose.id, executionFrozenAt: day(17),
          executionSnapshot: { frozenAt: day(17).toISOString(), itemCount: 3, note: "Walk-in 3 dịch vụ" } as any,
        },
      });
      // 3 execution item (thực tế đã làm) — mỗi item đông cứng snapshot riêng
      for (const [i, it] of bk30.items.entries()) {
        const svc = items[i];
        await prisma.sessionExecutionItem.create({
          data: {
            sessionId: wsess.id, bookingItemId: it.id, serviceId: it.serviceId, sortOrder: i,
            selectedOptionSource: i === 0 ? "SERVICE_SOP_OPTION" : "PRACTITIONER_ADHOC",
            selectedOptionName: i === 0 ? "Enzyme #1 (thực tế, khác đề xuất #2)" : null,
            sourceVersion: svc?.version ?? 1,
            executionSnapshot: {
              capturedAt: day(17).toISOString(),
              source: { kind: "SERVICE", id: it.serviceId, code: svc?.code, name: svc?.name, version: svc?.version ?? 1 },
              option: { source: i === 0 ? "SERVICE_SOP_OPTION" : "PRACTITIONER_ADHOC", name: i === 0 ? "Enzyme #1" : null, classification: null },
              actualValues: i === 0 ? [{ stepName: "Đắp Enzyme", productName: "Enzyme #1", qtyStd: 5, qtyActual: 4, unit: "g" }] : [],
            } as any,
          },
        });
      }
    }
  }
  // --- Biểu mẫu đã áp cho khách (snapshot schema, không đổi mẫu gốc) ---
  const skinForm = await prisma.formTemplate.findUnique({ where: { code: "FORM-SKIN-ASSESS" } });
  if (skinForm) {
    await prisma.formInstance.create({
      data: { templateId: skinForm.id, templateVersion: skinForm.version, schemaSnapshot: skinForm.schema as any, customerId: kDangPD.id, planId: planLinh.id, name: "Phiếu đánh giá da – Đỗ Thùy Linh", status: "COMPLETED", completedBy: "Phạm Chuyên Viên", completedAt: vnts("2026-07-25T07:00:00"), createdBy: "Phạm Chuyên Viên" },
    });
  }
  await prisma.crmActivity.create({ data: { customerId: kDangPD.id, type: "CALL", content: "Nhắc lịch HIFU buổi 2, khách xác nhận.", result: "Xác nhận", performedBy: "Lê Thị CSKH", occurredAt: vnts("2026-08-10T03:00:00"), nextAction: "Chuẩn bị phòng HIFU", followUpDate: vnts("2026-08-19T02:00:00"), followUpOwner: "Lê Thị CSKH" } });
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
      acceptedOptionId: chosen.id, acceptedAt: vnts("2026-08-01T02:00:00"), acceptedBy: "Đỗ Thùy Linh", agreedPrice: agreedLinh,
      acceptedSnapshot: { optionId: chosen.id, kind: chosen.kind, name: chosen.name, discount: 400_000, computedTotal: agreedLinh, items: chosen.items.map((it) => ({ itemType: it.itemType, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, isHomeCare: it.isHomeCare })) },
    },
  });
  // Hóa đơn từ báo giá đã chốt (subtotal 12,300,000 − chiết khấu 400,000 = 11,900,000).
  const invLinh = await prisma.invoice.create({
    data: {
      code: "HD-000001", customerId: kDangPD.id, proposalId: proposalLinh.id, proposalOptionId: chosen.id, planId: planLinh.id, status: "PARTIAL",
      subtotal: 12_300_000, discount: 400_000, total: agreedLinh, createdBy: "Đỗ Thu Ngân",
      items: { create: chosen.items.map((it, i) => ({ name: it.name, quantity: it.quantity ?? 1, unitPrice: Number(it.unitPrice ?? 0), amount: Number(it.unitPrice ?? 0) * (it.quantity ?? 1), note: it.isHomeCare ? "Sản phẩm tại nhà" : null, orderIndex: i })) },
    },
  });
  // Báo giá đã chuyển thành hóa đơn → trạng thái CONVERTED (Đã chuyển hóa đơn).
  await prisma.treatmentProposal.update({ where: { id: proposalLinh.id }, data: { status: "CONVERTED" } });
  // Thu 2 đợt vào hóa đơn (tổng 8.000.000 ≤ tổng phải thu 11.900.000) → còn phải
  // thu 3.900.000. Mọi khoản thu đều gắn hóa đơn nên "Đã thanh toán" luôn ≤ "Tổng
  // phải thu" (không có tiền dư trộn vào).
  await prisma.payment.create({ data: { code: "PT-000001", customerId: kDangPD.id, invoiceId: invLinh.id, amount: 5_000_000, method: "TRANSFER", txnRef: "CK20260801", receivedBy: "Đỗ Thu Ngân", note: "Thanh toán đợt 1 hóa đơn nâng cơ", paidAt: vnts("2026-08-01T03:00:00") } });
  await prisma.payment.create({ data: { code: "PT-000002", customerId: kDangPD.id, invoiceId: invLinh.id, amount: 3_000_000, method: "CASH", receivedBy: "Đỗ Thu Ngân", note: "Thanh toán đợt 2 hóa đơn nâng cơ", paidAt: vnts("2026-08-08T03:00:00") } });
  // Phiếu thu ghi nhầm → HỦY (giữ vết, không xóa; KHÔNG tính vào "đã trả").
  // receivedBy = người THU ban đầu (Đỗ Thu Ngân); voidedBy/voidedAt/voidReason = người HỦY /
  // thời điểm / lý do — LƯU RIÊNG, không ghi đè người thu. Kèm bản ghi audit_logs như route ghi.
  const pt3 = await prisma.payment.create({ data: { code: "PT-000003", customerId: kDangPD.id, invoiceId: invLinh.id, amount: 500_000, method: "CASH", receivedBy: "Đỗ Thu Ngân", note: "Thu nhầm — đã hủy", paidAt: vnts("2026-08-08T04:00:00"), voidedAt: vnts("2026-08-08T05:00:00"), voidReason: "Thu nhầm hóa đơn khác", voidedBy: "Trần Quản Lý" } });
  await prisma.auditLog.create({ data: { action: "PAYMENT_VOID", entityType: "Payment", entityId: pt3.id, changes: { code: "PT-000003", reason: "Thu nhầm hóa đơn khác", voidedBy: "Trần Quản Lý", amount: 500_000 } as any } });
  // Tiền cọc lịch hẹn 1.000.000 — ĐANG GIỮ (ACTIVE), có thể phân bổ vào hóa đơn (mục 17).
  await prisma.deposit.create({ data: { code: "DC-000001", customerId: kDangPD.id, amount: 1_000_000, method: "TRANSFER", txnRef: "CK-COC-01", status: "ACTIVE", receivedBy: "Nguyễn Lễ Tân", receivedAt: vnts("2026-08-05T02:00:00"), note: "Cọc giữ chỗ lịch hẹn HIFU" } });
  // Báo giá minh họa ĐỦ 8 TRẠNG THÁI lifecycle (mục 15): đã có SENT (PROP-000001) + CONVERTED
  // (PROP-100001); bổ sung DRAFT/VIEWING/ACCEPTED/REJECTED/EXPIRED/CANCELLED cho khách KH-100004.
  const lifecycleDemo: Array<{ code: string; status: string; title: string; extra?: any }> = [
    { code: "PROP-100002", status: "DRAFT", title: "Nháp gói dưỡng da" },
    { code: "PROP-100003", status: "VIEWING", title: "Khách đang xem gói trẻ hóa" },
    { code: "PROP-100004", status: "ACCEPTED", title: "Đã chốt gói mụn (chưa lập HĐ)", extra: { acceptedAt: vnts("2026-08-12T02:00:00"), acceptedBy: "Đỗ Thùy Linh", agreedPrice: 4_000_000, acceptedSnapshot: { name: "Gói mụn", computedTotal: 4_000_000, items: [{ name: "Facial làm sạch sâu", quantity: 4, unitPrice: 1_000_000 }] } } },
    { code: "PROP-100005", status: "REJECTED", title: "Khách từ chối gói cao cấp" },
    { code: "PROP-100006", status: "EXPIRED", title: "Báo giá hết hiệu lực" },
    { code: "PROP-100007", status: "CANCELLED", title: "Báo giá đã hủy" },
  ];
  for (const bg of lifecycleDemo) {
    await prisma.treatmentProposal.create({
      data: {
        code: bg.code, customerId: kDangPD.id, title: bg.title, status: bg.status as any, createdBy: "Phạm Chuyên Viên",
        ...(bg.extra ?? {}),
        options: { create: [{ kind: "RECOMMENDED", name: "Phương án 1", orderIndex: 0, items: { create: [{ itemType: "SERVICE", name: "Dịch vụ mẫu", quantity: 1, unitPrice: 4_000_000, orderIndex: 0 }] } }] },
      },
    });
  }
  // Báo giá DEMO BÁN DƯỚI GIÁ SÀN (mục 7,26): 1 hạng mục RF nâng cơ mặt, giá niêm yết
  // 1.800.000 — khi chốt 1.600.000 sẽ THẤP HƠN giá sàn hiện hành 1.715.000 (V2).
  // → user thường bị chặn; user có quyền duyệt phải nhập lý do + lưu snapshot/audit.
  await prisma.treatmentProposal.create({
    data: {
      code: "PROP-100008", customerId: kDangPD.id, title: "Báo giá RF (thử bán dưới sàn)", status: "SENT", createdBy: "Phạm Chuyên Viên",
      options: { create: [{ kind: "RECOMMENDED", name: "Gói RF 1 buổi", orderIndex: 0, sessions: 1, items: { create: [{ itemType: "SERVICE", refId: svcRF.id, name: "RF nâng cơ mặt", quantity: 1, unitPrice: 1_800_000, orderIndex: 0 }] } }] },
    },
  });
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
  await prisma.payment.create({ data: { customerId: kXong.id, planId: planChi.id, amount: 6_000_000, method: "CASH", receivedBy: "Đỗ Thu Ngân", note: "Thanh toán đủ phác đồ trị mụn", paidAt: vnts("2026-06-11T09:00:00") } });
  await prisma.crmActivity.create({ data: { customerId: kXong.id, type: "INTERNAL_NOTE", content: "Hoàn thành phác đồ, khách hài lòng, giới thiệu bạn.", result: "Rất hài lòng", performedBy: "Lê Thị CSKH", occurredAt: vnts("2026-07-01T03:00:00") } });

  // 6) ĐANG FOLLOW-UP
  const kFollow = await prisma.customer.create({
    data: { code: "KH-100006", fullName: "Hoàng Yến Nhi", gender: "FEMALE", phone: "0900100006", source: "Facebook", group: "Thường", assignedTo: "Lê Thị CSKH", goals: "Duy trì sau trị nám" },
  });
  await prisma.crmActivity.create({ data: { customerId: kFollow.id, type: "CALL", content: "Follow-up sau 1 tháng, da ổn định, tư vấn duy trì.", result: "Ổn định", performedBy: "Lê Thị CSKH", occurredAt: vnts("2026-08-08T03:00:00"), nextAction: "Mời gói duy trì", followUpDate: vnts("2026-08-22T02:00:00"), followUpOwner: "Lê Thị CSKH" } });
  await prisma.task.create({ data: { title: "Mời khách Yến Nhi gói duy trì hằng tháng", customerId: kFollow.id, assignee: "Lê Thị CSKH", dueDate: vnts("2026-08-22T02:00:00"), priority: "LOW", status: "OPEN", createdBy: "Lê Thị CSKH" } });

  // 7) Khách nam — booking + đánh giá
  const kNam = await prisma.customer.create({
    data: { code: "KH-100007", fullName: "Bùi Tuấn Kiệt", gender: "MALE", phone: "0900100007", source: "Google", group: "Thường", assignedTo: "Nguyễn Lễ Tân", goals: "Trị sẹo rỗ" },
  });
  await prisma.assessment.create({ data: { customerId: kNam.id, name: "Sẹo rỗ hai bên má", area: "Má", severity: "Vừa", description: "Sẹo box/rolling nông", assessedBy: "Phạm Chuyên Viên" } });
  await prisma.booking.create({ data: { code: "BK-100003", customerId: kNam.id, serviceId: svcRF.id, scheduledAt: vnts("2026-08-21T08:00:00"), durationMinutes: 45, room: "Phòng 3", machine: "Máy RF #2", technician: "Phạm Chuyên Viên", performer: "Phạm Chuyên Viên", status: "NEW", price: 1_800_000 } });

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

  // --- Pricing/Costing PH1 — giá vốn dịch vụ DMK (v1 PUBLISHED) ---
  const svcDmkCost = await prisma.service.findUnique({ where: { code: "DV-DMK-ENZ" }, select: { id: true } });
  if (svcDmkCost && (await prisma.serviceCostingVersion.count({ where: { serviceId: svcDmkCost.id } })) === 0) {
    const { createCostingVersion, publishCostingVersion } = await import("../src/lib/service-costing");
    // Vật tư SOP: Cleanser 5×100k + Mist 3×60k = 680k; Nhân sự KTV 200k (defaultFee);
    // Thiết bị 100k; Cơ sở 50k; Overhead PER_MINUTE 1000₫×83′ = 83k → Tổng 1.113.000₫.
    const { version } = await createCostingVersion({
      serviceId: svcDmkCost.id,
      equipmentCost: 100_000, facilityCost: 50_000, otherCost: 0,
      overheadMethod: "PER_MINUTE", overheadValue: 1_000,
      note: "Giá vốn DMK Enzyme (demo PH1)", createdBy: "Trần Quản Lý",
    });
    const pub = await publishCostingVersion(version.id, "Trần Quản Lý");
    console.log("   Giá vốn DMK: v1 PUBLISHED (vật tư 680k + nhân sự 200k + thiết bị 100k + cơ sở 50k + overhead 83k = 1.113.000₫).");

    // PH2 — Giá sàn DMK tạo TỪ Giá vốn v1 (MARGIN 30%) → 1.113.000 / 0.70 ≈ 1.590.000₫ (làm tròn 1000).
    const { createFloorVersionFromCosting, transitionFloorVersion } = await import("../src/lib/price-floor-service");
    const floor = await createFloorVersionFromCosting({ serviceId: svcDmkCost.id, serviceCostingVersionId: pub.version.id, minMarginPercent: 30, changeReason: "Giá sàn từ Giá vốn v1 (demo PH2)", createdBy: "Trần Quản Lý" });
    await transitionFloorVersion(floor.id, "submit", { canApprove: true });
    await transitionFloorVersion(floor.id, "approve", { actor: "Ban giám đốc", canApprove: true });
    await transitionFloorVersion(floor.id, "activate", { actor: "Ban giám đốc", canApprove: true });
    console.log(`   Giá sàn DMK: từ Giá vốn v1, biên 30% → ${Number(floor.floorPrice).toLocaleString("vi-VN")}₫ (ACTIVE, nguồn COSTING_VERSION).`);

    // PH3 — Giá đề xuất DMK: biên MỤC TIÊU 40% → 1.113.000 / 0.60 = 1.855.000₫ (≥ giá sàn).
    const { createRecommendedVersion, publishRecommendedVersion } = await import("../src/lib/recommended-price");
    const rec = await createRecommendedVersion({ serviceId: svcDmkCost.id, serviceCostingVersionId: pub.version.id, targetMarginPercent: 40, note: "Giá đề xuất DMK biên 40% (demo PH3)", createdBy: "Trần Quản Lý" });
    const recPub = await publishRecommendedVersion(rec.id, "Trần Quản Lý");
    console.log(`   Giá đề xuất DMK: biên mục tiêu 40% → ${Number(recPub.calculatedRecommendedPrice).toLocaleString("vi-VN")}₫ (PUBLISHED; giá chuẩn 2.500.000₫).`);
  }

  // --- Pricing PH4 — BookingItem snapshot theo segment khách (VIP) ---
  const svcDmkP4 = await prisma.service.findUnique({ where: { code: "DV-DMK-ENZ" }, select: { id: true, standardPrice: true } });
  const svcPicoP4 = await prisma.service.findUnique({ where: { code: "DV-PICO-01" }, select: { id: true, standardPrice: true } });
  if (svcDmkP4 && svcPicoP4 && !(await prisma.booking.findUnique({ where: { code: "BK-100040" } }))) {
    const { snapshotBookingItems } = await import("../src/lib/booking-items");
    // Bảng giá VIP (thấp hơn giá chuẩn) cho 2 dịch vụ.
    for (const [sid, vip, nm] of [[svcDmkP4.id, 2_100_000, "DMK Enzyme Treatment"], [svcPicoP4.id, 1_500_000, "Laser Pico điều trị sắc tố"]] as const) {
      const has = await prisma.priceRule.findFirst({ where: { targetType: "SERVICE", targetId: sid, priceType: "VIP" } });
      if (!has) await prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: sid, targetName: nm, priceType: "VIP", price: vip, isActive: true, createdBy: "Trần Quản Lý" } });
    }
    // Khách VIP + booking 2 dịch vụ → item snapshot theo giá VIP.
    const kVip = await prisma.customer.upsert({ where: { code: "KH-100010" }, update: { group: "VIP" }, create: { code: "KH-100010", fullName: "Ngô Khách VIP", group: "VIP", phone: "0977000010" } });
    const at = new Date("2026-08-20T02:00:00.000Z");
    const itemsSnap = await snapshotBookingItems([{ serviceId: svcDmkP4.id }, { serviceId: svcPicoP4.id }], { at, customerGroup: "VIP" });
    await prisma.booking.create({ data: { code: "BK-100040", customerId: kVip.id, serviceId: svcDmkP4.id, scheduledAt: at, durationMinutes: 113, price: Number(itemsSnap[0].priceSnapshot ?? 0), status: "CONFIRMED", createdBy: "Trần Quản Lý", items: { create: itemsSnap } } });
    console.log("   Giá booking PH4: BK-100040 (KH VIP) DMK 2.100.000₫ + Laser Pico 1.500.000₫ = tổng 3.600.000₫ (item theo giá VIP; Booking.price=DMK).");
  }

  // --- Pricing PH5 — giá GÓI cho protocol SERVICES (PROTO-PIGMENT-COMBO) ---
  const protoP5 = await prisma.brandProtocol.findUnique({ where: { code: "PROTO-PIGMENT-COMBO" }, select: { id: true, compositionMode: true } });
  if (protoP5 && protoP5.compositionMode === "SERVICES" && (await prisma.protocolCostingVersion.count({ where: { protocolId: protoP5.id } })) === 0) {
    try {
      // Bảo đảm dịch vụ thành phần BẮT BUỘC (Laser Pico) có giá vốn phát hành.
      const { createCostingVersion, publishCostingVersion } = await import("../src/lib/service-costing");
      const svcPico = await prisma.service.findUnique({ where: { code: "DV-PICO-01" }, select: { id: true } });
      if (svcPico && (await prisma.serviceCostingVersion.count({ where: { serviceId: svcPico.id, status: "PUBLISHED" } })) === 0) {
        const { version } = await createCostingVersion({ serviceId: svcPico.id, equipmentCost: 900_000, note: "Giá vốn Laser Pico (demo PH5)", createdBy: "Trần Quản Lý" });
        await publishCostingVersion(version.id, "Trần Quản Lý");
      }
      const { createProtocolCostingVersion, publishProtocolCostingVersion, createProtocolFloorVersion, publishProtocolFloorVersion, createProtocolRecommendedVersion, publishProtocolRecommendedVersion } = await import("../src/lib/protocol-pricing");
      const { version: pc } = await createProtocolCostingVersion({ protocolId: protoP5.id, packageSpecificCost: 100_000, packageSpecificReason: "Bộ kit dùng chung cho combo", createdBy: "Trần Quản Lý" });
      const pcPub = await publishProtocolCostingVersion(pc.id, "Trần Quản Lý");
      const pf = await createProtocolFloorVersion({ protocolId: protoP5.id, protocolCostingVersionId: pcPub.id, minMarginPercent: 30, createdBy: "Trần Quản Lý" });
      await publishProtocolFloorVersion(pf.id, "Ban giám đốc");
      const pr = await createProtocolRecommendedVersion({ protocolId: protoP5.id, protocolCostingVersionId: pcPub.id, targetMarginPercent: 40, createdBy: "Trần Quản Lý" });
      await publishProtocolRecommendedVersion(pr.id, "Trần Quản Lý");
      // Giá bán gói qua PriceBook (PriceRule PACKAGE, targetId=protocolId).
      for (const [pt, price] of [["STANDARD", 5_000_000], ["VIP", 4_700_000]] as const) {
        const has = await prisma.priceRule.findFirst({ where: { targetType: "PACKAGE", targetId: protoP5.id, priceType: pt } });
        if (!has) await prisma.priceRule.create({ data: { targetType: "PACKAGE", targetId: protoP5.id, targetName: "Điều trị sắc tố kết hợp", priceType: pt, price, isActive: true, createdBy: "Trần Quản Lý" } });
      }
      console.log(`   Giá gói PH5 (PROTO-PIGMENT-COMBO): giá vốn ${Number(pcPub.totalEstimatedCost).toLocaleString("vi-VN")}₫ → sàn ${Number(pf.floorPrice).toLocaleString("vi-VN")}₫ (30%) → đề xuất ${Number(pr.calculatedRecommendedPrice).toLocaleString("vi-VN")}₫ (40%); PriceBook gói Standard 5.000.000₫ / VIP 4.700.000₫.`);
    } catch (e) {
      console.log("   ⚠️  Bỏ qua giá gói PH5 (dịch vụ thành phần chưa có giá vốn phát hành):", (e as Error).message);
    }
  }

  // HR-PH4 — kỳ KPI demo (08/2026): tính snapshot từ FACT contribution/attendance/review.
  try {
    const existing = await prisma.kpiPeriod.findFirst({ where: { code: "KP-000001" } });
    if (!existing) {
      const { ensureKpiDefinitions, calculatePeriod } = await import("../src/lib/kpi");
      await ensureKpiDefinitions();
      const period = await prisma.kpiPeriod.create({ data: { code: "KP-000001", name: "Kỳ 08/2026", periodType: "MONTHLY", startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-08-31T00:00:00.000Z"), status: "DRAFT", createdBy: "seed-demo" } });
      const res = await calculatePeriod({ userId: null, name: "seed-demo", email: null, permissions: [], roles: [] } as any, period.id);
      console.log(`   KPI demo: KP-000001 (08/2026) — đã tính ${res.snapshots} snapshot / ${res.employees} nhân sự (DRAFT, có thể khóa ở /performance).`);
    }
  } catch (e) {
    console.log("   ⚠️  Bỏ qua KPI demo:", (e as Error).message);
  }

  // HR-PH5 — Lương thưởng demo: chính sách CP-000001 (COMPANY) PUBLISHED + sinh
  // sự kiện thu nhập từ FACT (contribution + tiền thực thu). KHÔNG tính bảng lương.
  try {
    const existing = await prisma.compensationPolicy.findFirst({ where: { code: "CP-000001" } });
    if (!existing) {
      const { publishPolicyVersion, generateTreatmentIncentivesForSession, generateSalesCommissionForPayment } = await import("../src/lib/compensation");
      const seedSession = { userId: null, name: "seed-demo", email: null, permissions: [], roles: [] } as any;
      const policy = await prisma.compensationPolicy.create({
        data: {
          code: "CP-000001", name: "Chính sách lương thưởng chuẩn (công ty)", scopeType: "COMPANY", status: "ACTIVE", createdBy: "seed-demo",
          versions: { create: { version: 1, effectiveFrom: new Date("2024-01-01T00:00:00Z"), status: "DRAFT", createdBy: "seed-demo" } },
        },
        include: { versions: true },
      });
      const vId = policy.versions[0].id;
      await prisma.treatmentIncentiveRule.createMany({ data: [
        { policyVersionId: vId, code: "TI-PRIMARY", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 150_000 as any, weightMode: "IGNORE_WEIGHT" },
        { policyVersionId: vId, code: "TI-MASTER", contributionTypeCode: "MASTER_SUPERVISION", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 50_000 as any, weightMode: "IGNORE_WEIGHT" },
      ] });
      await prisma.commissionRule.create({ data: { policyVersionId: vId, code: "SC-CLOSER", basisType: "COLLECTED_CASH", targetType: "ALL", ratePercent: 3 as any, attributionRole: "CLOSER" } });
      await publishPolicyVersion(seedSession, vId);

      // Attribution CLOSER cho nvKTV trên hóa đơn của KH-100004 (nguồn tiền PT-000001 gắn hóa đơn này).
      await prisma.salesAttribution.create({ data: { employeeId: nvKTV.id, sourceType: "INVOICE", sourceId: invLinh.id, attributionRole: "CLOSER", weight: 1 as any, employeeNameSnapshot: nvKTV.fullName, roleSnapshot: nvKTV.title, status: "ACTIVE", createdBy: "seed-demo" } });

      // Sinh event: thưởng dịch vụ buổi SS-100001 + hoa hồng phiếu thu PT-000001.
      const ti = await generateTreatmentIncentivesForSession(seedSession, sLinh1.id);
      const pt1 = await prisma.payment.findFirst({ where: { code: "PT-000001" } });
      let sc = { created: 0 };
      if (pt1) sc = await generateSalesCommissionForPayment(seedSession, pt1.id);
      console.log(`   Lương thưởng demo: CP-000001 PUBLISHED — thưởng dịch vụ ${ti.created} event (KTV 150k + Master 50k), hoa hồng ${sc.created} event (3%×5tr = 150k CLOSER).`);
    }
  } catch (e) {
    console.log("   ⚠️  Bỏ qua Lương thưởng demo:", (e as Error).message);
  }

  // HR-PH6 — Bảng lương demo: kỳ PR-000001 (08/2026) gộp thu nhập HR-PH5 + lương
  // cơ bản + phụ cấp/khấu trừ (chủ DN tự khai). KHÔNG hard-code thuế/BHXH.
  try {
    const existing = await prisma.payrollPeriod.findFirst({ where: { code: "PR-000001" } });
    if (!existing) {
      const { calculatePayrollPeriod } = await import("../src/lib/payroll");
      const seedSession = { userId: null, name: "seed-demo", email: null, permissions: [], roles: [] } as any;
      // Lương cơ bản demo
      await prisma.employeeBaseSalary.createMany({ data: [
        { employeeId: nvKTV.id, amount: 10_000_000 as any, effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdBy: "seed-demo" },
        { employeeId: nvMaster.id, amount: 15_000_000 as any, effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdBy: "seed-demo" },
        // NV Sophia spa (theo Bảng lương THNG T07.2026): lương chính 7.000.000₫.
        { employeeId: nvKieu.id, amount: 7_000_000 as any, effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdBy: "seed-demo" },
        { employeeId: nvThanh.id, amount: 7_000_000 as any, effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdBy: "seed-demo" },
      ] });
      // Phụ cấp + khấu trừ. Khai theo NHÓM để KHÔNG đụng chéo (mgmt vs NV spa).
      await prisma.payrollComponentRule.createMany({ data: [
        // Nhân viên quản lý/VP (khai riêng từng NV — minh họa)
        { code: "PC-ANTRUA-KTV", name: "Phụ cấp ăn trưa", kind: "EARNING", calcType: "FIXED", value: 730_000 as any, scope: "EMPLOYEE", scopeRef: nvKTV.id, sortOrder: 1, createdBy: "seed-demo" },
        { code: "BHXH-KTV", name: "BHXH/BHYT/BHTN (khai tay 10.5%)", kind: "DEDUCTION", calcType: "PERCENT_BASE", value: 10.5 as any, scope: "EMPLOYEE", scopeRef: nvKTV.id, sortOrder: 2, createdBy: "seed-demo" },
        { code: "PC-ANTRUA-MAS", name: "Phụ cấp ăn trưa", kind: "EARNING", calcType: "FIXED", value: 730_000 as any, scope: "EMPLOYEE", scopeRef: nvMaster.id, sortOrder: 1, createdBy: "seed-demo" },
        { code: "BHXH-MAS", name: "BHXH/BHYT/BHTN (khai tay 10.5%)", kind: "DEDUCTION", calcType: "PERCENT_BASE", value: 10.5 as any, scope: "EMPLOYEE", scopeRef: nvMaster.id, sortOrder: 2, createdBy: "seed-demo" },
        // === CÔNG THỨC LƯƠNG SOPHIA (NV spa, scope ROLE "Spa") — theo chủ DN cung cấp ===
        // Cộng: lương chính (EmployeeBaseSalary 7tr) + xăng 500k + ăn 660k + chuyên cần 900k
        //       + "Cập nhật dữ liệu" 500k (khai riêng từng NV) + Tour fee/thưởng (biến động, nhập tháng).
        { code: "SPA-XANG", name: "Phụ cấp xăng", kind: "EARNING", calcType: "FIXED", value: 500_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 10, createdBy: "seed-demo" },
        { code: "SPA-AN", name: "Phụ cấp ăn", kind: "EARNING", calcType: "FIXED", value: 660_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 11, createdBy: "seed-demo" },
        { code: "SPA-CHUYENCAN", name: "Chuyên cần (đủ công)", kind: "EARNING", calcType: "FIXED", value: 900_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 12, createdBy: "seed-demo" },
        // Trừ: BH trên mức lương ĐÓNG 5.800.000₫ (BHXH đóng 6% do cty hỗ trợ 2%) + đoàn phí = 551.000₫.
        { code: "SPA-BHXH", name: "BHXH (6% × mức đóng 5.800.000)", kind: "DEDUCTION", calcType: "FIXED", value: 348_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 20, createdBy: "seed-demo" },
        { code: "SPA-BHYT", name: "BHYT (1,5% × 5.800.000)", kind: "DEDUCTION", calcType: "FIXED", value: 87_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 21, createdBy: "seed-demo" },
        { code: "SPA-BHTN", name: "BHTN (1% × 5.800.000)", kind: "DEDUCTION", calcType: "FIXED", value: 58_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 22, createdBy: "seed-demo" },
        { code: "SPA-DPCD", name: "Đoàn phí công đoàn (1% × 5.800.000)", kind: "DEDUCTION", calcType: "FIXED", value: 58_000 as any, scope: "ROLE", scopeRef: "Spa", sortOrder: 23, createdBy: "seed-demo" },
        // "Cập nhật dữ liệu" 500k — khai RIÊNG từng nhân viên (áp dụng từ 3/2026).
        { code: "CU-KIEU", name: "Cập nhật dữ liệu (từ 3/2026)", kind: "EARNING", calcType: "FIXED", value: 500_000 as any, scope: "EMPLOYEE", scopeRef: nvKieu.id, sortOrder: 13, createdBy: "seed-demo" },
        { code: "CU-THANH", name: "Cập nhật dữ liệu (từ 3/2026)", kind: "EARNING", calcType: "FIXED", value: 500_000 as any, scope: "EMPLOYEE", scopeRef: nvThanh.id, sortOrder: 13, createdBy: "seed-demo" },
      ] });
      const period = await prisma.payrollPeriod.create({ data: { code: "PR-000001", name: "Lương tháng 08/2026", periodType: "MONTHLY", startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z"), status: "DRAFT", createdBy: "seed-demo" } });
      const res = await calculatePayrollPeriod(seedSession, period.id);
      console.log(`   Bảng lương demo: PR-000001 (08/2026) — đã tính ${res.employees} phiếu. NV spa theo công thức Sophia: Lương chính 7.000.000 + xăng 500k + ăn 660k + chuyên cần 900k + cập nhật 500k = gộp 9.560.000 − BH 551.000 = thực nhận 9.009.000₫ (chưa gồm Tour fee/thưởng nhập theo tháng). DRAFT, duyệt ở /payroll.`);
    }
  } catch (e) {
    console.log("   ⚠️  Bỏ qua Bảng lương demo:", (e as Error).message);
  }

  // LOY-PH1 — Khách hàng thân thiết demo: hạng + tích điểm + ví + voucher.
  try {
    const existing = await prisma.membershipTier.findFirst({ where: { code: "STD" } });
    if (!existing) {
      const { earnPointsForPayment, topUpPrepaid } = await import("../src/lib/loyalty");
      const seedSession = { userId: null, name: "seed-demo", email: null, permissions: [], roles: [] } as any;
      await prisma.membershipTier.createMany({ data: [
        { code: "STD", name: "Thường", minLifetimeSpend: 0 as any, pointsPerThousand: 1 as any, discountPercent: 0 as any, sortOrder: 1 },
        { code: "SILVER", name: "Bạc", minLifetimeSpend: 5_000_000 as any, pointsPerThousand: 1.5 as any, discountPercent: 3 as any, sortOrder: 2 },
        { code: "VIP", name: "VIP", minLifetimeSpend: 20_000_000 as any, pointsPerThousand: 2 as any, discountPercent: 5 as any, sortOrder: 3 },
      ] });
      // Tích điểm cho KH-100004 từ phiếu thu PT-000001 (5tr) + nạp ví 1tr
      const pt1 = await prisma.payment.findFirst({ where: { code: "PT-000001" } });
      let earned = 0;
      if (pt1) { const r = await earnPointsForPayment(seedSession, pt1.id); earned = (r as any).earned ?? 0; }
      await topUpPrepaid(seedSession, kDangPD.id, 1_000_000, { method: "CASH", note: "Nạp ví demo" });
      // Voucher demo
      await prisma.voucher.create({ data: { code: "WELCOME100", name: "Chào mừng giảm 100k", type: "FIXED", value: 100_000 as any, minSpend: 500_000 as any, maxRedemptions: 100, createdBy: "seed-demo" } });
      await prisma.voucher.create({ data: { code: "VIP20", name: "VIP giảm 20% (trần 300k)", type: "PERCENT", value: 20 as any, maxDiscount: 300_000 as any, maxRedemptions: 50, createdBy: "seed-demo" } });
      console.log(`   Khách thân thiết demo: 3 hạng (Thường/Bạc/VIP) — KH-100004 tích ${earned} điểm (từ PT-000001) + ví 1.000.000₫; 2 voucher (WELCOME100, VIP20).`);
    }
  } catch (e) {
    console.log("   ⚠️  Bỏ qua Khách thân thiết demo:", (e as Error).message);
  }

  console.log("   Vật tư demo: JetPeel 100ml (còn 82ml), Vật tư khách hàng 10đv (còn 5).");
  console.log("✅ Seed DEMO hoàn tất: 7 khách (KH-100001..007), brand Klapp, CN RF/HIFU,");
  console.log("   protocol DEMO có version, kho vật tư spa, 2 chiến dịch, báo giá 3 phương án.");
  console.log("   Cổng khách demo #2: linh.do@example.com / khach123 (KH-100004).");
}

main()
  .catch((e) => { console.error("❌ Seed DEMO lỗi:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
