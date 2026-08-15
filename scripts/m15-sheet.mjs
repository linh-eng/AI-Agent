// Sinh phiếu bằng chứng HTML Mục 15 (A–P + ma trận quyền 7 vai trò) → PNG.
import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.argv[2] || "/tmp/m15-shots";
fs.mkdirSync(OUT, { recursive: true });

const AP = [
  ["A", "Role/permission persistence (backend, không hard-code UI)", "Đăng nhập THẬT → session.permissions suy từ ROLE_PERMISSIONS (nguồn sự thật); DB roles + user_roles thật (test A + SQL)", "PASS"],
  ["B", "Anonymous → 401 mọi route protected", "/users /customers /services /employees /price-floors + POST session/payment = 401 (test B + live)", "PASS"],
  ["C", "Admin: toàn quyền + quản trị user", "/users 200; nghiệp vụ qua gate (không 403) (test C + live)", "PASS"],
  ["D", "Quản lý: nghiệp vụ + tài chính; KHÔNG tự nhận user.manage", "customers/price-floors 200, thấy giá vốn/fee; /users → 403 (test D + live)", "PASS"],
  ["E", "Lễ tân: khách/booking/thu tiền ALLOW; treatment.write + user.manage DENY; KHÔNG thấy giá vốn", "customers/payment qua gate; sessions POST 403; /users 403; expectedCost=null (test E + live)", "PASS"],
  ["F", "CSKH: CRM/task ALLOW; tài chính DENY", "crm qua gate; price-floors 403; giá vốn/SP.cost/fee=null; dashboard cost/profit=null; /users 403 (test F + live)", "PASS"],
  ["G", "Chuyên viên: treatment ALLOW; finance/user DENY", "sessions POST qua gate; services 200 nhưng expectedCost+floorPrice=null; fee=null; price-floors 403; /users 403 (test G + live)", "PASS"],
  ["H", "Thu ngân: thanh toán/hóa đơn/giá sàn + tài chính ALLOW; user/protocol DENY", "payment qua gate; price-floors 200 + thấy giá vốn; /users 403; protocol POST 403 (test H + live)", "PASS"],
  ["I", "Marketing: chiến dịch ALLOW; treatment/payment/user DENY", "campaign qua gate; sessions/payment POST 403; /users 403 (test I + live). MARKETING có finance.read cho ROI (baseline).", "PASS"],
  ["J", "FINANCIAL PRIVACY (JSON trực tiếp)", "non-finance (CSKH/Chuyên viên): SP.cost/service.expectedCost/floorPrice/session-staff.fee/employee.defaultFee/dashboard.cost+profit = null; finance (Quản lý/Thu ngân) = giá trị (test J + live)", "PASS"],
  ["K", "Direct API attack (role thấp gọi route cao)", "RECEPTION→/users 403; CSKH→price-floors 403; SPECIALIST→session-staff.fee null; MARKETING→payment 403 (test K + live)", "PASS"],
  ["L", "Multi-role UNION quyền (không chỉ role đầu)", "SPECIALIST+CASHIER → có treatment.write ∪ finance.read ∪ payment.write; cả 2 route hoạt động; KHÔNG có user.manage; role rác → 0 quyền (test L/L2)", "PASS"],
  ["M", "Đổi vai trò → phiên MỚI phản ánh quyền mới", "CSKH→MANAGER: trước price-floors 403; Admin PATCH role; đăng nhập lại → 200 + thấy giá vốn (test M)", "PASS"],
  ["N", "UI visibility theo vai trò (bổ sung)", "Admin có thẻ Chi phí/Lợi nhuận + menu Quản trị user; CSKH KHÔNG có thẻ Chi phí/Lợi nhuận (ảnh 7 vai trò)", "PASS"],
  ["O", "Audit thao tác nhạy cảm (actor/before-after; không secret)", "Đổi vai trò → USER_UPDATED {roles:{before,after}} + actor; LOGIN ghi actor; 0 log mật khẩu/hash (test O + SQL)", "PASS"],
  ["P", "Regression", "Baseline 255/34 → 270/35 (+15 test rbac-matrix, +1 file); Mục 2–14 xanh; tsc + build sạch", "PASS"],
];

// Ma trận quyền 7 vai trò (map tới permission code / guard thật).
const COLS = ["Admin", "Quản lý", "Lễ tân", "CSKH", "Chuyên viên", "Thu ngân", "Marketing"];
const A = "✅", D = "❌", L = "◐";
const MATRIX = [
  ["Khách hàng (customer.write)", A, A, A, A, D, D, A],
  ["Booking (booking.write)", A, A, A, D, D, D, D],
  ["Ghi buổi (treatment.write)", A, A, D, D, A, D, D],
  ["Phác đồ/Protocol (protocol.write)", A, A, D, D, A, D, D],
  ["Follow-up mẫu (followup.write)", A, A, D, D, D, D, D],
  ["Áp follow-up (followup.apply)", A, A, D, A, D, D, D],
  ["Hóa đơn (invoice.write)", A, A, A, D, D, A, D],
  ["Thanh toán (payment.write)", A, A, A, D, D, A, D],
  ["Giá sàn — ngưỡng (pricefloor.read)", A, A, A, D, D, A, A],
  ["Giá vốn/CP/LN (finance.read)", A, A, D, D, D, A, A],
  ["Phí nhân sự (staff.fee.read/finance)", A, A, D, D, D, A, A],
  ["Catalog SP (catalog.write)", A, A, D, D, D, D, A],
  ["Chiến dịch (marketing.write)", A, A, D, D, D, D, A],
  ["Quản trị user (user.manage)", A, D, D, D, D, D, D],
];

const apRows = AP.map(([c, req, ev, st]) => `<tr><td class="c">${c}</td><td>${req}</td><td class="ev">${ev}</td><td class="pass">${st}</td></tr>`).join("");
const head = `<tr><th>Module / Capability (permission code)</th>${COLS.map((c) => `<th class="rc">${c}</th>`).join("")}</tr>`;
const mRows = MATRIX.map((r) => `<tr><td class="m">${r[0]}</td>${r.slice(1).map((v) => `<td class="cell ${v===A?'a':v===D?'d':'l'}">${v}</td>`).join("")}</tr>`).join("");

const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;font-family:-apple-system,'Segoe UI',Roboto,sans-serif}
body{margin:0;background:#f1f5f9;color:#0f172a;padding:30px;width:1320px}
h1{font-size:25px;margin:0 0 3px}h2{font-size:18px;margin:22px 0 8px;color:#1d4ed8}
.sub{color:#475569;margin:0 0 14px;font-size:13px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th{background:#1d4ed8;color:#fff;text-align:left;padding:9px 11px;font-size:12px}
th.rc{text-align:center;width:88px}
td{padding:8px 11px;border-top:1px solid #e5e7eb;font-size:12px;vertical-align:top}
td.c{font-weight:700;color:#1d4ed8;white-space:nowrap}
td.ev{color:#334155;font-size:11px}
td.pass{color:#16a34a;font-weight:700}
td.m{font-size:12px}
td.cell{text-align:center;font-size:14px}
td.a{background:#f0fdf4}td.d{background:#fef2f2}td.l{background:#fffbeb}
.badge{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:999px;font-weight:700;font-size:12px}
.foot{margin-top:14px;font-size:11.5px;color:#475569;line-height:1.7}
.leg{font-size:12px;color:#475569;margin:6px 0}
</style>
<h1>Nghiệm thu Mục 15 — Phân quyền theo vai trò / RBAC toàn hệ thống</h1>
<p class="sub">Sophia Care · Bằng chứng THẬT: HTTP route + session/auth thật + DB role/permission + field privacy (JSON) + audit + regression · <span class="badge">16/16 TIÊU CHÍ A–P PASS</span></p>

<h2>Phiếu bằng chứng A–P</h2>
<table><thead><tr><th style="width:44px">Mã</th><th style="width:26%">Yêu cầu</th><th>Bằng chứng (test + live + SQL)</th><th style="width:52px">KQ</th></tr></thead><tbody>${apRows}</tbody></table>

<h2>Ma trận phân quyền 7 vai trò (map tới permission code / backend guard)</h2>
<p class="leg">✅ ALLOW &nbsp;·&nbsp; ❌ DENY (403) &nbsp;·&nbsp; ◐ LIMITED/REDACTED &nbsp;— mọi ô ràng buộc bằng require*/maskFinance ở server (không dựa ẩn menu).</p>
<table><thead>${head}</thead><tbody>${mRows}</tbody></table>

<div class="foot">
<b>KHÔNG sửa business rule/schema</b> — RBAC baseline (Mục 2–14) đã đúng: chỉ THÊM <code>test/rbac-matrix.test.ts</code> (15 test HTTP) để chứng minh. 0 migration, 0 DROP, 0 thay đổi mã nguồn nghiệp vụ. ·
<b>Ghi chú baseline (không phải lỗi):</b> (1) mọi vai trò spa chia sẻ CLINIC_READ → đọc rộng, khác biệt ở WRITE + field tài chính; (2) RECEPTION có pricefloor.read = chỉ thấy NGƯỠNG giá sàn (floorPrice), cost breakdown/biên vẫn mask theo finance.read; (3) MARKETING có finance.read phục vụ ROI. ·
<b>Regression:</b> 270/270 test · 35/35 file · tsc 0 lỗi · next build OK.
</div>`;

fs.writeFileSync("/tmp/m15-sheet.html", html);
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 1000 }, deviceScaleFactor: 2 });
await page.goto("file:///tmp/m15-sheet.html", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/00-phieu-bang-chung.png`, fullPage: true });
console.log("OK sheet");
await browser.close();
