// prisma/seed-dmk.ts — Nạp riêng THƯ VIỆN PROTOCOL DMK (brand + 20 protocol theo bước)
// vào bất kỳ DB nào (idempotent, upsert). Trích từ seed-demo.ts để chạy độc lập,
// KHÔNG phụ thuộc guard "đã có KH-100001". Chạy: npm run seed:dmk
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const brDMK = await prisma.brand.upsert({ where: { code: "BR-DMK" }, update: {}, create: { code: "BR-DMK", name: "DMK", description: "Danné Montague-King — enzyme therapy (Úc/Mỹ)" } });
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
  const n = await prisma.brandProtocol.count({ where: { code: { startsWith: "PROTO-DMK-" } } });
  console.log(`✅ Nạp xong thư viện protocol DMK — tổng ${n} protocol PROTO-DMK-*.`);
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });
