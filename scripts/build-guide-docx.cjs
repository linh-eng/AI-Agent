// Sinh HƯỚNG DẪN SỬ DỤNG (Word .docx) CÓ HÌNH ẢNH cho Sophia Care.
// Dùng: node scripts/build-guide-docx.cjs <out.docx> <thu-muc-anh>
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak, TableOfContents, ImageRun,
} = require("docx");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || "docs/Huong-dan-su-dung-Sophia-Care.docx";
const SHOTS = process.argv[3] || "/tmp/guide-shots";

const BRAND = "Sophia Care";
const ACCENT = "4F7D6E";
const INK = "242019";
const MUTED = "6B6459";

// Phiên bản đọc từ src/lib/version.ts
let VERSION = "";
try {
  const v = fs.readFileSync("src/lib/version.ts", "utf8");
  const ver = v.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const date = v.match(/APP_RELEASE_DATE\s*=\s*"([^"]+)"/)?.[1];
  if (ver) VERSION = `v${ver}` + (date ? ` · ${date.split("-").reverse().join("/")}` : "");
} catch {}

// ---- helpers ----
const H1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } });
const H2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 } });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: 100 }, children: parseBold(t, opts) });
const NOTE = (t) => new Paragraph({
  spacing: { before: 60, after: 120 }, indent: { left: 200 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 12 } },
  children: [new TextRun({ text: t, size: 20, color: MUTED, italics: true })],
});
const bullet = (t, sub) => new Paragraph({ numbering: { reference: sub ? "b2" : "b1", level: 0 }, spacing: { after: 40 }, children: parseBold(t) });
const step = (t) => new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 40 }, children: parseBold(t) });
const spacer = () => new Paragraph({ text: "", spacing: { after: 60 } });

function parseBold(t, base = {}) {
  const out = [];
  for (const seg of String(t).split(/(\*\*[^*]+\*\*)/g)) {
    if (!seg) continue;
    if (seg.startsWith("**") && seg.endsWith("**")) out.push(new TextRun({ text: seg.slice(2, -2), bold: true, size: 22, color: INK, ...base }));
    else out.push(new TextRun({ text: seg, size: 22, color: INK, ...base }));
  }
  return out;
}

// Đọc kích thước PNG (IHDR).
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Chèn ảnh (khớp bề rộng trang, giới hạn chiều cao 1 trang) + chú thích.
function img(file, caption) {
  const p = path.join(SHOTS, file);
  if (!fs.existsSync(p)) return [P(`[Thiếu ảnh: ${file}]`, { color: MUTED, italics: true })];
  const buf = fs.readFileSync(p);
  const { w, h } = pngSize(buf);
  const MAXW = 600, MAXH = 760;
  let W = MAXW, H = Math.round((MAXW * h) / w);
  if (H > MAXH) { H = MAXH; W = Math.round((MAXH * w) / h); }
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 80, after: 20 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "DCD6CC", space: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "DCD6CC", space: 4 },
        left: { style: BorderStyle.SINGLE, size: 4, color: "DCD6CC", space: 4 },
        right: { style: BorderStyle.SINGLE, size: 4, color: "DCD6CC", space: 4 },
      },
      children: [new ImageRun({ data: buf, transformation: { width: W, height: H } })],
    }),
  ];
  if (caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [new TextRun({ text: "▲ " + caption, italics: true, size: 18, color: MUTED })] }));
  else out.push(spacer());
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

// ---- content ----
const children = [];

// Cover
children.push(new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: BRAND, bold: true, size: 64, color: ACCENT })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "PHẦN MỀM QUẢN LÝ SPA & KHÁCH HÀNG", size: 26, color: INK })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "HƯỚNG DẪN SỬ DỤNG (CÓ HÌNH ẢNH)", bold: true, size: 40, color: INK })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Dành cho nhân viên${VERSION ? " · Phiên bản " + VERSION : ""}`, size: 20, italics: true, color: MUTED })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
children.push(new Paragraph({ text: "Mục lục", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
children.push(new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-1" }));
children.push(NOTE("Sau khi mở file trong Word: bấm chuột phải vào Mục lục → “Update Field” → “Update entire table” để hiện đúng số trang."));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Đăng nhập
children.push(H1("1. Giới thiệu & Đăng nhập"));
children.push(P(`**${BRAND}** quản lý toàn bộ hành trình khách hàng của spa/thẩm mỹ: Marketing → Khách hàng → Chăm sóc (CSKH) → Đánh giá → Phác đồ → Báo giá → Hóa đơn → Booking → Thực hiện buổi → Vật tư → Thanh toán → Theo dõi sau dịch vụ. Toàn bộ giao diện tiếng Việt.`));
children.push(H2("Cách mở & đăng nhập"));
children.push(step("Mở trình duyệt (Chrome/Edge), vào địa chỉ máy chủ: **http://172.168.11.60:9500**"));
children.push(step("Nhập **Email** và **Mật khẩu** → bấm **Đăng nhập** → vào màn **Tổng quan**."));
children.push(...img("00-dang-nhap.png", "Màn hình đăng nhập"));
children.push(H2("Tài khoản demo (mật khẩu = <vai trò>123)"));
children.push(table(["Vai trò", "Email đăng nhập", "Mật khẩu"], [
  ["Quản lý", "quanly@sophia.com.vn", "quanly123"],
  ["Lễ tân", "letan@sophia.com.vn", "letan123"],
  ["Chăm sóc KH (CSKH)", "cskh@sophia.com.vn", "cskh123"],
  ["Chuyên viên", "chuyenvien@sophia.com.vn", "chuyenvien123"],
  ["Thu ngân", "thungan@sophia.com.vn", "thungan123"],
  ["Marketing", "marketing@sophia.com.vn", "marketing123"],
  ["Quản trị (Admin)", "admin@sophia.com.vn", "admin123"],
], [2600, 4200, 2000]));
children.push(NOTE("Nên đổi mật khẩu mặc định trước khi dùng thật. Mỗi vai trò chỉ thấy/làm được phần việc của mình (xem mục Phân quyền)."));

// 2. Tổng quan
children.push(H1("2. Màn hình Tổng quan"));
children.push(P("Menu **Tổng quan** — nắm nhanh tình hình trong tháng: booking hôm nay/sắp tới, khách mới, phác đồ đang chạy, công việc quá hạn, và **Doanh thu / Chi phí / Lợi nhuận** (chỉ vai trò có quyền tài chính mới thấy số tiền)."));
children.push(...img("01-tong-quan.png", "Tổng quan hoạt động spa"));

// 3. Khách hàng
children.push(H1("3. Quản lý Khách hàng (hồ sơ 360°)"));
children.push(P("Menu **Khách hàng** — trung tâm của mọi việc. Mỗi khách có 1 hồ sơ chứa toàn bộ lịch sử."));
children.push(...img("02-khach-hang.png", "Danh sách khách hàng"));
children.push(H2("Thêm / sửa khách"));
children.push(step("Bấm **Thêm khách hàng** → nhập họ tên (bắt buộc), điện thoại, email, **ngày sinh**, giới tính, nguồn, nhóm…"));
children.push(step("Bấm vào tên khách để mở **hồ sơ**."));
children.push(H2("Hồ sơ khách — các tab"));
children.push(bullet("**Tổng quan / Timeline**: toàn bộ hành trình (CSKH, booking, phác đồ, đánh giá, hóa đơn, thanh toán…) + công nợ."));
children.push(bullet("**Nhật ký CSKH, Booking, Phác đồ, Đánh giá, Sản phẩm đề xuất, Vật tư khách hàng, Biểu mẫu, Hướng dẫn, Hóa đơn, Thanh toán**."));
children.push(...img("03-ho-so-khach.png", "Hồ sơ khách hàng: Timeline + công nợ + các tab"));

// 4. Booking
children.push(H1("4. Booking & Lịch hẹn"));
children.push(P("Menu **Booking**. Xem theo **Danh sách / Ngày / Tuần / Tháng**; tạo lịch gắn **Kỹ thuật viên, Master, Phòng, Giường, Máy**."));
children.push(H2("Tạo booking"));
children.push(step("Bấm **Tạo booking** → chọn khách, dịch vụ, thời gian, thời lượng."));
children.push(step("Nhập tài nguyên (KTV/master/phòng/giường/máy). Bấm **Lưu**."));
children.push(step("Nếu **trùng lịch** (cùng KTV/phòng… trùng giờ) → hiện **cảnh báo vàng**; có thể **Vẫn đặt (bỏ qua cảnh báo)** khi cần."));
children.push(...img("04-booking-lich-thang.png", "Lịch Tháng — chip giờ + tên khách mỗi ngày"));
children.push(...img("04b-booking-lich-tuan.png", "Lịch Tuần — 7 cột ngày"));

// 5. Phác đồ & ghi buổi
children.push(H1("5. Phác đồ & Ghi nhận buổi"));
children.push(P("Menu **Phác đồ**. Mỗi phác đồ gồm nhiều **giai đoạn** và **buổi**; có version (V1/V2…)."));
children.push(...img("14-phac-do-ds.png", "Danh sách phác đồ"));
children.push(H2("Ghi nhận một buổi"));
children.push(step("Mở phác đồ → dòng buổi → bấm **Ghi nhận**."));
children.push(step("Nhập thông số/tình trạng trước–sau, **tải ảnh Before/After**."));
children.push(step("**Vật tư sử dụng trong buổi**: chọn nguồn (Kho vật tư sử dụng / Vật tư khách hàng) → nhập số dùng."));
children.push(step("**Nhân sự thực hiện buổi**: chọn nhân viên → vai trò (chính/hỗ trợ/master/kiểm tra/tư vấn) → phí."));
children.push(step("**Đánh giá & báo cáo sau buổi**: sao hài lòng + sao KTV + nhận xét + báo cáo KTV."));
children.push(...img("14b-phac-do-chi-tiet.png", "Chi tiết phác đồ + các thao tác ghi buổi"));

// 6. Tài chính
children.push(H1("6. Báo giá → Hóa đơn → Thanh toán → Công nợ"));
children.push(P("Đây là luồng tài chính chính. **Menu Báo giá**: lập nhiều phương án cho khách chọn."));
children.push(...img("05-bao-gia-ds.png", "Danh sách báo giá"));
children.push(H2("Chốt báo giá & tạo hóa đơn"));
children.push(step("Mở báo giá → thiết kế các phương án (Thiết yếu/Khuyến nghị/Cao cấp) → **Gửi khách**."));
children.push(step("Khi khách đồng ý: bấm **Khách chốt** → chọn phương án + giá thống nhất (đông cứng snapshot)."));
children.push(step("Bấm **Tạo hóa đơn** → chuyển sang màn hóa đơn."));
children.push(...img("05b-bao-gia-chi-tiet.png", "Báo giá nhiều phương án (đã chốt) + nút Tạo hóa đơn"));
children.push(H2("Hóa đơn & thu tiền"));
children.push(P("Menu **Hóa đơn**: theo dõi **Tổng / Đã trả / Còn phải thu** và trạng thái (Chưa TT / Trả một phần / Đã TT)."));
children.push(...img("06-hoa-don-ds.png", "Danh sách hóa đơn + tổng công nợ"));
children.push(step("Mở hóa đơn → bấm **Thu tiền** → nhập số tiền + hình thức (một hóa đơn thu **nhiều lần**)."));
children.push(step("Hệ thống tự cập nhật trạng thái & công nợ. **Không thu vượt** số còn phải thu."));
children.push(...img("06b-hoa-don-chi-tiet.png", "Chi tiết hóa đơn: hạng mục + lịch sử thu + nút Thu tiền"));
children.push(H2("Sổ thanh toán"));
children.push(P("Menu **Thanh toán**: toàn bộ lượt thu, gắn với hóa đơn."));
children.push(...img("07-thanh-toan.png", "Sổ thanh toán"));
children.push(NOTE("Công nợ khách được tính TỪ HÓA ĐƠN. Giá vốn/lợi nhuận chỉ vai trò có quyền tài chính mới thấy."));

// 7. Giá sàn
children.push(H1("7. Giá sàn (chi phí → giá sàn)"));
children.push(P("Menu **Giá sàn** (cần quyền tài chính). Khai báo 6 khoản chi phí (nhân sự/vận hành/khấu hao/vật tư/phòng/khác) + biên tối thiểu → hệ thống tính **giá sàn**."));
children.push(step("Bấm **Khai báo** ở dịch vụ → nhập chi phí + biên % → xem trước giá sàn → **Lưu**."));
children.push(step("Khi tạo booking **giá thấp hơn giá sàn** → bị chặn; người có **quyền duyệt** mới **Duyệt bán dưới sàn**."));
children.push(...img("08-gia-san.png", "Bảng giá sàn theo dịch vụ"));

// 8. Nhân sự
children.push(H1("8. Nhân sự (đa vai trò + phí buổi)"));
children.push(P("Menu **Hệ thống → Nhân sự**. Mỗi nhân viên giữ **nhiều vai trò** (KTV/Master/CSKH/Sales/Quản lý…) và có **phí mặc định** mỗi buổi."));
children.push(step("Bấm **Thêm nhân sự** → nhập tên, liên hệ, chọn **nhiều vai trò** bằng chip, phí mặc định."));
children.push(step("Phân công nhân sự cho từng buổi ở màn **Ghi nhận buổi** (mục 5)."));
children.push(...img("09-nhan-su.png", "Danh sách nhân sự — vai trò dạng chip + phí"));

// 9. CSKH follow-up
children.push(H1("9. CSKH · Follow-up & Sinh nhật"));
children.push(P("Menu **CSKH · Follow-up**. Tạo **quy trình chăm sóc nhiều bước** (mốc ngày + kênh + kịch bản + checklist), áp cho khách để **sinh việc theo lịch**."));
children.push(step("Tạo quy trình → thêm các bước (sau N ngày, kênh Zalo/SMS…, việc, kịch bản, checklist)."));
children.push(step("Bấm **Áp** → chọn khách + mốc bắt đầu → hệ thống tạo các việc follow-up (hiện ở **Công việc** & timeline khách)."));
children.push(step("Thẻ **Sinh nhật 30 ngày tới**: bấm **Chúc mừng** để áp nhanh quy trình sinh nhật."));
children.push(...img("10-cskh-followup.png", "CSKH: sinh nhật sắp tới + quy trình follow-up"));

// 10. Before/After & đánh giá
children.push(H1("10. Before/After & Đánh giá"));
children.push(P("Menu **Before/After & Đánh giá**. Thư viện ảnh trước–sau theo buổi (lọc theo khách/dịch vụ/ngày, bấm ảnh để phóng to so sánh) + tổng hợp **điểm hài lòng, điểm KTV, tỷ lệ quay lại**."));
children.push(...img("11-before-after.png", "Tổng hợp đánh giá + lưới ảnh Trước–Sau"));
children.push(NOTE("Ảnh khách là RIÊNG TƯ; chỉ ảnh được bật “Khách thấy” mới hiển thị trên Cổng khách."));

// 11. Dịch vụ & thư viện
children.push(H1("11. Dịch vụ & Thư viện Spa"));
children.push(P("Menu **Dịch vụ** (giá chuẩn, thời lượng) và nhóm **Thư viện Spa** (Brand, Công nghệ, Protocol, Sản phẩm, Biểu mẫu, Hướng dẫn chăm sóc)."));
children.push(...img("13-dich-vu.png", "Danh mục dịch vụ"));

// 12. Import
children.push(H1("12. Nhập khách hàng (Import MySpa/CSV)"));
children.push(P("Menu **Hệ thống → Nhập khách hàng**. Nhập danh sách khách từ file CSV/MySpa theo 4 bước, **không ghi đè** khách đã có."));
children.push(step("**Dán CSV** hoặc **Tải file .csv** (có nút **Dùng mẫu**)."));
children.push(step("**Ghép cột** nguồn → trường chuẩn (hệ thống tự đoán). Bắt buộc cột **Họ tên**."));
children.push(step("**Kiểm tra & xem trước**: mỗi dòng gắn trạng thái **Thêm mới / Trùng / Lỗi** + lý do."));
children.push(step("Bấm **Nhập** → báo cáo: đã tạo / bỏ qua trùng / lỗi + danh sách mã KH."));
children.push(...img("12-import-khach.png", "Nhập khách hàng: ghép cột + kiểm tra trùng"));
children.push(NOTE("Khách trùng (theo SĐT hoặc mã cũ) KHÔNG bị ghi đè — dữ liệu cũ giữ nguyên."));

// 13. Cài đặt & thương hiệu
children.push(H1("13. Cài đặt & Thương hiệu"));
children.push(P("Menu **Hệ thống → Cài đặt**. Đổi **tên phần mềm, khẩu hiệu, màu nhấn, logo** (áp cho toàn hệ thống). Xem **phiên bản** phần mềm ở cuối trang và ở chân menu trái."));
children.push(...img("15-cai-dat.png", "Cài đặt thương hiệu + phiên bản phần mềm"));

// 14. Quản trị người dùng
children.push(H1("14. Quản trị người dùng (tài khoản đăng nhập)"));
children.push(P("Menu **Hệ thống → Quản trị người dùng** (**chỉ tài khoản Admin** thấy menu này). Tạo tài khoản đăng nhập cho nhân viên, gán vai trò, đặt lại mật khẩu, khóa/mở."));
children.push(step("Bấm **Thêm người dùng** → nhập **email đăng nhập**, họ tên, **mật khẩu**, chọn **một hoặc nhiều vai trò**."));
children.push(step("Bấm biểu tượng bút chì để **sửa**: đổi tên, **đổi vai trò**, **đặt lại mật khẩu** (bỏ trống nếu giữ nguyên), **khóa/mở** tài khoản."));
children.push(step("Tài khoản bị khóa sẽ không đăng nhập được. (Không thể tự khóa chính tài khoản đang dùng.)"));
children.push(...img("16-quan-tri-nguoi-dung.png", "Quản trị người dùng: danh sách tài khoản + vai trò"));
children.push(NOTE("“Quản trị người dùng” là tài khoản ĐĂNG NHẬP (email + mật khẩu + vai trò). Khác với “Nhân sự” — danh mục nhân viên để phân công buổi/tính phí. Một người có thể vừa là nhân sự, vừa có tài khoản đăng nhập."));

// 15. Phân quyền
children.push(H1("15. Phân quyền theo vai trò"));
children.push(P("Mỗi vai trò chỉ thấy/làm phần việc của mình; **dữ liệu tài chính** (giá vốn, lợi nhuận, chi phí, phí nhân sự, giá sàn) chỉ vai trò có quyền tài chính mới xem."));
children.push(table(["Vai trò", "Làm được gì (tóm tắt)"], [
  ["Quản lý", "Toàn bộ nghiệp vụ spa + tài chính + duyệt (giá sàn, bán dưới sàn…)"],
  ["Lễ tân", "Khách, booking, thu tiền, chốt báo giá, hóa đơn, nhân sự"],
  ["CSKH", "Nhật ký chăm sóc, follow-up, công việc (không xem tài chính)"],
  ["Chuyên viên", "Ghi buổi, đánh giá, phác đồ/protocol, đề xuất, vật tư"],
  ["Thu ngân", "Thanh toán, công nợ, hóa đơn, bảng giá, giá sàn (tài chính)"],
  ["Marketing", "Chiến dịch, nguồn khách, catalog sản phẩm, ROI"],
  ["Admin", "Toàn quyền hệ thống"],
], [2600, 6200]));

// 15. Cập nhật không mất dữ liệu
children.push(H1("16. Cập nhật phần mềm (không mất dữ liệu)"));
children.push(step("**Sao lưu** database (khuyến nghị): pg_dump ra file .sql."));
children.push(step("**Giải nén** bản mới đè lên thư mục app — **giữ nguyên file .env** (bản zip không kèm .env)."));
children.push(step("Bấm đúp **windows\\update-windows.bat** (tự cập nhật thư viện + áp migration additive + build)."));
children.push(step("Chạy **start-windows.bat** để khởi động lại. Vào **Cài đặt → Phiên bản** kiểm tra."));
children.push(NOTE("Cập nhật chỉ THÊM bảng/cột (không xóa dữ liệu). KHÔNG chạy db:seed khi cập nhật — seed chỉ dành cho cài mới. Chi tiết ở docs/CAP-NHAT.md."));

// 16. Mẹo & sự cố
children.push(H1("17. Mẹo & Xử lý sự cố thường gặp"));
children.push(bullet("**“Quá nhiều lần thử”**: do nhập sai nhiều lần (chống dò mật khẩu). Chờ 1–2 phút rồi nhập đúng."));
children.push(bullet("**Không thấy số tiền/giá vốn**: do vai trò không có quyền tài chính — đúng thiết kế."));
children.push(bullet("**Ảnh khách không hiện trên Cổng khách**: kiểm tra đã bật ô “Khách thấy” chưa."));
children.push(bullet("**Số liệu tháng = 0**: chưa có giao dịch phát sinh trong tháng hiện tại."));
children.push(bullet("**Trùng lịch / dưới giá sàn**: là cảnh báo có chủ đích; cần vai trò có quyền để bỏ qua/duyệt."));
children.push(spacer());
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 },
  children: [new TextRun({ text: `— Hết —  ${BRAND} · Hướng dẫn sử dụng${VERSION ? " · " + VERSION : ""}`, italics: true, size: 18, color: MUTED })] }));

// ---- document ----
const doc = new Document({
  creator: BRAND,
  title: `${BRAND} — Hướng dẫn sử dụng`,
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: INK } } },
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
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, (buf.length / 1024).toFixed(0) + "KB");
});
