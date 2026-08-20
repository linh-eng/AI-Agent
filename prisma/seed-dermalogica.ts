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
