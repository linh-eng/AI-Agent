// prisma/seed-dermalogica.ts — Nạp THƯ VIỆN DERMALOGICA: brand + protocol theo bước (+ dịch vụ shell).
// Nguồn: "Biểu đồ trị liệu" Dermalogica do khách hàng cung cấp (PRO Calm — Làm Dịu).
// Idempotent (upsert), chạy độc lập. Chạy: npm run seed:dermalogica
// LƯU Ý: file nguồn KHÔNG có bảng giá → dịch vụ tạo với standardPrice=0 (chờ bảng giá).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type Item = { group: string; name: string; purpose: string; durationMinutes?: number };

const protocols: {
  code: string;
  name: string;
  purpose: string;
  suitableFor?: string;
  contraindications?: string;
  items: Item[];
}[] = [
  {
    code: "PROTO-DERMA-PRO-CALM",
    name: "Dermalogica — PRO Calm Treatment (Liệu pháp Làm Dịu)",
    purpose:
      "Liệu pháp Làm Dịu Pro Calm nhắm đến mọi tình trạng da nhạy cảm. Các hoạt chất thảo mộc làm dịu kết hợp kỹ thuật " +
      "mát-xa ấn huyệt và làm thông thoáng hệ bạch huyết giúp làm dịu hệ thần kinh căng thẳng; giảm mẫn đỏ rõ rệt, mang lại " +
      "làn da mềm mại, cân bằng và đủ nước.",
    suitableFor:
      "Da nhạy cảm: mẫn đỏ nhẹ (hơi ửng đỏ, ửng hồng hai má, châm chích khi rửa mặt) → viêm sưng (khó chịu vừa/cao, ửng đỏ " +
      "liên tục, có nhiệt ấm khi chạm, da đỏ và kích ứng rõ, ngứa dai dẳng, thiếu nước và khô).",
    contraindications:
      "Đánh giá mức độ viêm sưng của da (mẫn đỏ nhẹ → viêm sưng) trước khi chọn mặt nạ và Liệu Pháp Tiếp Xúc phù hợp. " +
      "Với da có nhiệt nóng: dùng đá lạnh hoặc đầu lăn ngọc bích trên huyết thanh (giảm quyền năng).",
    items: [
      {
        group: "Bước 1 — Làm Sạch Gấp Đôi",
        name: "UltraCalming Cleanser (rửa 2 lần) + Sơ Đồ Khuôn Mặt",
        purpose:
          "1) Rửa lần đầu bằng UltraCalming Cleanser. 2) Thực hiện phân tích da Sơ Đồ Khuôn Mặt (Face Mapping). " +
          "3) Rửa lần hai bằng UltraCalming Cleanser, lau sạch bằng khăn thẩm mỹ mềm hoặc bông gòn.",
      },
      {
        group: "Bước 2 — Tái Tạo Bề Mặt",
        name: "Daily Milkfoliant + Calming Botanical Mixer",
        purpose:
          "1) Cho Daily Milkfoliant vào chén với nước, trộn thành hỗn hợp sủi bọt. 2) Thêm vài giọt Calming Botanical Mixer; " +
          "thoa lên da bằng cọ quạt, nhẹ nhàng mát-xa. 3) Lau đi bằng khăn thẩm mỹ, bông gòn hoặc vải mềm ẩm.",
      },
      {
        group: "Bước 3 — Điều Trị Chuyên Sâu",
        name: "UltraCalming Serum Concentrate (điện di ion / siêu âm)",
        purpose:
          "Thoa UltraCalming Serum Concentrate, dùng thiết bị điện chuyển ion hoặc sóng siêu âm giúp thẩm thấu huyết thanh. " +
          "Giảm quyền năng: với da có nhiệt nóng, dùng đá lạnh hoặc đầu lăn ngọc bích lăn trên huyết thanh.",
      },
      {
        group: "Bước 4 — Mặt Nạ Chuyên Dụng",
        name: "Mặt nạ chọn theo mức độ viêm sưng",
        purpose:
          "1) Chọn mặt nạ chuyên dụng dựa theo mức độ viêm sưng của da. 2) Đắp mặt nạ. 3) Lau mặt nạ bằng khăn hấp lạnh, " +
          "bông gòn hoặc vải mềm.",
      },
      {
        group: "Bước 5 — Liệu Pháp Tiếp Xúc (Mát-xa)",
        name: "Bạch huyết / Ấn huyệt / Thư giãn da đầu",
        purpose:
          "Chọn Liệu Pháp Tiếp Xúc theo mức độ viêm sưng: 1) Làm sạch hệ bạch huyết — trứng cá đỏ, dị ứng, da sưng phù, có " +
          "nhiệt nóng. 2) Ấn huyệt — nhạy cảm chung. 3) Thư giãn da đầu — lý tưởng cho người căng thẳng cao hoặc muốn giảm " +
          "tiếp xúc trên mặt do nhạy cảm.",
      },
      {
        group: "Bước 6 — Thoa Chồng Bảo Vệ",
        name: "UltraCalming Mist + Serum Concentrate + dưỡng ẩm",
        purpose:
          "1) Xịt UltraCalming Mist. 2) Thoa UltraCalming Serum Concentrate. 3) Thoa giải pháp dưỡng ẩm phù hợp cho da.",
      },
      {
        group: "Bước 7 — Chăm Sóc Tại Nhà",
        name: "Kê toa hệ thống chăm sóc tại nhà",
        purpose:
          "1) Kê toa hệ thống chăm sóc tại nhà (dùng xen kẽ các lần trị liệu da). 2) Thêm sản phẩm bổ trợ cân chỉnh theo nhu " +
          "cầu làn da của khách hàng.",
      },
    ],
  },
  {
    code: "PROTO-DERMA-PRO-BRIGHT",
    name: "Dermalogica — PRO Bright Treatment (Liệu pháp Làm Sáng)",
    purpose:
      "Liệu pháp Làm Sáng Pro Bright — liệu pháp da 3 bước cường độ cao tăng cường hấp thụ các hoạt chất làm sáng Vitamin C, " +
      "Niacinamide và Hexylresorcinol; giải quyết các đốm sậm màu và giảm sắc tố không đồng đều cho làn da tươi sáng hơn. Lợi " +
      "ích chính: giảm đốm sậm màu, da sáng hơn, sắc diện cân bằng.",
    suitableFor:
      "Tăng sắc tố: da thiếu sức sống/xỉn màu, đốm do ánh nắng, đốm đồi mồi, nám thai kỳ, tăng sắc tố hậu viêm.",
    items: [
      {
        group: "Bước 1 — Làm Sạch Gấp Đôi",
        name: "PreCleanse + Sơ Đồ Khuôn Mặt + Special Cleansing Gel với Daily Microfoliant",
        purpose:
          "1) Cho PreCleanse ra khăn thẩm mỹ ẩm, thoa lên da để lấy bụi bẩn. 2) Phân tích da Sơ Đồ Khuôn Mặt (nhanh). " +
          "3) Cho Special Cleansing Gel vào chén với Daily Microfoliant + ít nước, dùng cọ quạt thoa lên da, rửa và lau sạch.",
      },
      {
        group: "Bước 2 — Điều Trị Chuyên Sâu",
        name: "One-Step Prep + UltraBright Peel + Neutralizing Solution",
        purpose:
          "Đeo găng tay y tế. 1) Thoa One-Step Prep. 2) Thoa 1-2 lớp UltraBright Peel. 3) Thoa Neutralizing Solution, lau bằng " +
          "bông gòn/khăn thẩm mỹ ẩm. Tăng quyền năng: UltraBright Peel trộn Advanced Renewal Peel. Giảm quyền năng: Exfoliant " +
          "Accelerator 35 trộn Daily Microfoliant.",
      },
      {
        group: "Bước 3 — Tái Tạo Bề Mặt",
        name: "BioLumin-C Pro / PowerBright IonActive Serum + Conductive Masque Base + Cooling Contour Masque",
        purpose:
          "1) Thoa lượng nhỏ BioLumin-C Pro Serum hoặc PowerBright IonActive Serum. 2) Thoa Conductive Masque Base bằng cọ quạt; " +
          "tuỳ chọn thiết bị vi dòng hoặc thiết bị đẩy thẩm thấu. 3) Thoa Cooling Contour Masque.",
      },
      {
        group: "Bước 4 — Thoa Chồng Bảo Vệ",
        name: "Toner + Serum làm sáng + BioLumin-C Gel Moisturizer + Invisible Physical Defense SPF30",
        purpose:
          "1) Xịt toner phù hợp cho da. 2) Thoa BioLumin-C Pro Serum hoặc PowerBright IonActive Serum; tuỳ chọn vi dòng/đẩy thẩm " +
          "thấu. 3) Kết thúc bằng BioLumin-C Gel Moisturizer, theo sau Invisible Physical Defense SPF30.",
      },
      {
        group: "Bước 5 — Chăm Sóc Tại Nhà",
        name: "Kê toa hệ thống chăm sóc tại nhà PRO Bright",
        purpose:
          "1) Kê toa hệ thống chăm sóc tại nhà (dùng xen kẽ các lần trị liệu da PRO Bright). 2) Thêm sản phẩm bổ trợ cân chỉnh " +
          "theo nhu cầu làn da của khách hàng.",
      },
    ],
  },
  {
    code: "PROTO-DERMA-PRO-FIRM",
    name: "Dermalogica — PRO Firm Treatment (Làm Săn Chắc Da + Cổ)",
    purpose:
      "Liệu pháp Làm Săn Chắc Da + Cổ Pro Firm — hoạt động như bài thể dục cho làn da ở cổ và mặt; kết hợp mát-xa màng cơ và " +
      "các kỹ thuật cho sắc thái và sự săn chắc, cùng sản phẩm tái kết cấu cho làn da mềm mịn.",
    suitableFor: "Khô & kết cấu da; đường nhăn và nếp nhăn.",
    items: [
      {
        group: "Bước 1 — Làm Sạch Gấp Đôi",
        name: "PreCleanse + Sơ Đồ Khuôn Mặt + Skin Resurfacing Cleanser",
        purpose:
          "1) PreCleanse cho lần rửa đầu. 2) Lập Sơ Đồ Khuôn Mặt. 3) Skin Resurfacing Cleanser cho lần rửa hai. Thiết bị: cọ hoặc " +
          "đầu sóng siêu âm để làm sạch sâu hơn. Tăng quyền năng: thêm Daily Microfoliant vào Skin Resurfacing Cleanser. Giảm " +
          "quyền năng: Intensive Moisture Cleanser cho lần rửa hai.",
      },
      {
        group: "Bước 2 — Tái Tạo Bề Mặt",
        name: "MultiVitamin Power Exfoliant + làm sạch gấp đôi",
        purpose:
          "1) Thoa MultiVitamin Power Exfoliant, để sản phẩm hoạt động trên da trong khoảng thời gian cụ thể. 2) Làm sạch gấp đôi " +
          "với PreCleanse và Special Cleansing Gel để loại bỏ tẩy da chết. Tăng quyền năng: Advanced Renewal Pro Power Peel. Giảm " +
          "quyền năng: MultiVitamin Thermafoliant.",
      },
      {
        group: "Bước 3 — Liệu Pháp Tiếp Xúc (Mát-xa màng cơ)",
        name: "Soothing Additive / Melting Moisture Masque + Màng cơ / Gua Sha",
        purpose:
          "1) Thoa vài giọt Soothing Additive hoặc lượng nhỏ Melting Moisture Masque tuỳ liệu pháp tiếp xúc. 2) Màng cơ → Soothing " +
          "Additive; Gua Sha → Melting Moisture Masque. 3) Thực hiện Kỹ Thuật Mát-xa Màng Cơ Nâng Cao hoặc Liệu Pháp Tiếp Xúc với " +
          "Gua Sha (không cần lau sản phẩm sau khi thực hiện).",
      },
      {
        group: "Bước 4 — Điều Trị Chuyên Sâu",
        name: "Neck Refining Masque + LED Đỏ + Retinol 1% IonActive + Conductive Masque Base + vi dòng",
        purpose:
          "1) Thoa Neck Refining Masque cho vùng cổ và ngực. 2) Tuỳ chọn LED Đỏ trên mặt theo thời lượng khuyên dùng của NSX. " +
          "3) Thoa Retinol 1% IonActive Serum (sau LED). 4) Thoa lớp mỏng Conductive Masque Base lên mặt. 5) Dùng vi dòng đẩy thẩm " +
          "thấu, loại bỏ mặt nạ bằng khăn hấp ấm. Giảm quyền năng: Hyaluronic Acid IonActive Serum.",
      },
      {
        group: "Bước 5 — Thoa Chồng Bảo Vệ",
        name: "Antioxidant HydraMist + điều trị mắt + Neck Fit Contour Serum + Dynamic Skin Recovery SPF50",
        purpose:
          "1) Xịt Antioxidant Hydramist. 2) Thoa sản phẩm điều trị vùng mắt phù hợp. 3) Neck Fit Contour Serum cho vùng cổ. " +
          "4) Thoa Dynamic Skin Recovery SPF50. Tăng quyền năng: Super Rich Repair dưới Dynamic Skin Recovery SPF50.",
      },
      {
        group: "Bước 6 — Chăm Sóc Tại Nhà",
        name: "Kê toa hệ thống chăm sóc tại nhà",
        purpose:
          "1) Kê toa hệ thống chăm sóc tại nhà (dùng xen kẽ các lần trị liệu da). 2) Thêm sản phẩm bổ trợ cân chỉnh theo nhu cầu " +
          "làn da của khách hàng.",
      },
    ],
  },
  {
    code: "PROTO-DERMA-PRO-MICRONEEDLING",
    name: "Dermalogica — PRO Microneedling Treatment (Vi kim chuyên nghiệp)",
    purpose:
      "Liệu pháp vi kim chuyên nghiệp Pro Microneedling — liệu pháp nâng cao 60 phút với kỹ thuật cải tiến và hoạt chất cấp " +
      "chuyên gia: làm sáng sắc diện, tinh chỉnh diện mạo lỗ chân lông, giảm biểu hiện đốm sậm màu, giảm nếp nhăn và đường nhăn.",
    suitableFor: "Da xỉn màu/thiếu sức sống; lỗ chân lông to hoặc bị tắc nghẽn; tăng sắc tố; đường nhăn và nếp nhăn.",
    contraindications:
      "Trị liệu NÂNG CAO — chỉ chuyên gia được CẤP PHÉP mới được uỷ quyền thực hiện. Kiểm tra điều lệ cấp phép chuyên nghiệp, " +
      "hướng dẫn và quy thức an toàn tại Quốc gia/Tỉnh Thành sở tại để đảm bảo hoạt động trong phạm vi hành nghề trước khi thực hiện.",
    items: [
      {
        group: "Bước 1 — Làm Sạch Gấp Đôi",
        name: "PreCleanse + Sơ Đồ Khuôn Mặt + Special Cleansing Gel",
        purpose:
          "1) PreCleanse cho lần rửa đầu. 2) Lập Sơ Đồ Khuôn Mặt. 3) Special Cleansing Gel hoặc sữa rửa mặt cụ thể cho da ở lần " +
          "rửa hai.",
      },
      {
        group: "Bước 2 — Tái Tạo Bề Mặt",
        name: "One-Step Prep + Pro Power Peel + Neutralizing Solution",
        purpose:
          "1) Thoa One-Step Prep. 2) Thoa Pro Power Peel phù hợp cho da (1-2 lớp) — PowerClear / UltraBright / Advanced Renewal " +
          "Peel tuỳ lo lắng. 3) Thoa Neutralizing Solution sau Pro Power Peel, lau đi theo HDSD. Giảm quyền năng: Exfoliant " +
          "Accelerator 35 hoặc bỏ qua bước tái tạo bề mặt.",
      },
      {
        group: "Bước 3 — Phương Pháp Vi Kim",
        name: "Huyết thanh chuyên dụng + độ sâu kim + Kỹ Thuật Vi Kim Dermalogica",
        purpose:
          "1) Chọn huyết thanh chuyên dụng và độ sâu kim (0.25–1.25mm) tuỳ lo lắng nhắm đến (Niacinamide IonActive / PowerBright " +
          "IonActive / BioLumin-C Pro Serum; Pro Restore hoạt động hiệu quả ở độ sâu kim tăng lên). 2) Thoa huyết thanh đã chọn lên " +
          "da. 3) Thực hiện Kỹ Thuật Vi Kim Dermalogica. 4) Lau sạch sản phẩm còn sót bằng khăn ướt thẩm mỹ; thoa Pro Restore toàn mặt.",
      },
      {
        group: "Bước 4 — Thoa Chồng Bảo Vệ",
        name: "Hệ serum/dưỡng/chống nắng theo lo lắng + Pro Restore",
        purpose:
          "Theo lo lắng về da, thoa hệ hoàn thiện phù hợp + Pro Restore: (a) Smart Response Serum → Dynamic Skin Recovery SPF50 → " +
          "Super Rich Repair; (b) PowerBright Dark Spot Serum → PowerBright Moisturizer SPF50 → PowerBright Overnight Cream; " +
          "(c) BioLumin-C Serum → BioLumin-C Gel Moisturizer → Invisible Physical Defense SPF30; (d) AGE Bright Clearing Serum → " +
          "Active Moist → Invisible Physical Defense SPF30.",
      },
      {
        group: "Bước 5 — Chăm Sóc Tại Nhà",
        name: "Pro Restore 7 ngày + hệ chăm sóc phù hợp",
        purpose:
          "1) Kê 2 tuýp Pro Restore để dùng trong 7 ngày sau trị liệu Pro Microneedling. 2) Từ ngày thứ hai sau trị liệu, khách " +
          "dùng hệ huyết thanh/dưỡng ẩm/chống nắng phù hợp lo lắng về da. 3) Thêm sản phẩm bổ trợ cân chỉnh theo nhu cầu làn da.",
      },
    ],
  },
];

// Dịch vụ Dermalogica. price=0 (file nguồn CHƯA có bảng giá — chờ chị cung cấp).
const services: { code: string; name: string; cat: string; minutes: number; price: number; desc: string; protoCode?: string }[] = [
  {
    code: "DV-DERMA-PRO-CALM",
    name: "Dermalogica PRO Calm — Trị liệu làm dịu da nhạy cảm",
    cat: "DERMA-PRO",
    minutes: 75,
    price: 0,
    desc: "Trị liệu làm dịu Pro Calm cho da nhạy cảm/mẫn đỏ (giảm mẫn đỏ, cân bằng, cấp ẩm). Giá: chờ bảng giá.",
    protoCode: "PROTO-DERMA-PRO-CALM",
  },
  {
    code: "DV-DERMA-PRO-BRIGHT",
    name: "Dermalogica PRO Bright — Trị liệu làm sáng, giảm sắc tố",
    cat: "DERMA-PRO",
    minutes: 60,
    price: 0,
    desc: "Trị liệu làm sáng Pro Bright (Vitamin C + Niacinamide) — giảm đốm sậm màu, đều màu da. Giá: chờ bảng giá.",
    protoCode: "PROTO-DERMA-PRO-BRIGHT",
  },
  {
    code: "DV-DERMA-PRO-FIRM",
    name: "Dermalogica PRO Firm — Làm săn chắc da + cổ",
    cat: "DERMA-PRO",
    minutes: 75,
    price: 0,
    desc: "Trị liệu làm săn chắc da mặt & cổ Pro Firm (mát-xa màng cơ + tái kết cấu). Giá: chờ bảng giá.",
    protoCode: "PROTO-DERMA-PRO-FIRM",
  },
  {
    code: "DV-DERMA-PRO-MICRONEEDLING",
    name: "Dermalogica PRO Microneedling — Vi kim chuyên nghiệp",
    cat: "DERMA-PRO",
    minutes: 60,
    price: 0,
    desc: "Liệu pháp vi kim nâng cao 60' — làm sáng, tinh chỉnh lỗ chân lông, giảm sắc tố/nếp nhăn. Trị liệu nâng cao (cần chuyên gia cấp phép). Giá: chờ bảng giá.",
    protoCode: "PROTO-DERMA-PRO-MICRONEEDLING",
  },
];

async function main() {
  const brDerma = await prisma.brand.upsert({
    where: { code: "BR-DERMA" },
    update: {},
    create: { code: "BR-DERMA", name: "Dermalogica", description: "Dermalogica — chăm sóc da chuyên nghiệp (Mỹ)" },
  });

  for (const p of protocols) {
    await prisma.brandProtocol.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code, name: p.name, kind: "BRAND", brandId: brDerma.id, status: "ACTIVE", version: 1,
        compositionMode: "LEGACY_STEPS", purpose: p.purpose,
        ...(p.suitableFor ? { suitableFor: p.suitableFor } : {}),
        ...(p.contraindications ? { contraindications: p.contraindications } : {}),
        steps: { items: p.items }, recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
      } as any,
    });
  }
  console.log(`   Protocol Dermalogica: ${protocols.map((p) => p.code.replace("PROTO-DERMA-", "")).join(" · ")} (${protocols.length}).`);

  const catPro = await prisma.serviceCategory.upsert({
    where: { code: "DM-DERMA-PRO" }, update: {},
    create: { code: "DM-DERMA-PRO", name: "Dermalogica Professional" },
  });
  for (const s of services) {
    const proto = s.protoCode ? await prisma.brandProtocol.findUnique({ where: { code: s.protoCode }, select: { id: true } }) : null;
    await prisma.service.upsert({
      where: { code: s.code },
      update: {}, // KHÔNG ghi đè giá (đang chờ bảng giá — tránh reset nếu chị đã nhập tay)
      create: {
        code: s.code, name: s.name, categoryId: catPro.id, status: "ACTIVE",
        durationMinutes: s.minutes, standardPrice: s.price, expectedCost: 0, version: 1,
        description: s.desc, defaultProtocolId: proto?.id ?? null,
      },
    });
  }
  console.log(`   Dịch vụ Dermalogica: ${services.length} dịch vụ (CHƯA có giá — chờ bảng giá).`);

  const n = await prisma.brandProtocol.count({ where: { code: { startsWith: "PROTO-DERMA-" } } });
  const m = await prisma.service.count({ where: { code: { startsWith: "DV-DERMA-" } } });
  console.log(`✅ Nạp xong thư viện Dermalogica — ${n} protocol PROTO-DERMA-*, ${m} dịch vụ DV-DERMA-*.`);
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });
