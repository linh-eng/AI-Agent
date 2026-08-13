const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak, TableOfContents, PositionalTab, PositionalTabAlignment, PositionalTabLeader,
} = require("docx");
const fs = require("fs");

const BRAND = "Sophia Wellness";
const ACCENT = "4F7D6E";
const INK = "242019";
const MUTED = "6B6459";

// ---- helpers ----
const H1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } });
const H2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 } });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, size: 22, color: INK, ...opts })] });
const NOTE = (t) => new Paragraph({
  spacing: { before: 60, after: 120 }, indent: { left: 200 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 12 } },
  children: [new TextRun({ text: t, size: 20, color: MUTED, italics: true })],
});
const bullet = (t, sub) => new Paragraph({
  numbering: { reference: sub ? "b2" : "b1", level: 0 },
  spacing: { after: 40 },
  children: parseBold(t),
});
const step = (n, t) => new Paragraph({
  numbering: { reference: "steps", level: 0 }, spacing: { after: 40 },
  children: parseBold(t),
});
// parse **bold** inside text
function parseBold(t) {
  const out = [];
  const parts = String(t).split(/(\*\*[^*]+\*\*)/g);
  for (const seg of parts) {
    if (!seg) continue;
    if (seg.startsWith("**") && seg.endsWith("**")) out.push(new TextRun({ text: seg.slice(2, -2), bold: true, size: 22, color: INK }));
    else out.push(new TextRun({ text: seg, size: 22, color: INK }));
  }
  return out;
}

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ACCENT, color: "auto" },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })] })],
    })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: ri % 2 ? { type: ShadingType.CLEAR, fill: "F3F1EC", color: "auto" } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, color: INK })] })],
    })),
  }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [headerRow, ...bodyRows] });
}

const spacer = () => new Paragraph({ text: "", spacing: { after: 60 } });

// ---- content ----
const children = [];

// Cover
children.push(new Paragraph({ spacing: { before: 2600, after: 0 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: BRAND, bold: true, size: 64, color: ACCENT })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
  children: [new TextRun({ text: "PHẦN MỀM QUẢN LÝ SPA & KHÁCH HÀNG", size: 26, color: INK })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
  children: [new TextRun({ text: "HƯỚNG DẪN SỬ DỤNG", bold: true, size: 40, color: INK })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Dành cho nhân viên · Phiên bản demo nội bộ", size: 20, italics: true, color: MUTED })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
children.push(new Paragraph({ text: "Mục lục", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
children.push(new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Giới thiệu & đăng nhập
children.push(H1("1. Giới thiệu & Đăng nhập"));
children.push(P(`${BRAND} là phần mềm quản lý toàn bộ hành trình khách hàng của spa/thẩm mỹ: từ Marketing → Khách hàng → Chăm sóc → Đánh giá → Phác đồ → Báo giá → Booking → Thực hiện buổi → Vật tư → Thanh toán → Theo dõi sau dịch vụ. Toàn bộ giao diện bằng tiếng Việt.`));
children.push(H2("Mở phần mềm"));
children.push(step(1, "Mở trình duyệt (Chrome/Edge), vào địa chỉ: **http://172.168.11.60:9500**"));
children.push(step(2, "Nhập **Email** và **Mật khẩu** rồi bấm **Đăng nhập**."));
children.push(step(3, "Vào thẳng màn hình **Tổng quan** của spa."));
children.push(NOTE("Nếu báo “Quá nhiều lần thử” — đó là cơ chế chống dò mật khẩu; chờ 1–2 phút rồi đăng nhập lại đúng thông tin."));
children.push(H2("Tài khoản demo (mật khẩu = <vai trò>123)"));
children.push(table(
  ["Vai trò", "Email đăng nhập", "Mật khẩu"],
  [
    ["Quản lý", "quanly@sophia.com.vn", "quanly123"],
    ["Lễ tân", "letan@sophia.com.vn", "letan123"],
    ["Chăm sóc KH (CSKH)", "cskh@sophia.com.vn", "cskh123"],
    ["Chuyên viên", "chuyenvien@sophia.com.vn", "chuyenvien123"],
    ["Thu ngân", "thungan@sophia.com.vn", "thungan123"],
    ["Marketing", "marketing@sophia.com.vn", "marketing123"],
    ["Quản trị (Admin)", "admin@sophia.com.vn", "admin123"],
  ],
  [2600, 4200, 2000]
));
children.push(NOTE("Nên đổi mật khẩu mặc định trước khi dùng thật. Mỗi vai trò chỉ thấy/làm được phần việc của mình (xem mục Phân quyền)."));

// 2. Tổng quan
children.push(H1("2. Màn hình Tổng quan"));
children.push(P("Menu: **Tổng quan**. Hiển thị nhanh tình hình hoạt động trong tháng:"));
children.push(bullet("**Booking hôm nay / sắp tới** — số lịch hẹn."));
children.push(bullet("**Khách mới trong tháng**, **Phác đồ đang chạy**, **Công việc quá hạn**."));
children.push(bullet("**Doanh thu / Chi phí / Lợi nhuận** (chỉ vai trò có quyền tài chính mới thấy số tiền)."));
children.push(P("Dùng màn này để nắm nhanh mỗi sáng: còn việc gì quá hạn, có bao nhiêu lịch hẹn, doanh thu ra sao."));

// 3. Khách hàng
children.push(H1("3. Quản lý Khách hàng"));
children.push(P("Menu: **Khách hàng**. Đây là trung tâm của mọi việc — mỗi khách có 1 hồ sơ chứa toàn bộ lịch sử."));
children.push(H2("Tạo khách hàng mới"));
children.push(step(1, "Bấm **Thêm mới** (góc trên phải)."));
children.push(step(2, "Nhập **Họ tên, Giới tính, SĐT, Email, Nguồn khách** (Facebook, giới thiệu…), **Nhóm** (Thường/VIP), **Người phụ trách**, **Mong muốn/mục tiêu**."));
children.push(step(3, "Bấm **Lưu** → khách xuất hiện trong danh sách, có mã tự động (VD KH-000123)."));
children.push(H2("Hồ sơ khách hàng (bấm vào tên khách)"));
children.push(P("Phía trên hiển thị thông tin + **Tổng giá trị / Đã thanh toán / Công nợ**. Bên dưới là các tab:"));
children.push(bullet("**Timeline** — toàn bộ hành trình (đánh giá, phác đồ, báo giá, buổi, CSKH, thanh toán…)."));
children.push(bullet("**Nhật ký CSKH** — lịch sử chăm sóc (xem mục 4)."));
children.push(bullet("**Booking, Phác đồ, Đánh giá** — các bản ghi của khách."));
children.push(bullet("**Sản phẩm đề xuất** — sản phẩm khuyên dùng (Thiết yếu/Khuyến nghị/Tùy chọn)."));
children.push(bullet("**Vật tư khách hàng** — vật tư dành riêng cho khách này (xem mục 10)."));
children.push(bullet("**Biểu mẫu, Hướng dẫn, Thanh toán** — phiếu đã điền, dặn dò, lịch sử thu tiền."));
children.push(P("Các nút nhanh trên hồ sơ: **Nhật ký CSKH, Thanh toán, Đánh giá, Đề xuất SP, Áp biểu mẫu, Gửi hướng dẫn, Cổng khách**."));

// 4. CSKH
children.push(H1("4. Nhật ký Chăm sóc khách hàng (CSKH)"));
children.push(P("Menu: **Khách hàng → hồ sơ → tab Nhật ký CSKH**, hoặc nút **Nhật ký CSKH**."));
children.push(step(1, "Bấm **Nhật ký CSKH** → chọn **loại** (Gọi điện, Tư vấn, Nhắn tin, Phản hồi, Khiếu nại, Nhắc lịch…)."));
children.push(step(2, "Nhập **nội dung** và **kết quả**. Nếu cần theo dõi tiếp: điền **Ngày follow-up** + **Người phụ trách**."));
children.push(step(3, "Bấm **Lưu**. Khi có ngày follow-up, hệ thống tự tạo **Công việc** để nhắc (xem menu Công việc)."));
children.push(NOTE("Mỗi lần chăm sóc là một bản ghi độc lập, không ghi đè — giữ đủ lịch sử."));

// 5. Booking
children.push(H1("5. Booking / Lịch hẹn"));
children.push(P("Menu: **Booking**."));
children.push(step(1, "Bấm **Thêm mới** → chọn **khách hàng, dịch vụ, ngày giờ, phòng, người thực hiện**."));
children.push(step(2, "Giá dịch vụ tự điền theo bảng giá; bấm **Lưu**."));
children.push(step(3, "Đổi **trạng thái** trực tiếp trong danh sách: Mới → Đã xác nhận → Khách đã đến → Đang thực hiện → Hoàn thành (hoặc Hủy/Không đến)."));
children.push(NOTE("Booking hoàn thành sẽ gắn với buổi thực hiện trong phác đồ. Quản lý lịch hẹn hiện làm ngay trong danh sách Booking."));

// 6. Dịch vụ
children.push(H1("6. Dịch vụ"));
children.push(P("Menu: **Dịch vụ**. Danh mục dịch vụ dùng chung cho báo giá, booking, phác đồ."));
children.push(step(1, "Bấm **Thêm dịch vụ** → nhập **tên, nhóm, thời lượng, giá chuẩn, giá vốn dự kiến**."));
children.push(step(2, "Bấm **Lưu**. Có thể tạo **Nhóm dịch vụ** để phân loại."));

// 7. Thư viện Spa
children.push(H1("7. Thư viện Spa"));
children.push(P("Nhóm menu **Thư viện Spa** gồm: Brand, Công nghệ, Protocol, Sản phẩm, Biểu mẫu, Hướng dẫn chăm sóc. Đây là “kho kiến thức” tái sử dụng khi thiết kế phác đồ/buổi."));
children.push(H2("Brand (Thương hiệu)"));
children.push(P("Menu **Brand**: quản lý thương hiệu (DMK, Dermalogica, Klapp…). Bấm **Thêm mới** để thêm brand."));
children.push(H2("Công nghệ"));
children.push(P("Menu **Công nghệ**: máy/công nghệ (Laser, RF, HIFU…) kèm chỉ định, chống chỉ định, thông số. Bấm **Thêm mới**."));
children.push(H2("Protocol (Quy trình chuyên môn)"));
children.push(P("Menu **Protocol**: quy trình nhiều bước, có **phiên bản (version)**. Mở 1 protocol để thêm **bước thực hiện**, gắn **công nghệ**, **sản phẩm**."));
children.push(NOTE("Protocol có version: khi sửa lên bản mới, các buổi đã áp bản cũ vẫn giữ nguyên nội dung cũ (không bị đổi theo)."));
children.push(H2("Sản phẩm"));
children.push(P("Menu **Sản phẩm**: danh mục sản phẩm theo brand (chuyên nghiệp/bán về nhà), có giá bán và giá vốn (giá vốn chỉ vai trò tài chính thấy)."));
children.push(H2("Biểu mẫu"));
children.push(P("Menu **Biểu mẫu**: thiết kế phiếu (đánh giá da, tư vấn…) bằng công cụ **kéo–thả**, hỗ trợ nhiều loại trường (văn bản, số, ngày, ảnh, chữ ký, bảng…) và **logic hiển thị có điều kiện**. Áp biểu mẫu cho khách/buổi để điền."));
children.push(H2("Hướng dẫn chăm sóc"));
children.push(P("Menu **Hướng dẫn chăm sóc**: thư viện dặn dò **trước** và **sau** dịch vụ. Khi gửi cho khách sẽ tạo bản riêng (cá nhân hóa được, không đổi mẫu gốc)."));

// 8. Phác đồ
children.push(H1("8. Phác đồ điều trị"));
children.push(P("Menu: **Phác đồ**. Đây là kế hoạch điều trị nhiều buổi cho một khách."));
children.push(H2("Tạo phác đồ"));
children.push(step(1, "Vào **Phác đồ → Thêm mới** (hoặc từ hồ sơ khách) → chọn khách, đặt tên, chẩn đoán, mục tiêu, tổng giá dự kiến."));
children.push(step(2, "Thêm **giai đoạn** (Chuẩn bị / Can thiệp / Duy trì…)."));
children.push(H2("Thêm buổi thực hiện"));
children.push(step(1, "Mở phác đồ → **Thêm buổi** → đặt tên buổi, chọn dịch vụ/công nghệ/protocol, mục tiêu, dặn dò trước."));
children.push(step(2, "Kéo–thả để **sắp xếp thứ tự** các buổi."));
children.push(H2("Ghi nhận buổi (khi thực hiện xong)"));
children.push(P("Mở phác đồ → tại buổi cần ghi, bấm **Ghi nhận buổi**. Trong màn này nhập:"));
children.push(bullet("**Thông số** trước/sau (độ ẩm, độ đàn hồi…), **tình trạng** trước/sau."));
children.push(bullet("**Ảnh Trước & Sau** — bấm tải ảnh lên. Muốn khách xem được trên Cổng khách thì bật ô **“Khách thấy”** ở từng ảnh (mặc định ảnh là riêng tư)."));
children.push(bullet("**Vật tư sử dụng** — chọn nguồn và số lượng (xem mục 10)."));
children.push(bullet("**Phản hồi của khách, dặn dò sau, chi phí thực tế, ghi chú** → bấm **Lưu**."));

// 9. Báo giá
children.push(H1("9. Báo giá (Proposal)"));
children.push(P("Menu: **Báo giá**. Cho phép đưa **nhiều phương án** để khách cân nhắc."));
children.push(step(1, "Bấm **Thêm mới** → chọn khách, đặt tiêu đề."));
children.push(step(2, "Tạo các phương án: **Cơ bản / Khuyến nghị / Chuyên sâu** — mỗi phương án thêm các **hạng mục** (dịch vụ, sản phẩm), số buổi, chiết khấu. Tổng tiền tự tính."));
children.push(step(3, "Gửi khách. Khi khách đồng ý, bấm **Khách chốt** → phương án được **đông cứng** (giá giữ nguyên dù sau này đổi bảng giá)."));

// 10. Vật tư
children.push(H1("10. Vật tư (2 khái niệm)"));
children.push(P("Nhóm menu **Vật tư**. Chỉ dùng **2 khái niệm** đơn giản:"));
children.push(H2("A. Kho vật tư sử dụng"));
children.push(P("Menu **Kho vật tư sử dụng**: vật tư/dung dịch chuyên môn theo **lọ/chai/lô**, **dùng chung nhiều khách, nhiều buổi**."));
children.push(bullet("Trên cùng có các thẻ: **Đang sử dụng / Lọ đang mở / Sắp hết / Sắp hết hạn / Tiêu hao hôm nay / Chi phí hôm nay**."));
children.push(bullet("Bấm **Thêm vật tư** (khai báo tên + đơn vị + định mức/buổi), rồi **Thêm lọ/lô** (số lượng ban đầu, giá vốn cả lọ, ngày mở, hạn dùng)."));
children.push(bullet("Mỗi lọ hiển thị **Còn / Ban đầu** và trạng thái. Bấm **Dùng** để ghi nhận tiêu hao; **Hủy lọ** khi bỏ."));
children.push(NOTE("Ví dụ: 1 lọ JetPeel 100ml. Khách A dùng 5ml, khách B 7ml, A dùng tiếp 6ml → còn 82ml; hệ thống tự tính chi phí từng buổi."));
children.push(H2("B. Vật tư khách hàng"));
children.push(P("Menu **Vật tư khách hàng**: vật tư **dành riêng 1 khách**, **không dùng cho khách khác**, dùng qua nhiều buổi."));
children.push(bullet("Bấm **Cấp vật tư cho khách** → chọn khách, tên vật tư, đơn vị, số lượng cấp."));
children.push(bullet("Cột **Đã cấp / Đã dùng / Còn lại** cập nhật tự động. Cũng xem được trong **hồ sơ khách → tab Vật tư khách hàng**."));
children.push(H2("Ghi nhận tiêu hao trong buổi"));
children.push(step(1, "Trong màn **Ghi nhận buổi** (mục 8), tại phần **Vật tư sử dụng**: chọn **Nguồn** = *Kho vật tư sử dụng* hoặc *Vật tư khách hàng*."));
children.push(step(2, "Chọn lọ/vật tư → xem **số còn lại** → nhập **số lượng dùng** → bấm **Ghi nhận**."));
children.push(step(3, "Tồn giảm ngay, chi phí cộng vào buổi. Danh sách đã dùng hiển thị ngay bên dưới."));
children.push(H2("Lịch sử & Báo cáo vật tư"));
children.push(bullet("**Lịch sử sử dụng** — mọi lần tiêu hao theo buổi/khách/nhân viên."));
children.push(bullet("**Báo cáo vật tư** — tiêu hao theo khách/buổi/dịch vụ/công nghệ/nhân viên + **định mức vs thực tế** + chi phí."));

// 11. Thanh toán
children.push(H1("11. Thanh toán & Công nợ"));
children.push(P("Menu: **Khách hàng → hồ sơ → nút Thanh toán** (hoặc tab Thanh toán)."));
children.push(step(1, "Bấm **Thanh toán** → nhập **số tiền, hình thức** (Tiền mặt/Chuyển khoản/Thẻ/Ví), người thu, ghi chú."));
children.push(step(2, "Bấm **Lưu**. Hồ sơ khách tự cập nhật **Đã thanh toán** và **Công nợ**."));
children.push(NOTE("Dữ liệu tài chính (giá vốn, chi phí, lợi nhuận) chỉ vai trò có quyền tài chính (Thu ngân/Quản lý/Admin) mới xem được."));

// 12. Marketing
children.push(H1("12. Marketing"));
children.push(P("Menu: **Marketing**."));
children.push(bullet("Tạo **Chiến dịch** (kênh, ngân sách, chi phí)."));
children.push(bullet("Quản lý **Lead** (khách tiềm năng): Mới → Đã liên hệ → Đã đặt lịch → Chuyển đổi/Mất. Có thể **chuyển lead thành khách hàng**."));
children.push(bullet("Xem **hiệu quả**: số lead/khách/booking/doanh thu, tỷ lệ chuyển đổi, ROI."));

// 13. Cổng khách
children.push(H1("13. Cổng khách hàng"));
children.push(P("Địa chỉ riêng cho khách: **http://172.168.11.60:9500/portal**. Khách đăng nhập bằng tài khoản riêng (email + mật khẩu do spa cấp)."));
children.push(P("Khách chỉ thấy **dữ liệu của chính mình**: báo giá, phác đồ, sản phẩm đề xuất, ảnh Trước/Sau **đã được chia sẻ**. Khách **không** thấy giá vốn, ghi chú nội bộ hay dữ liệu khách khác."));
children.push(NOTE("Muốn khách xem ảnh Trước/Sau: trong màn Ghi nhận buổi, bật ô “Khách thấy” ở ảnh tương ứng."));

// 14. Phân quyền
children.push(H1("14. Phân quyền (vai trò)"));
children.push(P("Mỗi tài khoản gắn 1 vai trò, quyết định thấy/làm được gì:"));
children.push(table(
  ["Vai trò", "Làm được gì"],
  [
    ["Quản lý", "Gần như toàn quyền nghiệp vụ spa + duyệt + xem tài chính"],
    ["Lễ tân", "Tạo khách, đặt lịch (booking), thu tiền cơ bản"],
    ["CSKH", "Nhật ký chăm sóc, follow-up, công việc"],
    ["Chuyên viên", "Đánh giá, thiết kế phác đồ/protocol, thực hiện & ghi nhận buổi, vật tư"],
    ["Thu ngân", "Thanh toán, công nợ, xem dữ liệu tài chính"],
    ["Marketing", "Chiến dịch, lead, ROI"],
    ["Admin", "Toàn quyền hệ thống"],
  ],
  [2600, 6200]
));
children.push(NOTE("Tạo tài khoản / đổi vai trò hiện do người quản trị làm ở tầng dữ liệu. Liên hệ bộ phận kỹ thuật khi cần thêm nhân viên."));

// 15. Mẹo & xử lý sự cố
children.push(H1("15. Mẹo & Xử lý sự cố thường gặp"));
children.push(bullet("**Đăng nhập báo “Quá nhiều lần thử”**: do nhập sai nhiều lần (chống dò mật khẩu). Chờ 1–2 phút rồi nhập đúng; nếu gấp, nhờ kỹ thuật xóa khóa."));
children.push(bullet("**Quên mật khẩu**: nhờ người quản trị đặt lại."));
children.push(bullet("**Ảnh khách không thấy trên Cổng khách**: kiểm tra đã bật ô “Khách thấy” ở ảnh chưa."));
children.push(bullet("**Không thấy số tiền/giá vốn**: do vai trò không có quyền tài chính — đúng thiết kế."));
children.push(bullet("**Số liệu tháng bằng 0**: do chưa có giao dịch phát sinh trong tháng hiện tại."));
children.push(spacer());
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 },
  children: [new TextRun({ text: `— Hết —  ${BRAND} · Hướng dẫn sử dụng`, italics: true, size: 18, color: MUTED })] }));

// ---- document ----
const doc = new Document({
  creator: BRAND,
  title: `${BRAND} — Hướng dẫn sử dụng`,
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: INK } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: ACCENT, font: "Calibri" },
        paragraph: { spacing: { before: 300, after: 120 }, keepNext: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DCD6CC", space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: INK, font: "Calibri" },
        paragraph: { spacing: { before: 200, after: 60 }, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "b1", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] },
      { reference: "b2", levels: [{ level: 0, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 200 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log("wrote", process.argv[2], (buf.length / 1024).toFixed(0) + "KB");
});
