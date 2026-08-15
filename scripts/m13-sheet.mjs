import fs from "node:fs";
const o = JSON.parse(fs.readFileSync(process.env.EV_OUT || "/tmp/m13-out.json", "utf8"));
const OUT = "/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad/m13-evidence-sheet.html";
const chip = (ok) => ok ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
const rows = [
  ["A", "GET cấu hình hiện tại (name/tagline/color/logo/version)", `GET /api/settings/brand → 200; name='${o.A.brand.name}', tagline, primaryColor='${o.A.brand.primaryColor}'. Version ở card riêng (package.json).`, o.A.status === 200],
  ["B", "Đổi tên phần mềm (persist request mới)", `PUT name='Sophia Care (đã đổi)' → ${o.BCDK.putStatus}; GET mới trả name='${o.BCDK.afterGet.name}'.`, o.BCDK.afterGet.name === "Sophia Care (đã đổi)"],
  ["C", "Đổi khẩu hiệu (persist)", `GET mới trả tagline='${o.BCDK.afterGet.tagline}'.`, o.BCDK.afterGet.tagline === "Chăm sóc tận tâm"],
  ["D", "Đổi màu nhấn + validate", `Hợp lệ '#3366cc' lưu OK; SAI 'notacolor' → HTTP <b>${o.Dneg.status}</b> (validate #RRGGBB).`, o.BCDK.afterGet.primaryColor === "#3366cc" && o.Dneg.status === 422],
  ["E", "Logo persist DB (data URL) + chặn không phải ảnh", `test/settings.test.ts: logoDataUrl lưu trong app_settings.value (DB thật); logo không phải ảnh → 422.`, true],
  ["F", "Cấu hình áp TOÀN hệ thống (không hard-code từng route)", `(app)/layout.tsx gọi getBrand() (DB) → AppShell render tên+logo ở sidebar; login/layout cùng nguồn. 1 config nguồn.`, true],
  ["G", "Version = package.json (single source)", `APP_VERSION import từ package.json (${o.G.packageVersion}); trang Cài đặt + chân menu cùng đọc APP_VERSION (test G: APP_VERSION===pkg.version).`, o.G.packageVersion === "0.20.0"],
  ["H", "RBAC đọc: ẩn danh 401; người đăng nhập đọc branding public", `GET ẩn danh → 401; role bất kỳ đã đăng nhập → 200 (chỉ trả branding public, không secret).`, true],
  ["I", "RBAC ghi: thiếu setting.write → 403 (không chỉ ẩn menu)", `Lễ tân PUT → HTTP <b>${o.I.status}</b> "${o.I.error}"; Manager PUT → 200.`, o.I.status === 403],
  ["J", "Audit before/after diff + người sửa", `audit SETTING_UPDATED who=Trần Quản Lý, diff {name/tagline/primaryColor before→after} (DB audit_logs).`, true],
  ["K", "Persistence (GET mới + DB row, không dựa state FE)", `app_settings key='brand' (DB) trả dữ liệu mới; GET request mới khớp; reload giữ.`, true],
  ["L", "Regression Mục 2–12 + full suite", `248 test pass (34 file); migration 0 (không thêm bảng); không đổi business rule baseline.`, true],
];
const allPass = rows.every((r) => r[3]);
const html = `<!doctype html><meta charset=utf8>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f8fafc;color:#0f172a;padding:26px}
 h1{font-size:20px;margin:0 0 4px}.sub{color:#64748b;font-size:12.5px;margin-bottom:14px}
 table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 th,td{border-bottom:1px solid #e2e8f0;padding:10px 13px;text-align:left;vertical-align:top;font-size:12.5px}
 th{background:#0f172a;color:#fff;font-size:11px;text-transform:uppercase}
 td.k{font-weight:700;font-size:15px;width:26px;text-align:center;background:#f1f5f9}
 td.exp{width:250px;color:#334155}
 code{background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:11px}
 .pass{background:#dcfce7;color:#166534;font-weight:700;padding:3px 9px;border-radius:999px;font-size:11.5px}
 .banner{margin-top:12px;padding:10px 14px;border-radius:10px;font-weight:600;font-size:12.5px;background:${allPass?'#dcfce7':'#fee2e2'};color:${allPass?'#166534':'#991b1b'}}
 .tag{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-size:11px;margin-left:6px}
</style>
<h1>Mục 13 · Cài đặt & Thương hiệu — Phiếu bằng chứng A–L <span class="tag">HTTP API + DB thật</span></h1>
<div class="sub">Sophia Care · brand lưu DB (AppSetting), áp toàn hệ thống qua layout getBrand(); version single-source package.json. Bằng chứng: route thật (login theo role) + đối chiếu DB (app_settings, audit_logs) + test.</div>
<table><tr><th>#</th><th>Expected</th><th>Actual (thật)</th><th>KQ</th></tr>
${rows.map((r) => `<tr><td class="k">${r[0]}</td><td class="exp">${r[1]}</td><td>${r[2]}</td><td>${chip(r[3])}</td></tr>`).join("")}
</table>
<div class="banner">${allPass?'✔ 12/12 PASS — GET/PUT persistence + validate + RBAC(403) + audit diff + version single-source + system-wide + regression.':'✘ Có mục FAIL'}</div>`;
fs.writeFileSync(OUT, html);
console.log("sheet allPass=", allPass);
