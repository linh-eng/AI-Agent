// Sinh phiếu bằng chứng HTML Mục 14 rồi render PNG bằng Playwright.
import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.argv[2] || "/tmp/m14-shots";
fs.mkdirSync(OUT, { recursive: true });

const rows = [
  ["A", "Danh sách tài khoản (id/email/vai trò/trạng thái) — KHÔNG lộ passwordHash", "GET /api/users → 200; mẫu bản ghi có id/email/name/isActive/roles; JSON không chứa 'passwordHash' (test A + live)", "PASS"],
  ["B/L", "Chỉ Admin (user.manage) mới thao tác — ẩn danh 401, thiếu quyền 403, có quyền 200", "Ẩn danh GET→401; RECEPTION→403; POST/PATCH/DELETE thiếu quyền→403; Admin→200 (test B/L + live)", "PASS"],
  ["C", "Tạo tài khoản: hash bcrypt (không plaintext), email trùng → 409", "POST→201; DB passwordHash bắt đầu '$2' & không chứa plaintext; trùng email→409 (test C + live)", "PASS"],
  ["D", "Gán nhiều vai trò; vai trò rác bị loại", "roleCodes=[MANAGER,CASHIER,ROLE_RAC] → DB chỉ [CASHIER,MANAGER]; UI hiện 2 chip (test D + ảnh)", "PASS"],
  ["E", "Sửa vai trò → quyền hiệu lực đổi (đăng nhập lại)", "PATCH roleCodes; login lại → session có CUSTOMER_WRITE của MANAGER, KHÔNG có USER_MANAGE (test E)", "PASS"],
  ["F", "Đặt lại mật khẩu: mật khẩu cũ fail, mới login được, không trả hash", "PATCH password; login cũ→401, mới→200; body PATCH không chứa 'passwordHash' (test F + live)", "PASS"],
  ["G", "Khóa tài khoản → không đăng nhập được", "PATCH isActive=false; login→401 (login route chặn !user.isActive) (test G/H + live)", "PASS"],
  ["H", "Mở khóa → đăng nhập lại được", "PATCH isActive=true; login→200 (test G/H + live)", "PASS"],
  ["I", "Xóa tài khoản (hard delete); audit_logs không mồ côi (userId=null)", "DELETE→200; user không còn; audit LOGIN cũ giữ record, userId set null (test I + live)", "PASS"],
  ["J", "Không được xóa/khóa CHÍNH MÌNH", "PATCH isActive=false (self)→409; DELETE (self)→409 (test J + live)", "PASS"],
  ["K", "Không xóa Admin cuối cùng (đường DELETE)", "actor super-role (user.manage, không ADMIN) DELETE admin duy nhất→409 'Admin cuối'; vẫn còn 1 admin active (test K)", "PASS"],
  ["K2", "Không bypass Admin cuối qua PATCH (gỡ role ADMIN / khóa); 2 admin thì cho phép", "PATCH gỡ ADMIN→409; PATCH khóa→409; thêm admin thứ 2 → gỡ ADMIN 1 người→200 (test K2)", "PASS"],
  ["M", "Audit đủ actor/target/action + before/after; KHÔNG log mật khẩu/hash", "USER_CREATED/UPDATED/DELETED có userId(actor)+entityId(target); UPDATE có {isActive/roles:{before,after}}; 0 rò rỉ matkhau/$2 (test M + SQL)", "PASS"],
  ["N", "Regression: full baseline + test mới", "Baseline 248 (users.test cũ 5) → sau 255; +7 test (users.test mới 12); 34/34 file PASS; tsc + build sạch", "PASS"],
];

const tr = rows.map(([c, req, ev, st]) => `<tr><td class="c">${c}</td><td>${req}</td><td class="ev">${ev}</td><td class="${st==="PASS"?"pass":"fail"}">${st}</td></tr>`).join("");
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;font-family:-apple-system,'Segoe UI',Roboto,sans-serif}
body{margin:0;background:#f1f5f9;color:#0f172a;padding:32px}
h1{font-size:26px;margin:0 0 4px}.sub{color:#475569;margin:0 0 18px;font-size:14px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th{background:#1d4ed8;color:#fff;text-align:left;padding:11px 13px;font-size:13px}
td{padding:10px 13px;border-top:1px solid #e2e8f0;font-size:13px;vertical-align:top}
td.c{font-weight:700;color:#1d4ed8;white-space:nowrap}
td.ev{color:#334155;font-size:12px}
td.pass{color:#16a34a;font-weight:700}td.fail{color:#dc2626;font-weight:700}
.foot{margin-top:16px;font-size:12px;color:#475569;line-height:1.7}
.badge{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:999px;font-weight:700;font-size:12px}
</style>
<h1>Nghiệm thu Mục 14 — Quản trị người dùng / Tài khoản đăng nhập</h1>
<p class="sub">Sophia Care · Bằng chứng THẬT: HTTP route + PostgreSQL + RBAC backend + audit + regression · <span class="badge">14/14 TIÊU CHÍ PASS</span></p>
<table><thead><tr><th style="width:52px">Mã</th><th style="width:30%">Yêu cầu</th><th>Bằng chứng (test + live + SQL)</th><th style="width:60px">KQ</th></tr></thead><tbody>${tr}</tbody></table>
<div class="foot">
<b>Không sửa schema/migration</b> — dùng model User/Role/UserRole sẵn có (0 migration mới, 0 DROP). ·
<b>Thay đổi mã nguồn:</b> chặn "Admin cuối" qua PATCH (gỡ role ADMIN hoặc khóa) — bịt lỗ bypass còn lại; làm giàu audit USER_UPDATED với before/after. ·
<b>Nhân sự ≠ Tài khoản:</b> /employees là danh mục nhân viên; /users là tài khoản đăng nhập + vai trò RBAC — hai thực thể tách biệt. ·
<b>Regression:</b> 255/255 test · 34/34 file · tsc 0 lỗi · next build OK.
</div>`;

fs.writeFileSync("/tmp/m14-sheet.html", html);
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
await page.goto("file:///tmp/m14-sheet.html", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/00-phieu-bang-chung.png`, fullPage: true });
console.log("OK sheet");
await browser.close();
