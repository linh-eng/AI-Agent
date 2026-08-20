// prisma/seed-dermalogica-products.ts — Nạp DANH MỤC SẢN PHẨM Dermalogica (SpaProduct catalog).
// Nguồn: tài liệu kiến thức sản phẩm Dermalogica (Google Doc) do khách hàng cung cấp — transcribe TRUNG THỰC
// (công dụng/cách dùng/thành phần). Idempotent (upsert theo sku). Chạy: npm run seed:dermalogica:products
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type P = { sku: string; name: string; description: string | null; usage: string | null; ingredients: string | null };
const products: P[] = [
  {
    "sku": "DERMA-PRECLEANSE",
    "name": "PreCleanse",
    "description": "dầu làm sạch trọng lượng nhẹ giúp hoá lỏng các chất bã nhờn và chất bẩn dạng dầu khỏi bề mặt da. Hoà tan các thành phần trang điểm dạng dầu, mascara không trôi, chống nắng và chất bã nhờn. Làm sạch sâu mà không gây ảnh hưởng đến lớp hàng rào, giúp giảm sự tắc nghẽn bên dưới da và mụn cám, mang đến một làn da sạch và mềm mại hơn. Tuyệt vời cho tất cả các tình trạng và loại da, đặc biệt là với da dầu!",
    "usage": "Cho 1-2 ấn sản phẩm ra tay khô và thoa đều lên bề mặt khô. Mátxa để hoà tan chất dầu và bụi bẩn trên bề mặt da, tập trung vào những khu vực có tắc nghẽn hoặc mảng bám. Chuyển thể sữa bằng cách làm ướt tay rồi tiếp tục mátxa để tạo thể nhũ tương nhẹ, màu trắng đục. Rửa sạch bằng nước ấm, sau đó rửa lần hai bằng loại rửa mặt dermalogica được chỉ định.",
    "ingredients": "-Dầu hạt Borage: được dùng trong trị liệu chống viêm sưng, eczema, thiếu nước và vảy sừng."
  },
  {
    "sku": "DERMA-SPECIAL-CLEANSING-GEL",
    "name": "Special Cleansing Gel",
    "description": "Một giải pháp làm sạch dạng tạo bọt dành cho những ai yêu thích sản phẩm tạo bọt. Một sản phẩm anh hùng hoàn toàn không chứa xà phòng giúp lấy đi hoàn toàn các bụi bẩn mà không làm ảnh hưởng đến lớp hàng rào bảo vệ tự nhiên của da. Dành cho tất cả các tình trạng da.",
    "usage": "Dùng sau khi đã rửa đi PreCleanse or PreCleanse Balm, tạo bọt một lượng nhỏ gel bằng ½ lóng tay út trong tay ẩm và thoa lên bề mặt da và cổ đã được làm ướt trước. Rửa lại bằng nước ấm. Dùng buổi sáng và / hoặc buổi tối.",
    "ingredients": "●Quillaja Saponaria: một chiết xuất thực vật có tính năng tạo bọt tự nhiên giúp loại bỏ nhẹ nhàng bụi bẩn và dầu dư thừa."
  },
  {
    "sku": "DERMA-CLEARING-SKIN-WASH",
    "name": "Clearing Skin Wash",
    "description": "một giải pháp làm sạch dạng tạo bọt tự nhiên, không gây kích ứng là một khởi đầu hoàn hảo để kiểm soát mụn, tắc nghẽn và dầu dư thừa trên bề mặt da suốt ngày đêm mà không làm ảnh hưởng đến lớp hàng rào của da. Sự kết hợp hiệp lực giữa các thảo mộc chống mụn và Salicylic Acid giúp làm sạch làn da bị tắc nghẽn. Các thảo mộc làm dịu giúp làm dịu làn da bị viêm sưng và kích ứng.",
    "usage": "Sau khi rửa sạch Precleanse, lấy lượng 2/3 lóng tay út ra tay ướt. Thêm nước tạo bọt và mát xa lên vùng mặt và cổ đã được làm ẩm. Rửa lại bằng nước ấm. Dùng buổi sáng hoặc buổi tối.",
    "ingredients": null
  },
  {
    "sku": "DERMA-DAILY-MICROFOLIANT",
    "name": "Daily Microfoliant",
    "description": "Tẩy da chết làm sáng, dạng bột mịn đủ nhẹ để sử dụng hàng ngày. Nó sử dụng kết hợp các chất tẩy tế bào chết hóa học và vật lý để thúc đẩy quá trình tái tạo tế bào và loại bỏ cực nhẹ các mảng tế bào xỉn màu để mang lại làn da sáng và mịn hơn rõ rệt. Công thức bột kích hoạt khi tiếp xúc với nước, giải phóng các enzyme từ Đu Đủ và Gạo cùng với Salicylic Acid để làm mịn da và đẩy nhanh quá trình tái tạo tế bào. Dành cho mọi tình trạng da (không dùng cho những người sử dụng Retin-A và Isotretinoin (thường được bán trên thị trường là Accutane).",
    "usage": "Sau khi thực hiện bước làm sạch gấp đôi của Dermalogica, cho ½ muỗng cà phê Daily Microfoliant ra tay ướt và xoa hai tay với nhau để tạo thành một dạng kem sệt. Nhẹ nhàng mátxa theo chuyển động tròn trên da đã làm sạch trong 1 phút. Rửa sạch. Sử dụng hàng ngày: sáng hoặc tối.",
    "ingredients": "●Cám gạo và chiết xuất từ gạo: nhẹ nhàng vi tẩy các tế bào chết trên bề mặt da."
  },
  {
    "sku": "DERMA-DAILY-SUPERFOLIANT",
    "name": "Daily Superfoliant",
    "description": "Daily Superfoliant là một chất tái tạo bề mặt dạng bột chống ô nhiễm có hoạt tính cao. Độ pH trung tính giúp mở các lỗ chân lông để thúc đẩy loại bỏ các chất ô nhiễm. Bộ ba enzyme từ Đu Đủ, Lipase và Subtilisin tiêu hóa các protein để lại làn da siêu mịn, hấp thụ các chất ô nhiễm. Chiết xuất từ Tảo Đỏ và quả Tara tạo thành một phức hợp chống bám dính giúp ngăn chặn các chất ô nhiễm xâm nhập và bám vào da. Dành cho da thường đến da lão hóa sớm. Nó sẽ loại bỏ nhiều lớp tế bào hơn so với Daily Microfoliant. Daily Superfoliant được thiết kế cho da khô và lão hóa, khi mà quá trình tái tạo và bong tróc tế bào bị chậm lại.",
    "usage": "Sau khi rửa mặt sạch, cho khoảng nửa muỗng nhỏ Daily Superfoliant vào bàn tay thật ướt và xoa hai tay vào nhau để tạo hỗn hợp dạng kem sệt. Thoa đều lên mặt theo chuyển động tròn, tránh vùng mắt. Mát xa nhẹ nhàng trong khoảng một phút, sau đó rửa lại thật sạch bằng nước ấm.",
    "ingredients": "●Alpha Hydroxy Acids làm mịn da: Lactic Acid là một trong những AHA hiệu quả nhất và ít gây kích ứng da nhất. Lactic Acid giúp tái kết cấu bề mặt da, đồng thời kích thích sự thay đổi tế bào và tái tạo tế bào."
  },
  {
    "sku": "DERMA-DAILY-MILKFOLIANT",
    "name": "Daily Milkfoliant",
    "description": "Tẩy tế bào chết dạng bột sữa thuần chay với tinh chất từ Yến Mạch và Dừa, hoạt hoá ngay khi tiếp xúc với nước, giải phóng các chiết xuất thảo mộc giúp đánh bóng bề mặt da để lộ ra một làn da mềm mịn và đầy sức sống hơn, đồng thời bổ sung và hỗ trợ hàng rào độ ẩm của da, thư giãn làn da với các thành phần làm dịu và trấn an.",
    "usage": "Lấy khoảng nửa muỗng cà-phê sản phẩm ra tay ướt và tạo bọt nhẹ. Thoa lên da theo các chuyển động tròn, tránh vùng mắt. Mát-xa trong một phút. Rửa sạch đi sau đó.",
    "ingredients": "•Bột Yến Mạch mịn: chất tẩy da chết dạng cơ học nhẹ nhàng cọ bỏ các tạp chất khỏi da, đồng thời làm lỏng các tế bào da chết."
  },
  {
    "sku": "DERMA-MULTI-ACTIVE-TONER",
    "name": "Multi-Active Toner",
    "description": "Một giải pháp dạng xịt siêu nhẹ, dưỡng ẩm với độ cô đặc siêu bão hòa từ Lô Hội để làm dịu và chữa lành. Oải Hương, Nhựa Bạc Hà. và Kim Sa cung cấp tính năng nuôi dưỡng, điều hoà và làm dịu da. Giúp tạo độ xốp cân bằng để hấp thụ độ ẩm tối ưu, chuẩn bị cho làn da tiếp nhận các sản phẩm Dermalogica khác. Dùng cho mọi tình trạng da.",
    "usage": "Xịt Multi-Active Toner trực tiếp lên mặt, cổ với mắt nhắm. Theo sau với kem dưỡng ẩm Dermalogica theo chỉ định của bạn. Buổi sáng và buổi tối hoặc bất cứ lúc nào trong ngày cần bổ sung nước.",
    "ingredients": "●Hoa oải hương: chiết xuất có tính sát trùng tự nhiên giúp làm dịu và thanh lọc làn da."
  },
  {
    "sku": "DERMA-ANTIOXIDANT-HYDRAMIST",
    "name": "Antioxidant HydraMist",
    "description": "Một lớp màng chắn chống oxy hóa làm tươi mới với đặc tính làm săn chắc nhanh chóng để cải thiện kết cấu da. Chống lại tác hại của các gốc tự do và cấp nước chuyên sâu cho làn da khô và mất nước để giảm nếp nhăn, đồng thời kích thích sự săn chắc và đàn hồi. Bổ sung hàng rào bảo vệ của da bằng cách tạo ra một lá chắn chống oxy hóa tích cực để chống lại các gốc oxy phản ứng gây hại (ROS, còn được gọi là các gốc tự do). Giải pháp hoàn hảo cho môi trường đô thị và làn da có dấu hiệu lão hóa. Giải pháp phun sương siêu nạp với các chất chống oxy hóa để chống lại ô nhiễm. Chiết xuất Hạt Đậu mang lại hiệu quả săn chắc nhanh chóng.",
    "usage": "Nhắm mắt và phun sương trực tiếp lên da đã rửa sạch, hoặc xuyên suốt cả ngày.",
    "ingredients": "●Arginine / Lysine Polypeptide: là một peptide hoạt động như một “bẫy đường”, liên kết các chất đường với chính nó để giúp ngăn chặn sự hình thành AGEs."
  },
  {
    "sku": "DERMA-ACTIVE-MOIST",
    "name": "Active Moist",
    "description": "Một loại kem dưỡng ẩm prebiotic nhẹ, không chứa dầu giúp dưỡng ẩm cho da hỗn hợp hoặc da dầu.",
    "usage": "Sau khi làm sạch da và xịt toner, thoa đều khắp mặt và cổ bằng những động tác vuốt nhẹ, hướng lên. Sử dụng hai lần mỗi ngày, sáng và tối.",
    "ingredients": "●Hợp chất dưỡng ẩm Prebiotic kết hợp một hệ thống prebiotic quyền năng với hỗn hợp độc đáo của các chiết xuất thực vật, tạo thành một lớp thảo một trên da để dưỡng ẩm lâu dài, cải thiện kết cấu da và một hệ vi sinh vật khỏe mạnh."
  },
  {
    "sku": "DERMA-SKIN-SMOOTHING-CREAM",
    "name": "Skin Smoothing Cream",
    "description": "Kem dưỡng ẩm thế hệ tiếp theo có hợp chất tân tiến giúp cung cấp độ ẩm cho da để giảm mất nước qua biểu bì (TEWL) và bảo vệ hệ vi sinh vật tự nhiên của da. Lý tưởng cho làn da khô, mất nước hoặc lão hóa sớm.",
    "usage": "Sau khi làm sạch da và thoa toner, thoa đều khắp mặt và cổ bằng những động tác vuốt nhẹ, hướng lên. Sử dụng hai lần mỗi ngày, sáng và tối.",
    "ingredients": "•Công nghệ Lưới Tạo Ẩm Hoạt Tính Active HydraMesh truyền nước cho da trong 48 giờ liên tục và giúp bảo vệ khỏi tác động của môi trường. Nó hoạt động ở cấp độ phân tử để tạo thành một bề mặt giống như lưới trên da - giảm TEWL. Dưỡng ẩm và bảo vệ da theo hai giai đoạn."
  },
  {
    "sku": "DERMA-INTENSIVE-MOISTURE-BALANCE",
    "name": "Intensive Moisture Balance",
    "description": "Một loại kem dưỡng siêu nuôi dưỡng phục hồi sự cân bằng lipid cho da khô, suy kiệt để có hiệu suất hàng rào tối ưu. Tăng cường hàng rào lipid của da và giúp tái cân bằng hệ vi sinh vật.",
    "usage": null,
    "ingredients": "•Phức hợp Bổ Sung Sinh Học BioReplenish Complex™: mang đến sự kết hợp đã được kiểm chứng của các chất béo hàng rào chủ đạo để giúp tăng cường khả năng phục hồi tự nhiên của da và hỗ trợ phục hồi lớp hàng rào."
  },
  {
    "sku": "DERMA-PRISMA-PROTECT-SPF30",
    "name": "Prisma Protect SPF30",
    "description": "Một loại kem dưỡng ẩm đa nhiệm vụ, hoạt động với chế độ phòng vệ ánh sáng của da để chống lại tia UV, tác hại của các gốc tự do và ô nhiễm, thêm nước cho làn da mịn màng rõ rệt suốt cả ngày và tăng cường độ sáng tự nhiên của da.",
    "usage": "Sau khi làm sạch và dùng toner, thoa một lượng vừa đủ lên mặt và cổ, tốt nhất là 30 phút trước khi ra nắng.",
    "ingredients": "•Công nghệ quả cầu ánh sáng: sử dụng các viên nang được định vị để kích hoạt bởi nguồn ánh sáng thấy được chuyển hóa thành nguồn năng lượng - cuối cùng giúp tăng độ sáng tự nhiên của da."
  },
  {
    "sku": "DERMA-INVISIBLE-PHYSICAL-DEFENSE-SPF-30",
    "name": "Invisible Physical Defense SPF 30",
    "description": "Kem chống nắng vật lý vô hình, phù hợp với mọi làn da. Nó dễ dàng hòa hợp với mọi tông màu da, bảo vệ da khỏi tia UVA / UVB / ánh sáng xanh và làm dịu mọi loại da, kể cả nhạy cảm. Cảm giác không trọng lượng và khả năng dễ thoa của nó khiến nó trở thành lựa chọn tuyệt vời cho những khách hàng có làn da nhạy cảm hoặc bị nhạy cảm sau điều trị và những khách hàng thích kem chống nắng vật lý. Cũng được chứng nhận thân thiện với động vật, không chứa gluten và thuần chay để phù hợp với nhiều lối sống hơn.",
    "usage": null,
    "ingredients": "•Oxit kẽm cực kỳ trong suốt cung cấp lớp bảo vệ Quang phổ rộng và thấm vào da như vô hình."
  },
  {
    "sku": "DERMA-DYNAMIC-SKIN-RECOVERY-SPF50",
    "name": "Dynamic Skin Recovery SPF50",
    "description": "Kem dưỡng ẩm làm dịu hàng ngày với trọng lượng trung bình, chứa Broad Spectrum SPF50. Kích thích độ đàn hồi, săn chắc và thêm nước đồng thời giúp bảo vệ chống lại các tác nhân chính gây lão hóa da. Cung cấp độ bảo vệ thiết yếu khỏi sự tiếp xúc với ánh sáng ban ngày, đồng thời hoà hợp nhẹ nhàng vào da để tạo ra một lớp bao bọc hoàn thiện.",
    "usage": "Sau khi làm sạch và dùng toner, thoa một lượng vừa đủ lên mặt và cổ, tốt nhất là 30 phút trước khi ra nắng. Sử dụng như kem dưỡng ẩm hàng ngày của bạn để bảo vệ quanh năm khỏi tác hại của ánh nắng mặt trời và các gốc tự do.",
    "ingredients": "•Quang Phổ Rộng SPF 50: các chất chống nắng hoạt tính bảo vệ chống lại các tia UVB và UVA. Hoà lẫn vào da một cách nhẹ nhàng để có độ che phủ hoàn hảo."
  },
  {
    "sku": "DERMA-POWERBRIGHT-MOISTURIZER-SPF50",
    "name": "PowerBright Moisturizer SPF50",
    "description": "Kem dưỡng ẩm ban ngày SPF Quang Phổ Rộng giúp che chắn chống lại các đốm sậm màu, đồng thời chống lại sự căng thẳng có tính oxy hoá do ô nhiễm gây ra.",
    "usage": "Thoa lên mặt và cổ 30 phút trước khi ra nắng.",
    "ingredients": "•Dầu Hoa Rum cấp nước liên tục và giúp da giữ ẩm."
  },
  {
    "sku": "DERMA-SKIN-PERFECT-PRIMER-SPF-30",
    "name": "Skin Perfect Primer SPF 30",
    "description": "Một sản phẩm đa chức năng không chỉ hoạt động như một lớp lót trang điểm, tăng cường vẻ ngoài và thời lượng của lớp trang điểm, mà còn điều hoà và điều trị các dấu hiệu lão hóa, đồng thời bảo vệ da trước các tác động từ môi trường có thể góp phần gây lão hóa sớm. Một peptide quyền năng giúp cải thiện độ săn chắc của da, vì kem chống nắng bảo vệ khỏi tác hại của ánh nắng mặt trời. Dùng cho mọi tình trạng da.",
    "usage": "Sau khi thoa kem dưỡng ẩm Dermalogica theo chỉ định, thoa đều khắp mặt và cổ. Có thể thoa một mình hoặc thoa bên dưới lớp trang điểm để tăng độ bám của trang điểm.",
    "ingredients": "•Bột ngọc trai và khoáng chất đất tự nhiên - Giàu amino acid, canxi, đường và peptide, loại bột mịn này cung cấp màu ánh trung tính để hoàn thiện màu da, kích thích tái tạo tế bào, chống lại quá trình đường hóa và tăng cường độ sáng và rạng rỡ."
  },
  {
    "sku": "DERMA-MULTIVITAMIN-THERMAFOLIANT",
    "name": "MultiVitamin Thermafoliant",
    "description": "giải pháp làm bóng da bằng nhiệt quyền năng kết hợp tẩy tế bào chết vật lý và hóa học để cải thiện ngay lập tức kết cấu da, cho làn da mịn màng, tươi tắn hơn và củng cố khả năng thẩm thấu của các vitamin chống lão hóa. Các hạt vi lượng giúp tái tạo bề mặt nhẹ nhàng đánh bay các tế bào da xỉn màu, để lộ làn da mịn màng, tươi tắn hơn ngay lập tức. Công nghệ tạo nhiệt kích hoạt khi tiếp xúc với nước để giúp các thành phần có lợi thẩm thấu sâu hơn vào da. Cung cấp khả năng bảo vệ chống oxy hóa đồng thời ngăn chặn sự hình thành lão hóa. Da sẽ được cải thiện đáng kể và mịn màng hơn.",
    "usage": "sau khi rửa mặt, thoa lên bề mặt da hơi ẩm bằng các chuyển động tròn trong 1-2 phút, tránh vùng mắt.",
    "ingredients": "●Polylactic Acid, Silica và Sodium Bicarbonate - một hỗn hợp bột khoáng mịn giúp loại bỏ tế bào da chết, giúp giảm thiểu nếp nhăn và cải thiện kết cấu tổng thể của da. Loại bỏ các tế bào dư thừa gây cản trở sự thẩm thấu của các thành phần hoạt tính."
  },
  {
    "sku": "DERMA-MULTIVITAMIN-POWER-RECOVERY-MASQUE",
    "name": "MultiVitamin Power Recovery Masque",
    "description": "Một mặt nạ quyền năng với các vitamin chống oxy hóa cô đặc giúp làn da bị căng thẳng hoặc phục hồi sau những tác hại từ môi trường. Vitamin A, C, E và F phục hồi trong khi chiết xuất Yến mạch và Cam thảo làm dịu làn da bị kích ứng. Tuyệt vời cho da khô và lão hóa sớm.",
    "usage": "Thoa đều lên mặt và cổ đã được làm sạch, tránh vùng mắt. Để mặt nạ thấm trong 7-10 phút. Nhẹ nhàng rửa sạch bằng nước ấm. Áp dụng 2 lần mỗi tuần hoặc bất cứ khi nào da cần một biện pháp làm dịu.",
    "ingredients": "●Vitamin A, Vitamin C, Vitamin E, Vitamin F - một loại axit béo thiết yếu và Panthenol (Pro-vitamin B5): giúp sửa chữa và phục hồi làn da bị tổn thương."
  },
  {
    "sku": "DERMA-MELTING-MOISTURE-MASQUE",
    "name": "Melting Moisture Masque",
    "description": "Một mặt nạ giữ lại trên da độc đáo với tính năng dưỡng ẩm cực cao, chuyển hoá từ dạng cọ sáp thành dầu để giúp phục hồi và nuôi dưỡng làn da khô.",
    "usage": "Thoa một lượng khoảng bằng hạt đậu nhỏ lên mặt và nhẹ nhàng mátxa vào da. Giữ lại trên da. Dùng khăn giấy để lau đi sản phẩm còn sót lại, nếu cần. Sử dụng một hoặc hai lần một tuần, hoặc khi cần thiết.",
    "ingredients": "•Hợp chất Điểm Hoà Tan MeltingPoint giúp phục hồi các lipids trong lớp hàng rào của da để giữ độ ẩm lại bên trong."
  },
  {
    "sku": "DERMA-SKIN-HYDRATING-MASQUE",
    "name": "Skin Hydrating Masque",
    "description": "Mặt nạ dạng gel dành cho da thiếu nước, đang không chỉ cần nước mà còn cần các chất béo quan trọng để giữ ẩm. Hyaluronic Acid liên kết chéo độc đáo cung cấp quá trình thêm nước theo thời gian để giúp cải thiện độ đàn hồi. Codium tăng và điều tiết hàm lượng độ ẩm. Dầu hạt cà chua chống oxy hóa làm trẻ hóa làn da căng thẳng và phục hồi lớp hàng rào lipid, trong khi cây Liễu Canada làm dịu da. Mặt nạ dưỡng ẩm, tươi mát này là một phương thuốc tuyệt vời cho làn da khô, căng thẳng. Tuyệt vời cho mọi tình trạng da.",
    "usage": "Thoa một lớp mỏng lên vùng mặt và cổ đã rửa sạch, tránh vùng mắt. Để sản phẩm hoạt động trong 7-10 phút. Sử dụng 3 lần mỗi tuần.",
    "ingredients": "●Hyaluronic Acid: thành phần liên kết chéo độc đáo; tăng cường độ ẩm và cải thiện độ đàn hồi."
  },
  {
    "sku": "DERMA-PHYTO-REPLENISH-OIL",
    "name": "Phyto Replenish Oil",
    "description": "Một loại dầu điều trị rất nhẹ có khả năng hấp thụ nhanh chóng để củng cố hàng rào bảo vệ của da, giúp bổ sung lượng lipid bị cạn kiệt, khoá giữ độ ẩm thiết yếu, và chống lại tác hại của các gốc tự do. Dầu điều trị sử dụng hàng ngày với trọng lượng cực nhẹ này thẩm thấu nhanh chóng để giải quyết tình trạng khô và mất nước, đồng thời củng cố chức năng bảo vệ tự nhiên của da. Công thức này thúc đẩy quá trình sửa chữa da, bảo vệ khỏi ô nhiễm và củng cố hàng rào bảo vệ da tự nhiên. Dành cho làn da bình thường đến khô.",
    "usage": "Sau khi làm sạch da và thoa toner, nhỏ 4-6 giọt lên da. Dùng theo sau với kem dưỡng ẩm Dermalogica khuyên dùng. Ngoài ra, trộn với kem dưỡng ẩm Dermalogica để thoa. Giữ ngược chai trong 2-3 giây để sản phẩm chảy ra. Sử dụng hàng ngày.",
    "ingredients": "●Dầu hạt hoa trà: Một loại cây độc đáo có đặc tính hàng rào lipid giúp ngăn chặn TEWL. Chống lại gốc tự do cái mà góp phần phá vỡ màng tế bào giàu lipid trong da và khiến da dễ bị tổn thương. Cung cấp các lợi ích làm dịu (tuyệt hơn cả Bisabolol) và chống lão hóa. Chứa nguồn axit béo dồi dào và khả năng chống oxy hóa gấp đôi so với Vitamin E, Dầu hạt nho và Dầu tầm xuân."
  },
  {
    "sku": "DERMA-OVERNIGHT-REPAIR-SERUM",
    "name": "Overnight Repair Serum",
    "description": "Tối đa hóa quá trình chỉnh sửa da vào ban đêm để giúp giảm thiểu nếp nhăn và tăng độ sáng. Huyết thanh peptide siêu nạp này giúp kích thích sản xuất sợi săn chắc và tái tạo khả năng phục hồi trong khi Dầu Argan và Hoa Hồng giúp hồi sinh làn da kém sắc và làm mờ nếp nhăn. Hoạt động khi bạn ngủ để tăng độ săn chắc cho da, làm mờ nếp nhăn, thay thế lipid, nuôi dưỡng làn da khô và mất nước, bảo vệ và kích thích chỉnh sửa tế bào. Tuyệt vời cho da khô, mất nước hoặc lão hóa sớm.",
    "usage": "Nhỏ 4-6 giọt lên da sau khi rửa mặt như sản phẩm cuối cùng. Trộn 3-4 giọt với Power Rich hoặc kem dưỡng ẩm ban đêm Dermalogica của bạn hoặc thoa dưới kem dưỡng ẩm được chỉ định của bạn.",
    "ingredients": "●Dầu Argan: thấm nhanh vào da mà không gây cảm giác nhờn dính. Nguồn giàu chất chống oxy hóa ngăn chặn Enzym. Cung cấp axit béo, Vitamin E và Ferulic Acid trong các mô thực vật để bảo vệ da đồng thời củng cố lớp lipid hàng rào."
  },
  {
    "sku": "DERMA-MULTIVITAMIN-POWER-FIRM",
    "name": "MultiVitamin Power Firm",
    "description": "Giúp sửa chữa các dấu hiệu lão hóa sớm với việc truyền tổng hợp vitamin. Tăng độ đàn hồi và săn chắc cho da bằng cách kích thích tổng hợp sợi săn chắc và củng cố các liên kết giữa tế bào với tế bào. Loại bỏ các gốc tự do nguy hiểm để giúp bảo vệ da khỏi tác động của môi trường. Bảo vệ chống lại sự mất độ ẩm để giảm thiểu nếp nhăn do mất nước. Dành cho da khô, da thiếu nước hoặc lão hóa sớm.",
    "usage": "Thoa đều quanh vùng mắt, tập trung vào những vùng da bị lão hóa rõ rệt. Dùng vào buổi sáng và ban đêm.",
    "ingredients": "●Vitamin A, Vitamin C và Vitamin E - đẩy nhanh quá trình chỉnh sửa tự nhiên của da, tăng cường độ đàn hồi và cải thiện độ mịn màng đồng thời bảo vệ chống lại các gốc tự do."
  },
  {
    "sku": "DERMA-BIOLUMIN-C-EYE-SERUM",
    "name": "BioLumin-C Eye Serum",
    "description": "Một huyết thanh mắt Vitamin C siêu nạp giúp đẩy lùi các dấu lão hóa da sớm hiện hữu do những chuyển động mắt hàng ngày và áp lực môi trường để làm sáng tức thời và săn chắc rõ rệt.",
    "usage": "Sau khi làm sạch và trước khi dưỡng ẩm, nhỏ một giọt BioLumin-C Eye Serum và thoa dưới mắt và dọc theo hốc mắt vào buổi sáng và buổi tối. Tránh vào mắt.",
    "ingredients": "●Phức hợp Vitamin C : Sức mạnh tổng hợp độc đáo của hai phân tử Vitamin C cung cấp chức năng nâng cao trong việc chống lại căng thẳng oxy hóa. Đầu tiên là Ascorbyl Methylsilanol Pectinate cung cấp các lợi ích của Ascorbic Acid — cùng với Silicium, một thành phần tự nhiên trong da đóng vai trò quan trọng trong việc bảo vệ da. Thứ hai là Aminopropyl Ascorbyl Phosphate, là một dạng Vitamin C được đánh giá cao, được biết đến với tính ổn định và hiệu quả vượt trội. Công nghệ Vitamin C này được kết hợp với một dạng Palmitoyl Tripeptide-5 mạnh mẽ được điều chỉnh đặc biệt cho vùng mắt với các hoạt chất sinh học vượt trội để làm sáng rõ rệt, săn chắc và cấp ẩm cho vùng da mỏng manh quanh mắt."
  },
  {
    "sku": "DERMA-AGE-REVERSAL-EYE-COMPLEX",
    "name": "Age Reversal Eye Complex",
    "description": "Nhắm đến các mối quan tâm về vùng mắt, chủ yếu là nếp nhăn và vết chân chim cùng với bọng mắt, quầng thâm do tăng sắc tố và da nhạy cảm do mất nước. Chứa Retinol 0,1% vi nang giúp phục hồi độ săn chắc cho làn da lão hóa. Nó kích thích tái tạo tế bào, tăng sản xuất sợi săn chắc và giảm sự xuất hiện của các vết chân chim và nếp nhăn.",
    "usage": "Bắt đầu sử dụng cách ngày trong 2 tuần đầu tiên. Nếu không có kích ứng phát triển, bắt đầu sử dụng hàng đêm. Sau khi làm sạch, thoa đều và ấn nhẹ quanh vùng mắt theo hướng từ góc ngoài vào trong. Sử dụng cẩn thận gần hàng mi. Tránh tiếp xúc vào mắt.",
    "ingredients": "●Công nghệ Viên nang nén Retinol 0,1%: Một dạng Vitamin A mạnh mẽ, Retinol sở hữu khả năng vượt trội trong việc phục hồi độ săn chắc cho làn da lão hóa. Nó kích thích tái tạo tế bào, tăng sản xuất sợi săn chắc và giảm sự xuất hiện của các vết chân chim và nếp nhăn."
  },
  {
    "sku": "DERMA-STRESS-POSITIVE-EYE-LIFT",
    "name": "Stress Positive Eye Lift",
    "description": "Một loại mặt nạ dạng kem gel hoạt tính, giúp làm mát, hoạt động tương thích với hệ vi sinh vật tự nhiên của da, để làm sáng và tiếp sinh lực cho vùng mắt. Chiết xuất nước biển và tảo Bắc Cực giảm thiểu tình trạng bọng mắt và quầng thâm.",
    "usage": "Thoa đều xung quanh vùng mắt đã được làm sạch bằng đầu kim loại mát-xa làm mát. Để trong 3-5 phút. Mátxa bất kỳ sản phẩm còn sót lại nào vào da hoặc lau đi bằng khăn giấy. Sử dụng khi cần thiết để tăng cường nhanh chóng hoặc hàng ngày để giải quyết các dấu hiệu của chứng mỏi mắt mãn tính.",
    "ingredients": "●Chiết xuất hạt Chàm dại: giúp làm sáng da bằng cách tăng độ sáng dưới mắt, cải thiện tông màu da và giảm quầng thâm dưới mắt rõ rệt."
  },
  {
    "sku": "DERMA-INTENSIVE-EYE-REPAIR",
    "name": "Intensive Eye Repair",
    "description": "Kem dưỡng mắt cực kỳ giàu dưỡng chất thực vật bổ sung cho da, vitamin chống oxy hóa và các loại thực vật làm dịu giúp làm giảm các nếp nhăn và sửa chữa các tổn thương xung quanh vùng mắt mỏng manh. Vitamin C làm giảm sự xuất hiện của nếp nhăn trong khi chất chống oxy hóa chống lại tác hại của các gốc tự do. Các thảo mộc nuôi dưỡng và thêm nước.",
    "usage": null,
    "ingredients": "●Dưa leo, Cây Đậu Chổi và chiết xuất thực vật họ cây Cúc: chiết xuất làm dịu giúp duy trì độ đàn hồi và kết cấu của da."
  },
  {
    "sku": "DERMA-RENEWAL-LIP-COMPLEX",
    "name": "Renewal Lip Complex",
    "description": "Dưỡng ẩm điều trị môi hàng ngày giúp làm mịn và phục hồi. Thoa khi cần thiết để giúp cung cấp độ ẩm cho môi, phục hồi các mô mỏng manh, giảm thiểu các nếp nhăn và giúp ngăn ngừa các dấu hiệu lão hóa.",
    "usage": "Thoa lên môi hàng ngày để duy trì sức khỏe môi.",
    "ingredients": null
  }
];

async function main() {
  const br = await prisma.brand.upsert({
    where: { code: 'BR-DERMA' }, update: {},
    create: { code: 'BR-DERMA', name: 'Dermalogica', description: 'Dermalogica — chăm sóc da chuyên nghiệp (Mỹ)' },
  });
  for (const p of products) {
    await prisma.spaProduct.upsert({
      where: { sku: p.sku },
      update: { description: p.description, usage: p.usage, ingredients: p.ingredients }, // cập nhật kiến thức khi chạy lại
      create: {
        sku: p.sku, name: p.name, brandId: br.id, productType: 'HOME_CARE', isActive: true,
        description: p.description, usage: p.usage, ingredients: p.ingredients,
      },
    });
  }
  const n = await prisma.spaProduct.count({ where: { sku: { startsWith: 'DERMA-' } } });
  console.log(`✅ Nạp xong ${products.length} sản phẩm Dermalogica — ${n} SpaProduct DERMA-* trong catalog.`);
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });
