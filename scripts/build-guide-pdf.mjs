// Sinh HƯỚNG DẪN SỬ DỤNG dạng PDF (và HTML) có hình ảnh — render bằng Chromium.
// Dùng: node scripts/build-guide-pdf.mjs <out.pdf> <thu-muc-anh>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "docs/Huong-dan-su-dung-Sophia-Care.pdf";
const SHOTS = process.argv[3] || "/tmp/guide-shots";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BRAND = "Sophia Care";

let VERSION = "";
try {
  const v = fs.readFileSync("src/lib/version.ts", "utf8");
  const ver = v.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const date = v.match(/APP_RELEASE_DATE\s*=\s*"([^"]+)"/)?.[1];
  if (ver) VERSION = `v${ver}` + (date ? ` · ${date.split("-").reverse().join("/")}` : "");
} catch {}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

function img(file, caption) {
  const p = path.join(SHOTS, file);
  if (!fs.existsSync(p)) return `<p class="muted">[Thiếu ảnh: ${file}]</p>`;
  const b64 = fs.readFileSync(p).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}" alt="${esc(caption || file)}"/>${caption ? `<figcaption>▲ ${esc(caption)}</figcaption>` : ""}</figure>`;
}
const h1 = (t) => `<h1>${esc(t)}</h1>`;
const h2 = (t) => `<h2>${esc(t)}</h2>`;
const p = (t) => `<p>${md(t)}</p>`;
const note = (t) => `<p class="note">${md(t)}</p>`;
const steps = (arr) => `<ol>${arr.map((s) => `<li>${md(s)}</li>`).join("")}</ol>`;
const bullets = (arr) => `<ul>${arr.map((s) => `<li>${md(s)}</li>`).join("")}</ul>`;
const table = (headers, rows) => `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

let body = "";
// 1
body += h1("1. Giới thiệu & Đăng nhập");
body += p(`**${BRAND}** quản lý toàn bộ hành trình khách hàng của spa/thẩm mỹ: Marketing → Khách hàng → Chăm sóc (CSKH) → Đánh giá → Phác đồ → Báo giá → Hóa đơn → Booking → Thực hiện buổi → Vật tư → Thanh toán → Theo dõi sau dịch vụ. Toàn bộ giao diện tiếng Việt.`);
body += h2("Cách mở & đăng nhập");
body += steps(["Mở trình duyệt (Chrome/Edge), vào địa chỉ máy chủ: **http://172.168.11.60:9500**", "Nhập **Email** và **Mật khẩu** → bấm **Đăng nhập** → vào màn **Tổng quan**."]);
body += img("00-dang-nhap.png", "Màn hình đăng nhập");
body += h2("Tài khoản demo (mật khẩu = <vai trò>123)");
body += table(["Vai trò", "Email đăng nhập", "Mật khẩu"], [
  ["Quản lý", "quanly@sophia.com.vn", "quanly123"],
  ["Lễ tân", "letan@sophia.com.vn", "letan123"],
  ["Chăm sóc KH (CSKH)", "cskh@sophia.com.vn", "cskh123"],
  ["Chuyên viên", "chuyenvien@sophia.com.vn", "chuyenvien123"],
  ["Thu ngân", "thungan@sophia.com.vn", "thungan123"],
  ["Marketing", "marketing@sophia.com.vn", "marketing123"],
  ["Quản trị (Admin)", "admin@sophia.com.vn", "admin123"],
]);
body += note("Nên đổi mật khẩu mặc định trước khi dùng thật. Mỗi vai trò chỉ thấy/làm được phần việc của mình.");
// 2
body += h1("2. Màn hình Tổng quan");
body += p("Menu **Tổng quan** — nắm nhanh tình hình trong tháng: booking hôm nay/sắp tới, khách mới, phác đồ đang chạy, công việc quá hạn, và **Doanh thu / Chi phí / Lợi nhuận** (chỉ vai trò có quyền tài chính mới thấy số tiền).");
body += img("01-tong-quan.png", "Tổng quan hoạt động spa");
// 3
body += h1("3. Quản lý Khách hàng (hồ sơ 360°)");
body += p("Menu **Khách hàng** — trung tâm của mọi việc. Mỗi khách có 1 hồ sơ chứa toàn bộ lịch sử.");
body += img("02-khach-hang.png", "Danh sách khách hàng");
body += h2("Thêm / sửa khách & hồ sơ");
body += steps(["Bấm **Thêm khách hàng** → nhập họ tên (bắt buộc), điện thoại, email, **ngày sinh**, giới tính, nguồn, nhóm…", "Bấm vào tên khách để mở **hồ sơ** (Timeline + công nợ + các tab: CSKH, booking, phác đồ, đánh giá, hóa đơn, thanh toán…)."]);
body += img("03-ho-so-khach.png", "Hồ sơ khách hàng: Timeline + công nợ + các tab");
// 4
body += h1("4. Booking & Lịch hẹn");
body += p("Menu **Booking**. Xem theo **Danh sách / Ngày / Tuần / Tháng**; tạo lịch gắn **Kỹ thuật viên, Master, Phòng, Giường, Máy**.");
body += steps(["Bấm **Tạo booking** → chọn khách, dịch vụ, thời gian, thời lượng, tài nguyên.", "Nếu **trùng lịch** (cùng KTV/phòng… trùng giờ) → hiện **cảnh báo vàng**; có thể **Vẫn đặt** khi cần."]);
body += img("04-booking-lich-thang.png", "Lịch Tháng — chip giờ + tên khách mỗi ngày");
body += img("04b-booking-lich-tuan.png", "Lịch Tuần — 7 cột ngày");
// 5
body += h1("5. Phác đồ & Ghi nhận buổi");
body += p("Menu **Phác đồ**. Mỗi phác đồ gồm nhiều **giai đoạn** và **buổi**; có version (V1/V2…).");
body += img("14-phac-do-ds.png", "Danh sách phác đồ");
body += h2("Ghi nhận một buổi");
body += steps([
  "Mở phác đồ → dòng buổi → bấm **Ghi nhận**.",
  "Nhập thông số/tình trạng trước–sau, **tải ảnh Before/After**.",
  "**Vật tư sử dụng**: chọn nguồn (Kho vật tư sử dụng / Vật tư khách hàng) → nhập số dùng.",
  "**Nhân sự thực hiện**: chọn nhân viên → vai trò (chính/hỗ trợ/master/kiểm tra/tư vấn) → phí.",
  "**Đánh giá & báo cáo sau buổi**: sao hài lòng + sao KTV + nhận xét + báo cáo KTV.",
]);
body += img("14b-phac-do-chi-tiet.png", "Chi tiết phác đồ + các thao tác ghi buổi");
// 6
body += h1("6. Báo giá → Hóa đơn → Thanh toán → Công nợ");
body += p("Luồng tài chính chính. **Menu Báo giá**: lập nhiều phương án cho khách chọn.");
body += img("05-bao-gia-ds.png", "Danh sách báo giá");
body += steps([
  "Mở báo giá → thiết kế các phương án (Thiết yếu/Khuyến nghị/Cao cấp) → **Gửi khách**.",
  "Khi khách đồng ý: **Khách chốt** → chọn phương án + giá thống nhất (đông cứng snapshot).",
  "Bấm **Tạo hóa đơn** → chuyển sang màn hóa đơn.",
]);
body += img("05b-bao-gia-chi-tiet.png", "Báo giá nhiều phương án (đã chốt) + nút Tạo hóa đơn");
body += h2("Hóa đơn & thu tiền");
body += p("Menu **Hóa đơn**: theo dõi **Tổng / Đã trả / Còn phải thu** và trạng thái.");
body += img("06-hoa-don-ds.png", "Danh sách hóa đơn + tổng công nợ");
body += steps(["Mở hóa đơn → **Thu tiền** → nhập số tiền + hình thức (một hóa đơn thu **nhiều lần**).", "Hệ thống tự cập nhật trạng thái & công nợ; **không thu vượt** số còn phải thu."]);
body += img("06b-hoa-don-chi-tiet.png", "Chi tiết hóa đơn: hạng mục + lịch sử thu + nút Thu tiền");
body += p("Menu **Thanh toán**: sổ thu tiền, gắn với hóa đơn.");
body += img("07-thanh-toan.png", "Sổ thanh toán");
body += note("Công nợ khách được tính TỪ HÓA ĐƠN. Giá vốn/lợi nhuận chỉ vai trò có quyền tài chính mới thấy.");
// 7
body += h1("7. Giá sàn (chi phí → giá sàn)");
body += p("Menu **Giá sàn** (cần quyền tài chính). Khai báo 6 khoản chi phí + biên tối thiểu → hệ thống tính **giá sàn**. Bán dưới sàn phải có **quyền duyệt**.");
body += img("08-gia-san.png", "Bảng giá sàn theo dịch vụ");
// 8
body += h1("8. Nhân sự (đa vai trò + phí buổi)");
body += p("Menu **Hệ thống → Nhân sự**. Mỗi nhân viên giữ **nhiều vai trò** và có **phí mặc định** mỗi buổi. Phân công nhân sự cho từng buổi ở màn Ghi nhận buổi (mục 5).");
body += img("09-nhan-su.png", "Danh sách nhân sự — vai trò dạng chip + phí");
// 9
body += h1("9. CSKH · Follow-up & Sinh nhật");
body += p("Menu **CSKH · Follow-up**. Tạo **quy trình chăm sóc nhiều bước** (mốc ngày + kênh + kịch bản + checklist), áp cho khách để **sinh việc theo lịch**. Thẻ **Sinh nhật 30 ngày tới** + nút **Chúc mừng**.");
body += img("10-cskh-followup.png", "CSKH: sinh nhật sắp tới + quy trình follow-up");
// 10
body += h1("10. Before/After & Đánh giá");
body += p("Menu **Before/After & Đánh giá**. Thư viện ảnh trước–sau theo buổi (lọc + phóng to so sánh) + tổng hợp **điểm hài lòng, điểm KTV, tỷ lệ quay lại**.");
body += img("11-before-after.png", "Tổng hợp đánh giá + lưới ảnh Trước–Sau");
body += note("Ảnh khách là RIÊNG TƯ; chỉ ảnh được bật “Khách thấy” mới hiển thị trên Cổng khách.");
// 11
body += h1("11. Dịch vụ & Thư viện Spa");
body += p("Menu **Dịch vụ** (giá chuẩn, thời lượng) và nhóm **Thư viện Spa** (Brand, Công nghệ, Protocol, Sản phẩm, Biểu mẫu, Hướng dẫn chăm sóc).");
body += img("13-dich-vu.png", "Danh mục dịch vụ");
// 12
body += h1("12. Nhập khách hàng (Import MySpa/CSV)");
body += p("Menu **Hệ thống → Nhập khách hàng**. Nhập danh sách khách từ CSV/MySpa theo 4 bước, **không ghi đè** khách đã có.");
body += steps([
  "**Dán CSV** hoặc **Tải file .csv** (có nút **Dùng mẫu**).",
  "**Ghép cột** nguồn → trường chuẩn (tự đoán). Bắt buộc cột **Họ tên**.",
  "**Kiểm tra & xem trước**: mỗi dòng gắn trạng thái **Thêm mới / Trùng / Lỗi** + lý do.",
  "Bấm **Nhập** → báo cáo: đã tạo / bỏ qua trùng / lỗi + danh sách mã KH.",
]);
body += img("12-import-khach.png", "Nhập khách hàng: ghép cột + kiểm tra trùng");
body += note("Khách trùng (theo SĐT hoặc mã cũ) KHÔNG bị ghi đè — dữ liệu cũ giữ nguyên.");
// 13
body += h1("13. Cài đặt & Thương hiệu");
body += p("Menu **Hệ thống → Cài đặt**. Đổi **tên phần mềm, khẩu hiệu, màu nhấn, logo** (áp toàn hệ thống). Xem **phiên bản** ở cuối trang và chân menu trái.");
body += img("15-cai-dat.png", "Cài đặt thương hiệu + phiên bản phần mềm");
// 14
body += h1("14. Quản trị người dùng (tài khoản đăng nhập)");
body += p("Menu **Hệ thống → Quản trị người dùng** (**chỉ Admin** thấy menu này). Tạo tài khoản đăng nhập cho nhân viên, gán vai trò, đặt lại mật khẩu, khóa/mở.");
body += steps([
  "Bấm **Thêm người dùng** → nhập **email đăng nhập**, họ tên, **mật khẩu**, chọn **một hoặc nhiều vai trò**.",
  "Bấm bút chì để **sửa**: đổi tên, đổi vai trò, **đặt lại mật khẩu** (bỏ trống nếu giữ nguyên), **khóa/mở**.",
  "Bấm **thùng rác** để **xóa** tài khoản (VD dọn tài khoản trùng). Không xóa được chính mình và không xóa Admin cuối cùng.",
]);
body += img("16-quan-tri-nguoi-dung.png", "Quản trị người dùng: danh sách tài khoản + vai trò");
body += note("“Quản trị người dùng” = tài khoản ĐĂNG NHẬP. Khác “Nhân sự” = danh mục nhân viên để phân công buổi/tính phí.");
// 15
body += h1("15. Phân quyền theo vai trò");
body += p("Mỗi vai trò chỉ thấy/làm phần việc của mình; **dữ liệu tài chính** (giá vốn, lợi nhuận, chi phí, phí nhân sự, giá sàn) chỉ vai trò có quyền tài chính mới xem.");
body += table(["Vai trò", "Làm được gì (tóm tắt)"], [
  ["Quản lý", "Toàn bộ nghiệp vụ spa + tài chính + duyệt"],
  ["Lễ tân", "Khách, booking, thu tiền, chốt báo giá, hóa đơn, nhân sự"],
  ["CSKH", "Nhật ký chăm sóc, follow-up, công việc (không xem tài chính)"],
  ["Chuyên viên", "Ghi buổi, đánh giá, phác đồ/protocol, đề xuất, vật tư"],
  ["Thu ngân", "Thanh toán, công nợ, hóa đơn, bảng giá, giá sàn (tài chính)"],
  ["Marketing", "Chiến dịch, nguồn khách, catalog sản phẩm, ROI"],
  ["Admin", "Toàn quyền + Quản trị người dùng"],
]);
// 16
body += h1("16. Cập nhật phần mềm (không mất dữ liệu)");
body += steps([
  "**Sao lưu** database (khuyến nghị): pg_dump ra file .sql.",
  "**Giải nén** bản mới đè lên thư mục app — **giữ nguyên file .env**.",
  "Bấm đúp **windows\\update-windows.bat** (cập nhật thư viện + áp migration additive + build).",
  "Chạy **start-windows.bat** để khởi động lại. Vào **Cài đặt → Phiên bản** kiểm tra.",
]);
body += note("Cập nhật chỉ THÊM bảng/cột (không xóa dữ liệu). KHÔNG chạy db:seed khi cập nhật. Chi tiết ở docs/CAP-NHAT.md.");
// 17
body += h1("17. Mẹo & Xử lý sự cố thường gặp");
body += bullets([
  "**“Quá nhiều lần thử”**: do nhập sai nhiều lần (chống dò mật khẩu). Chờ 1–2 phút rồi nhập đúng.",
  "**Không thấy số tiền/giá vốn**: do vai trò không có quyền tài chính — đúng thiết kế.",
  "**Ảnh khách không hiện trên Cổng khách**: kiểm tra đã bật ô “Khách thấy” chưa.",
  "**Số liệu tháng = 0**: chưa có giao dịch phát sinh trong tháng hiện tại.",
  "**Trùng lịch / dưới giá sàn**: là cảnh báo có chủ đích; cần vai trò có quyền để bỏ qua/duyệt.",
]);

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #242019; font-size: 12.5px; line-height: 1.55; margin: 0; }
.cover { text-align: center; padding: 230px 40px 0; page-break-after: always; }
.cover .brand { color: #4f7d6e; font-size: 46px; font-weight: 800; letter-spacing: -1px; }
.cover .sub { font-size: 15px; margin-top: 10px; }
.cover .title { font-size: 26px; font-weight: 800; margin-top: 6px; }
.cover .meta { color: #6b6459; font-style: italic; margin-top: 8px; }
main { padding: 0 6px; }
h1 { color: #4f7d6e; font-size: 18px; border-bottom: 1.5px solid #dcd6cc; padding-bottom: 5px; margin: 22px 0 10px; page-break-after: avoid; }
h2 { font-size: 14.5px; margin: 14px 0 6px; page-break-after: avoid; }
p { margin: 6px 0; }
ol, ul { margin: 6px 0 10px; padding-left: 22px; }
li { margin: 3px 0; }
.note { border-left: 3px solid #4f7d6e; background: #f7f5f1; padding: 7px 10px; color: #57503f; font-style: italic; font-size: 11.5px; margin: 8px 0; }
.muted { color: #6b6459; font-style: italic; }
figure { margin: 10px 0 16px; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; width: 620px; border: 1px solid #dcd6cc; border-radius: 4px; }
figcaption { color: #6b6459; font-style: italic; font-size: 11px; margin-top: 4px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; font-size: 11.5px; page-break-inside: avoid; }
th { background: #4f7d6e; color: #fff; text-align: left; padding: 6px 9px; }
td { border-bottom: 1px solid #e7e0d8; padding: 5px 9px; }
tbody tr:nth-child(even) td { background: #f6f4ef; }
b { font-weight: 700; }
</style></head><body>
<div class="cover">
  <div class="brand">${BRAND}</div>
  <div class="sub">PHẦN MỀM QUẢN LÝ SPA &amp; KHÁCH HÀNG</div>
  <div class="title">HƯỚNG DẪN SỬ DỤNG (CÓ HÌNH ẢNH)</div>
  <div class="meta">Dành cho nhân viên${VERSION ? " · Phiên bản " + VERSION : ""}</div>
</div>
<main>${body}</main>
</body></html>`;

const htmlPath = OUT.replace(/\.pdf$/i, ".html");
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: OUT, format: "A4", printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#8b8378;padding:0 14mm;display:flex;justify-content:space-between;"><span>${BRAND} · Hướng dẫn sử dụng</span><span>Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
  });
  console.log("wrote", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + "KB");
} finally {
  await browser.close();
}
