// prisma/seed-klapp.ts — Nạp THƯ VIỆN KLAPP: brand + 9 protocol theo bước + 10 dịch vụ (giá lẻ).
// Nguồn: bộ ảnh "Hướng dẫn sử dụng" Klapp + bảng giá do khách hàng cung cấp.
// Idempotent (upsert), chạy độc lập. Chạy: npm run seed:klapp
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type Item = { group: string; name: string; purpose: string; durationMinutes?: number };
const PRE: Item[] = [
  { group: "Chuẩn bị", name: "Phân tích làn da", purpose: "Phân tích tình trạng và xác định nhu cầu của làn da." },
  { group: "Chuẩn bị", name: "Massage thư giãn vùng đầu", purpose: "Cân bằng tâm trạng và cảm xúc trước khi thực hiện (≈3 phút).", durationMinutes: 3 },
];

const protocols: { code: string; name: string; purpose: string; contraindications?: string; items: Item[] }[] = [
  {
    code: "PROTO-KLAPP-RETINOL-PROAGE",
    name: "Klapp — Retinol Triple Action PRO AGE Treatment",
    purpose: "Trị liệu chống lão hóa Retinol Triple Action PRO AGE (7 bước).",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk (Sữa làm sạch da ba tác động)", purpose: "1ml Cleansing Milk thoa lên da khô, loại bỏ dầu thừa, dùng nước nhũ hóa làm sạch toàn mặt." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml Cleansing Gel + ít nước tạo bọt mịn, rửa mặt và làm sạch da." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, giúp dãn nở làm sạch bả nhờn bề mặt da." },
      { group: "Bước 4 — Peel", name: "Peeling dạng hạt", purpose: "2-3ml Peeling quét đều, massage 5 phút, để thêm 5-7 phút rồi lau sạch; cân bằng da với Toner PHA.", durationMinutes: 12 },
      { group: "Bước 5 — Serum", name: "Triple Action PRO AGE Serum", purpose: "1-2ml serum massage nhẹ đến khi thẩm thấu." },
      { group: "Bước 6 — Massage", name: "Gel to Oil Mask (massage nâng cơ chữ V)", purpose: "2-3ml massage 15-20 phút, tập trung nếp nhăn + nâng cơ chữ V; lau sạch, cân bằng Toner PHA.", durationMinutes: 20 },
      { group: "Bước 7 — Dưỡng", name: "Triple Action PRO AGE Day + Night Cream", purpose: "Thoa 0,5ml serum cho thẩm thấu; thoa kem dưỡng massage nhẹ; bảo vệ da (chống nắng)." },
    ],
  },
  {
    code: "PROTO-KLAPP-VSHAPE-MASSAGE",
    name: "Klapp — V-Shape Massage (nâng cơ chữ V)",
    purpose: "Kỹ thuật massage mô liên kết sâu theo hình chữ V — nâng và định hình đường viền khuôn mặt (thực hiện chậm, mạnh).",
    items: [
      { group: "Step 1 (6x)", name: "Bắt đầu từ vùng cổ", purpose: "Miết dọc đường cơ song song từ 2 bên chân cổ lên đến điểm cuối tại tai (đường cơ // bạch huyết cổ)." },
      { group: "Step 2 (10x)", name: "Định hình chữ V", purpose: "Dùng 2 tay kích // đường cơ cằm (từ giữa cằm ra hướng tai); vuốt theo đường cơ cằm." },
      { group: "Step 3 (10x)", name: "Góc miệng", purpose: "Từ khóe miệng miết đi bộ tại chỗ, rồi miết chặt kéo căng ra hai bên điểm cuối tại tai." },
      { group: "Step 4 (10x)", name: "Vùng mũi má", purpose: "Từ khóe miệng miết đi bộ, vuốt lên theo cơ biểu cảm rãnh cười về phía xương gò má, ấn tại điểm đồng tiền." },
      { group: "Step 5 (6x)", name: "Cơ vòng miệng", purpose: "Ngón đeo nhẫn + ngón giữa kích cơ môi theo chiều ngang từ giữa ra ngoài, khóe miệng bên này sang bên kia." },
      { group: "Step 6 (6x)", name: "Khu vực cơ vòng miệng", purpose: "Hai tay massage vùng miệng giữa bằng ngón cái + ngón trỏ, từ khóe miệng bên này sang bên kia." },
      { group: "Step 7 (6x)", name: "Cơ cằm, cơ vòng miệng, cơ cắn, cơ gò má", purpose: "2 ngón cái tại nhân trung miết ngang; 2 ngón trỏ vào nhân trung + 2 ngón giữa tại cằm, miết căng từ góc miệng ôm gò má ra đến cơ bám xương tại tai." },
      { group: "Step 8 (6x)", name: "Trán", purpose: "Ngón cái vuốt chặt từ cơ mày lên chân tóc, kích thích cơ toàn vùng trán." },
      { group: "Step 9 (3x)", name: "Bước cuối cùng", purpose: "Hai bàn tay xen kẽ đặt dưới cằm, vuốt nâng dọc hai bên cơ mặt; vuốt ngón cái từ gốc mũi đến chân tóc." },
    ],
  },
  {
    code: "PROTO-KLAPP-HMLP",
    name: "Klapp — Hyaluronic Multi Level Performance Treatment",
    purpose: "Trị liệu cấp ẩm đa tầng Hyaluronic (HMLP, 9 bước).",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "1ml Cleansing Milk thoa da khô loại bỏ dầu thừa, nhũ hóa làm sạch toàn mặt." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml Cleansing Gel + nước tạo bọt mịn, rửa mặt làm sạch." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Toner cân bằng", name: "MLP Skin Perfection PHA Toner", purpose: "Dùng cotton lau mặt với nước cân bằng PHA." },
      { group: "Bước 5 — Peel da", name: "Triple Action Moisturizing Peeling", purpose: "Cọ nhỏ quét 4ml lên mặt để 5-10' (<5' với da nhạy cảm), lau sạch khăn ẩm, cân bằng Toner PHA." },
      { group: "Bước 6 — Massage gel hyaluronic", name: "Triple Action Moisturizing Massage Gel Mask", purpose: "4,5ml gel + toner massage 5', làm ẩm tay massage 10-15', lau sạch. Tùy chọn đắp Sheet Mask/Hyaluronic mask 15-20'." },
      { group: "Bước 7 — Tinh chất", name: "Triple Action Moisturizing Booster", purpose: "1ml tinh chất toàn mặt, có thể kết hợp máy điện di lạnh (0°C)." },
      { group: "Bước 8 — Kem dưỡng", name: "Triple Action Moisturizing Day+Night Cream", purpose: "1ml toàn mặt, massage nhẹ đến khi thẩm thấu hoàn toàn." },
      { group: "Bước 9 — Chống nắng", name: "Facial Sunscreen SPF50", purpose: "Thoa kem đều toàn mặt bảo vệ da." },
    ],
  },
  {
    code: "PROTO-KLAPP-ASA-PEEL",
    name: "Klapp — ASA Peel Face Treatment (thay da sinh học)",
    purpose: "Liệu trình thay da sinh học ASA Peel.",
    contraindications: "Mở bạch huyết từ sâu trước khi đắp mặt nạ Peel. Khi thoa Peel Mask có thể cảm giác nóng/châm chích là bình thường.",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "2ml tản đều toàn mặt trên nền da khô, dùng tay ẩm nhũ hóa, lau sạch khăn ẩm." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml gel + nước tạo bọt, rửa mặt." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Tonic làm sạch sâu", name: "Pre-Cleansing Tonic", purpose: "Làm ướt bông tẩy trang bằng nước hoa hồng và làm sạch mặt (loại bỏ lớp dầu thừa)." },
      { group: "Bước 5 — Peel", name: "Exfoliating Mask Strong", purpose: "Thoa nhanh bằng cọ (che bảo vệ mắt nếu cần), để 30 phút — da có thể nóng/đỏ là bình thường; lau sạch lại da.", durationMinutes: 30 },
      { group: "Bước 6 — Tonic kháng viêm làm dịu", name: "Post-Cleansing Tonic (7ml)", purpose: "Làm ướt bông tẩy trang bằng nước hoa hồng và làm sạch mặt." },
      { group: "Kết thúc", name: "Finishing Care Cream", purpose: "Thoa một lượng lớn, để ≈15 phút, massage nhẹ cho thẩm thấu (không lau)." },
    ],
  },
  {
    code: "PROTO-KLAPP-HYDRA-COLLAGEN-SILK",
    name: "Klapp — Hydra Collagen Silk Intensive Treatment",
    purpose: "Trị liệu collagen tơ tằm chuyên sâu (8 bước).",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "2ml tản đều toàn mặt nền da khô, nhũ hóa, lau sạch khăn ẩm." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml gel + nước tạo bọt, rửa mặt." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Toner cân bằng", name: "MLP Skin Perfection PHA Toner", purpose: "Bông cotton lau mặt qua nước cân bằng da." },
      { group: "Bước 5 — Peel", name: "Gel peeling", purpose: "Thoa lên mặt/cổ/vùng da hở, massage nhẹ 2-3', để 5-10' rồi lau khăn ẩm, cân bằng toner." },
      { group: "Bước 6 — Tinh chất collagen", name: "Skin Refiner Collagen Concentrate", purpose: "Thoa và massage nhẹ đến khi thẩm thấu hoàn toàn." },
      { group: "Bước 7 — Massage mask", name: "Cream Mask", purpose: "Thoa toàn mặt, để 10-15', massage và lau sạch phần còn lại bằng khăn ẩm." },
      { group: "Bước 8 — Kem dưỡng", name: "Collagen Moist Lotion", purpose: "Thoa và vỗ nhẹ đến khi thẩm thấu hoàn toàn; chống nắng bảo vệ da." },
    ],
  },
  {
    code: "PROTO-KLAPP-HYALURONIC-MULTIPLE",
    name: "Klapp — Hyaluronic Multiple Effect",
    purpose: "Trị liệu cấp ẩm đa hiệu quả Hyaluronic (9 bước).",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "2ml tản đều toàn mặt nền da khô, nhũ hóa, lau sạch khăn ẩm." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml gel + nước tạo bọt, rửa mặt, lau khăn ẩm." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Peel da", name: "Micro Peeling", purpose: "Cân bằng da toner PHA; thoa massage nhẹ 5-7' (kết hợp xông hơi), lau khăn ẩm, cân bằng lại PHA." },
      { group: "Bước 5 — Mask cung cấp oxy", name: "Bubble Mask", purpose: "Cọ quét 4ml, không massage — mặt nạ tự tạo bọt, để ≈10', lau sạch bằng bông tẩy trang." },
      { group: "Bước 6 — Tinh chất HA", name: "Concentrate", purpose: "1ml tinh chất massage nhẹ cho thấm đều." },
      { group: "Bước 7 — Massage & đắp nạ", name: "Massage Jelly", purpose: "75-100ml nước + 1-1,5g thạch Jelly khuấy thành gel; 1 phần massage 15', 1 phần đắp nạ 15', loại bỏ gel và rửa da." },
      { group: "Bước 8 — Tinh chất HA (điện di lạnh)", name: "Concentrate + điện di lạnh", purpose: "1ml kết hợp điện di lạnh đến khi thẩm thấu hoàn toàn." },
      { group: "Bước 9 — Kem dưỡng + chống nắng", name: "Finishing Care Cream", purpose: "1ml kem dưỡng thoa đều, sau đó chống nắng bảo vệ da." },
    ],
  },
  {
    code: "PROTO-KLAPP-CPURE",
    name: "Klapp — C Pure Face Infusion Treatment (sáng da cao cấp)",
    purpose: "Liệu trình truyền dưỡng chất Vitamin C sáng da cao cấp (9 bước).",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "2ml tản đều toàn mặt nền da khô, nhũ hóa, lau sạch khăn ẩm." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml gel + nước tạo bọt, rửa mặt." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Toner cân bằng", name: "MLP Skin Perfection PHA Toner", purpose: "Bông tẩy trang lau mặt với nước cân bằng PHA." },
      { group: "Bước 5 — Enzyme Peel & Vita C dạng bột", name: "Enzyme Peel & Essential Powder", purpose: "Trộn Enzyme Peel với Essential Powder, cọ thoa đều tránh vùng mắt, để 5'. Da nhạy cảm: quét Enzyme Peel rồi rắc Essential Powder, massage đến khi hạt tan.", durationMinutes: 5 },
      { group: "Bước 6 — Chất trung hòa", name: "Neutralizer", purpose: "Cọ quét 2/3 chất trung hòa để 5', lau bằng bông khô; 1/3 còn lại thấm vào bông tẩy trang lau đều lên da." },
      { group: "Bước 7 — Serum & Mặt nạ dạng bột", name: "Serum & Mask Powder", purpose: "Trộn Serum & Mask Powder tạo mặt nạ, đắp theo kỹ thuật nâng cơ (tránh chân tóc), đợi 15', làm ẩm bằng bông, massage đến khi mềm, loại bỏ và lau sạch." },
      { group: "Bước 8 — Tinh chất đặc trị", name: "Concentrate", purpose: "Thoa và massage nhẹ đến khi thẩm thấu hoàn toàn." },
      { group: "Bước 9 — Kem dưỡng", name: "Relaxing Cream", purpose: "Thoa và vỗ nhẹ đến khi thẩm thấu; chống nắng bảo vệ da." },
    ],
  },
  {
    code: "PROTO-KLAPP-CAVIAR",
    name: "Klapp — Caviar Treatment (trẻ hóa DNA cá tầm)",
    purpose: "Trị liệu trứng cá tầm — làm hài hòa, săn chắc đường nét khuôn mặt (9 bước).",
    items: [
      ...PRE,
      { group: "Step 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "1ml thoa da khô loại bỏ dầu thừa, nhũ hóa làm sạch toàn mặt." },
      { group: "Step 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml + nước tạo bọt mịn, rửa mặt làm sạch." },
      { group: "Step 3 — Hút bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Step 4 — Cân bằng da", name: "MLP Skin Perfection PHA Toner", purpose: "Cotton lau mặt qua nước cân bằng da." },
      { group: "Step 5 — Peel", name: "Gel peeling", purpose: "2-3ml massage 3-5', để thêm 7', lau sạch (da nhạy cảm: 10' không massage); cân bằng Toner PHA." },
      { group: "Step 6 — Tinh chất", name: "Power Concentrate", purpose: "1ml tinh chất massage thư giãn ấn huyệt nhẹ đến khi thẩm thấu hoàn toàn." },
      { group: "Step 7 — Mặt nạ massage", name: "Mask", purpose: "3ml mask dưỡng, massage nhẹ nâng cơ mặt đến khi thẩm thấu." },
      { group: "Step 8 — Mặt nạ Collagen lá", name: "Caviar Power Fleece Mask", purpose: "Cắt lá theo hướng dẫn, đắp; cotton thấm nước tinh khiết/Toner nén lên lá đến khi đều mặt, để 20' tháo (không lau). Có thể kết hợp đèn ánh sáng sinh học/điện di lạnh." },
      { group: "Step 9 — Dưỡng & chống nắng", name: "Mask dưỡng ẩm", purpose: "0,5ml Mask dưỡng ẩm massage nhẹ cho thẩm thấu; chống nắng bảo vệ da (nếu ban ngày)." },
    ],
  },
  {
    code: "PROTO-KLAPP-REPAGEN",
    name: "Klapp — Repagen Exclusive Treatment Strong (trẻ hóa Peptides)",
    purpose: "Trị liệu trẻ hóa da cao cấp với Peptides (9 bước).",
    contraindications: "Mở bạch huyết từ sâu trước khi đắp mặt nạ Peel. Khi thoa Peel Mask có thể cảm giác nóng/châm chích là bình thường.",
    items: [
      ...PRE,
      { group: "Bước 1 — Tẩy trang", name: "MLP Cleansing Milk", purpose: "2ml tản đều toàn mặt nền da khô, nhũ hóa, lau sạch khăn ẩm." },
      { group: "Bước 2 — Rửa mặt", name: "MLP Cleansing Gel", purpose: "0,5ml gel + nước tạo bọt, rửa mặt." },
      { group: "Bước 3 — Hút dầu bả nhờn", name: "Xông hơi hút bả nhờn", purpose: "Kích thích tuần hoàn, dãn nở làm sạch bả nhờn." },
      { group: "Bước 4 — Toner cân bằng", name: "MLP Skin Perfection PHA Toner", purpose: "Cotton lau mặt qua nước cân bằng da." },
      { group: "Bước 5 — Peel", name: "Peel Mask", purpose: "Thoa nhanh bằng cọ, tránh mắt và môi; để lớp mặt nạ tác dụng ≈15 phút, không rửa lại.", durationMinutes: 15 },
      { group: "Bước 6 — Đắp nạ dạng bột dẻo", name: "Facial Mask", purpose: "Pha với nước tỉ lệ 1:1, thoa lên trên lớp Peel Mask để ≈15', loại bỏ và lau sạch khăn ẩm, cân bằng da." },
      { group: "Bước 7 — Tinh chất đặc trị", name: "Concentrate", purpose: "Thoa và massage nhẹ đến khi thẩm thấu hoàn toàn." },
      { group: "Bước 8 — Mặt nạ miếng dán nâng cơ", name: "Facial Patch", purpose: "Đắp miếng dán mặt nạ lên mặt, để 20-30', tháo miếng dán." },
      { group: "Bước 9 — Kem dưỡng", name: "Cream Mask", purpose: "Thoa và vỗ nhẹ đến khi thẩm thấu; chống nắng bảo vệ da." },
    ],
  },
];

// Dịch vụ Klapp + giá lẻ (giá bán hiện tại). `orig` = giá gốc gạch ngang (lưu vào mô tả).
// protoCode: gắn protocol mặc định khi tên khớp bảng đào tạo.
const services: { code: string; name: string; cat: string; minutes: number; price: number; orig: number; desc: string; protoCode?: string }[] = [
  // --- Skin Boost Treatment (chưa có ảnh quy trình — tạo dịch vụ + giá) ---
  { code: "DV-KLAPP-HYDRA-BOOST", name: "Klapp Hydra Boost — Cấp ẩm chuyên sâu", cat: "KLAPP-BOOST", minutes: 60, price: 600_000, orig: 1_000_000, desc: "Liệu trình cấp ẩm chuyên sâu." },
  { code: "DV-KLAPP-REJU-SKIN", name: "Klapp Reju Skin — Sáng da, ngừa lão hóa quang học", cat: "KLAPP-BOOST", minutes: 60, price: 600_000, orig: 1_000_000, desc: "Liệu trình sáng da, ngừa lão hóa quang học." },
  { code: "DV-KLAPP-CALMING", name: "Klapp Calming Therapy — Làm dịu, phục hồi da nhạy cảm", cat: "KLAPP-BOOST", minutes: 60, price: 800_000, orig: 1_500_000, desc: "Liệu trình làm dịu, phục hồi da nhạy cảm." },
  { code: "DV-KLAPP-ACNE-CARE", name: "Klapp Acne Care — Chăm sóc chuyên sâu cho da mụn", cat: "KLAPP-BOOST", minutes: 60, price: 600_000, orig: 1_000_000, desc: "Liệu trình chăm sóc chuyên sâu cho da mụn." },
  { code: "DV-KLAPP-ACNE-PRO", name: "Klapp Acne Pro Care — Chăm sóc da mụn viêm đỏ", cat: "KLAPP-BOOST", minutes: 60, price: 800_000, orig: 1_500_000, desc: "Liệu trình chăm sóc da mụn viêm đỏ." },
  // --- Professional Treatment (có ảnh quy trình → gắn protocol) ---
  { code: "DV-KLAPP-ASA-PEEL", name: "Klapp ASA Peel Face Treatment — Thay da sinh học", cat: "KLAPP-PRO", minutes: 60, price: 1_200_000, orig: 2_000_000, desc: "Liệu trình thay da sinh học ASA Peel.", protoCode: "PROTO-KLAPP-ASA-PEEL" },
  { code: "DV-KLAPP-CPURE", name: "Klapp C Pure Face Infusion Treatment — Sáng da cao cấp", cat: "KLAPP-PRO", minutes: 70, price: 1_700_000, orig: 2_500_000, desc: "Liệu trình sáng da cao cấp (Vitamin C).", protoCode: "PROTO-KLAPP-CPURE" },
  { code: "DV-KLAPP-HYALURONIC-MULTIPLE", name: "Klapp Hyaluronic Multiple Effect Treatment — Cấp ẩm da khô lão hóa", cat: "KLAPP-PRO", minutes: 70, price: 1_600_000, orig: 2_400_000, desc: "Liệu trình cấp ẩm cho da khô lão hóa.", protoCode: "PROTO-KLAPP-HYALURONIC-MULTIPLE" },
  { code: "DV-KLAPP-CAVIAR", name: "Klapp Caviar Age Reducing Treatment — Trẻ hóa da với DNA cá tầm", cat: "KLAPP-PRO", minutes: 70, price: 1_700_000, orig: 2_500_000, desc: "Liệu trình trẻ hóa da với DNA cá tầm.", protoCode: "PROTO-KLAPP-CAVIAR" },
  { code: "DV-KLAPP-REPAGEN", name: "Klapp Repagen Treatment Strong — Trẻ hóa da với Peptides", cat: "KLAPP-PRO", minutes: 70, price: 1_800_000, orig: 2_800_000, desc: "Liệu trình trẻ hóa da với Peptides.", protoCode: "PROTO-KLAPP-REPAGEN" },
];

async function main() {
  const brKlapp = await prisma.brand.upsert({
    where: { code: "BR-KLAPP" }, update: {},
    create: { code: "BR-KLAPP", name: "Klapp", description: "KLAPP Cosmetics — mỹ phẩm điều trị chuyên nghiệp (Đức)" },
  });

  for (const p of protocols) {
    await prisma.brandProtocol.upsert({
      where: { code: p.code }, update: {},
      create: {
        code: p.code, name: p.name, kind: "BRAND", brandId: brKlapp.id, status: "ACTIVE", version: 1,
        compositionMode: "LEGACY_STEPS", purpose: p.purpose, ...(p.contraindications ? { contraindications: p.contraindications } : {}),
        steps: { items: p.items }, recommendedFreq: "Theo liệu trình", createdBy: "Trần Quản Lý",
      } as any,
    });
  }
  console.log(`   Protocol Klapp: ${protocols.map((p) => p.code.replace("PROTO-KLAPP-", "")).join(" · ")} (${protocols.length} protocol).`);

  const catBoost = await prisma.serviceCategory.upsert({ where: { code: "DM-KLAPP-BOOST" }, update: {}, create: { code: "DM-KLAPP-BOOST", name: "Klapp Skin Boost" } });
  const catPro = await prisma.serviceCategory.upsert({ where: { code: "DM-KLAPP-PRO" }, update: {}, create: { code: "DM-KLAPP-PRO", name: "Klapp Professional" } });
  for (const s of services) {
    const proto = s.protoCode ? await prisma.brandProtocol.findUnique({ where: { code: s.protoCode }, select: { id: true } }) : null;
    await prisma.service.upsert({
      where: { code: s.code },
      update: { standardPrice: s.price }, // cập nhật giá lẻ khi chạy lại
      create: {
        code: s.code, name: s.name, categoryId: s.cat === "KLAPP-BOOST" ? catBoost.id : catPro.id, status: "ACTIVE",
        durationMinutes: s.minutes, standardPrice: s.price, expectedCost: 0, version: 1,
        description: `${s.desc} Giá gốc niêm yết: ${s.orig.toLocaleString("vi-VN")}₫.`,
        defaultProtocolId: proto?.id ?? null,
      },
    });
  }
  console.log(`   Dịch vụ Klapp: ${services.length} dịch vụ (giá lẻ 600k–1.800k). 5 Skin Boost + 5 Professional (gắn protocol).`);

  const n = await prisma.brandProtocol.count({ where: { code: { startsWith: "PROTO-KLAPP-" } } });
  const m = await prisma.service.count({ where: { code: { startsWith: "DV-KLAPP-" } } });
  console.log(`✅ Nạp xong thư viện Klapp — ${n} protocol PROTO-KLAPP-*, ${m} dịch vụ DV-KLAPP-*.`);
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });
