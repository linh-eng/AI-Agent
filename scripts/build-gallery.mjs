import fs from "node:fs";
import path from "node:path";

const SHOTS = process.argv[2];
const OUT = process.argv[3];

// Nhóm → [file, tiêu đề, mô tả]
const GROUPS = [
  ["Đăng nhập & Tổng quan", [
    ["00-dang-nhap.png", "Đăng nhập", "Trang đăng nhập nhân viên."],
    ["01-tong-quan.png", "Tổng quan (Dashboard)", "Chỉ số hoạt động: booking, khách mới, phác đồ đang chạy, công việc quá hạn, doanh thu."],
  ]],
  ["Khách hàng", [
    ["02-khach-hang.png", "Danh sách khách hàng", "8 khách demo ở nhiều trạng thái."],
    ["03-ho-so-khach.png", "Hồ sơ khách (KH-100004)", "Timeline hành trình đầy đủ + công nợ + các tab (CSKH, phác đồ, đánh giá, thanh toán…)."],
    ["16-cong-viec.png", "Công việc / Follow-up", "Nhắc lịch, follow-up khách."],
  ]],
  ["Phác đồ · Booking · Báo giá", [
    ["07-phac-do-ds.png", "Danh sách phác đồ", "Các phác đồ điều trị."],
    ["08-phac-do-chi-tiet.png", "Phác đồ chi tiết", "Giai đoạn, các buổi, ghi nhận buổi (thông số, Before/After, vật tư)."],
    ["05-booking.png", "Booking / Lịch hẹn", "Danh sách booking + đổi trạng thái."],
    ["09-bao-gia.png", "Danh sách báo giá", "Proposal theo khách."],
    ["09b-bao-gia-3-phuong-an.png", "Báo giá 3 phương án", "Cơ bản / Khuyến nghị / Chuyên sâu — so sánh cạnh nhau, khách chốt."],
    ["19-bang-gia.png", "Bảng giá", "Giá theo dịch vụ/sản phẩm, có version."],
  ]],
  ["Thư viện Spa", [
    ["10-protocol.png", "Thư viện Protocol", "Protocol nhiều bước, có version (dữ liệu DEMO minh họa)."],
    ["06-dich-vu.png", "Dịch vụ", "Dịch vụ + thời lượng + giá + chi phí."],
    ["13-san-pham.png", "Sản phẩm (Catalog)", "Sản phẩm theo thương hiệu (DMK, Dermalogica, Klapp)."],
    ["14-bieu-mau.png", "Biểu mẫu", "Thiết kế biểu mẫu (form builder) + conditional logic."],
    ["15-cham-soc.png", "Hướng dẫn chăm sóc", "Thư viện dặn dò trước/sau dịch vụ."],
  ]],
  ["Vận hành & Marketing", [
    ["17-ton-kho.png", "Tồn kho", "Vật tư spa + tồn (đầu tip Laser, kim vi kim)."],
    ["18-marketing.png", "Marketing", "Chiến dịch + lead + attribution."],
    ["20-bao-cao.png", "Báo cáo (Kho)", "Báo cáo mảng Kho THNG."],
  ]],
  ["Cổng khách hàng", [
    ["30-portal-dang-nhap.png", "Đăng nhập cổng khách", "Phiên đăng nhập riêng cho khách."],
    ["31-portal-trang-chu.png", "Cổng khách — Trang chủ", "Khách chỉ thấy dữ liệu của mình: báo giá, phác đồ, sản phẩm đề xuất, ảnh Before/After đã chia sẻ."],
  ]],
];

function dataUri(file) {
  const p = path.join(SHOTS, file);
  const b64 = fs.readFileSync(p).toString("base64");
  return `data:image/png;base64,${b64}`;
}

let cards = "";
let nav = "";
for (const [group, items] of GROUPS) {
  const id = group.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  nav += `<a href="#${id}">${group}</a>`;
  cards += `<section id="${id}"><h2>${group}</h2><div class="grid">`;
  for (const [file, title, desc] of items) {
    if (!fs.existsSync(path.join(SHOTS, file))) continue;
    cards += `<figure><a href="${dataUri(file)}" target="_blank" rel="noopener"><img loading="lazy" src="${dataUri(file)}" alt="${title}"></a><figcaption><strong>${title}</strong><span>${desc}</span></figcaption></figure>`;
  }
  cards += `</div></section>`;
}

const html = `<title>Giao diện THNG Spa</title>
<style>
:root{
  --ground:#f7f4f1; --surface:#ffffff; --ink:#242019; --muted:#8b8378;
  --line:#e7e0d8; --accent:#4f7d6e; --accent-soft:#e6efe9; --shadow:0 1px 2px rgba(40,34,28,.06),0 8px 24px rgba(40,34,28,.06);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#17150f; --surface:#211d16; --ink:#efe9e0; --muted:#a79e90;
  --line:#332d24; --accent:#8fc0ae; --accent-soft:#22322b; --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35);
}}
:root[data-theme="dark"]{
  --ground:#17150f; --surface:#211d16; --ink:#efe9e0; --muted:#a79e90;
  --line:#332d24; --accent:#8fc0ae; --accent-soft:#22322b; --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  line-height:1.5;-webkit-font-smoothing:antialiased}
header{padding:56px 24px 28px;max-width:1120px;margin:0 auto}
.eyebrow{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600}
h1{font-size:clamp(1.7rem,3.4vw,2.5rem);margin:.35em 0 .2em;letter-spacing:-.02em;text-wrap:balance}
.lede{color:var(--muted);max-width:64ch;margin:0}
nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--ground) 88%,transparent);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 24px}
nav .inner{max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;gap:6px 16px}
nav a{color:var(--muted);text-decoration:none;font-size:.85rem;font-weight:500}
nav a:hover{color:var(--accent)}
main{max-width:1120px;margin:0 auto;padding:8px 24px 72px}
section{padding:32px 0 8px;scroll-margin-top:64px}
h2{font-size:1.15rem;letter-spacing:-.01em;margin:0 0 4px;display:flex;align-items:center;gap:10px}
h2::before{content:"";width:22px;height:2px;background:var(--accent);border-radius:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-top:18px}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column}
figure img{width:100%;height:auto;display:block;border-bottom:1px solid var(--line);background:var(--ground)}
figcaption{padding:12px 14px 14px;display:flex;flex-direction:column;gap:3px}
figcaption strong{font-size:.92rem;font-weight:600}
figcaption span{font-size:.8rem;color:var(--muted)}
a:focus-visible,figure a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
footer{max-width:1120px;margin:0 auto;padding:0 24px 56px;color:var(--muted);font-size:.82rem}
.badge{display:inline-block;background:var(--accent-soft);color:var(--accent);font-size:.72rem;font-weight:600;
  padding:3px 9px;border-radius:999px;margin-top:14px}
</style>
<nav><div class="inner">${nav}</div></nav>
<header>
  <div class="eyebrow">Bản demo · Nghiệm thu giao diện</div>
  <h1>Giao diện phần mềm quản lý Spa THNG</h1>
  <p class="lede">Ảnh chụp thực tế từ hệ thống đang chạy với dữ liệu demo tiếng Việt. Bấm vào mỗi ảnh để phóng to. Tài khoản thử: <strong>quanly@sophia.com.vn / quanly123</strong> (nhân viên) · <strong>linh.do@example.com / khach123</strong> (cổng khách).</p>
  <span class="badge">${GROUPS.reduce((n,[,x])=>n+x.length,0)} màn hình · giao diện tiếng Việt</span>
</header>
<main>${cards}</main>
<footer>Dữ liệu trong ảnh là DỮ LIỆU DEMO minh họa, không phải khách hàng thật. Protocol hiển thị là mẫu minh họa tính năng.</footer>`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, (fs.statSync(OUT).size/1024/1024).toFixed(2)+"MB");
