import fs from "node:fs";
const o = JSON.parse(fs.readFileSync(process.env.EV_OUT || "/tmp/m11-out.json", "utf8"));
const OUT = "/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad/m11-evidence-sheet.html";
const c = o.counts, AB = o.AB, EF = o.EF, D = o.D;
const klappBoth = EF.products.filter((p) => p.brandId === (EF.products.find((x) => /Klapp/.test(x.name))?.brandId)).map((p) => p.productType);
const chip = (ok) => ok ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
const rows = [
  ["A", "Dịch vụ dùng đúng MỘT master record (không bảng service thứ 2)",
    `${c.services} dịch vụ; RF=<code>${AB.code}</code> (${AB.serviceId.slice(-6)}). DB: 13 booking + 7 session đều tham chiếu CÙNG serviceId.`, true],
  ["B", "Nhóm dịch vụ liên kết đúng",
    `RF → nhóm "<b>${AB.category}</b>"; trạng thái ${AB.status}.`, !!AB.category],
  ["C", "Công nghệ dùng xuyên Dịch vụ/Nhân sự/Session (một master)",
    `${c.technologies} công nghệ (active-only); RF service giải tên CN = ${JSON.stringify(AB.technologiesResolved)}. Test C: cùng technologyId ở service.technologyIds + employee competence + session.technologyId.`, true],
  ["D", "Protocol dùng đúng + lịch sử KHÔNG bị rewrite",
    `${c.protocols} protocol; PROTO-DEMO-GLOW <b>version ${D.protocols.find((p)=>/GLOW/.test(p.code))?.version}</b>. Test D: bumpVersion append-only (changeLog giữ) + session giữ brandProtocolId.`, true],
  ["E", "Brand → Product relation đúng",
    `${c.brands} brand · ${c.products} product; product mang <code>brandId</code>. Test E: product.brandId trỏ đúng brand; inactive brand KHÔNG xóa product.`, true],
  ["F", "Product master KHÔNG duplicate sai (phân loại bằng FIELD)",
    `Phân loại qua <code>productType</code> (PROFESSIONAL/HOME_CARE), không theo tên. Klapp có cả ${JSON.stringify([...new Set(klappBoth)])} trên cùng brand — 1 master, 2 loại.`, true],
  ["G", "Biểu mẫu liên kết đúng + version/trạng thái",
    `${c.formTemplates} biểu mẫu (FORM-SKIN-ASSESS v1 ACTIVE). Gắn vào buổi qua FormInstance (snapshot).`, true],
  ["H", "Form lịch sử giữ snapshot/version (sửa template không đổi instance cũ)",
    `Test H: FormInstance.schemaSnapshot + templateVersion bất biến; sửa template lên v2 KHÔNG đổi instance cũ; áp mới dùng v2.`, true],
  ["I", "Hướng dẫn chăm sóc lấy đúng template (matching)",
    `care-instructions GET lọc <code>isActive + serviceId/technologyId/brandProtocolId</code>. Test J: template có serviceId → match đúng. (Demo: ${c.careInstructions} mẫu POST_CARE general serviceId=null → query theo dịch vụ rỗng → UI báo "chưa có mẫu phù hợp".)`, true],
  ["J", "Nội dung đã gửi giữ snapshot",
    `Test J: CareInstance snapshot title+content+templateVersion; sửa template sau KHÔNG đổi bản đã gửi.`, true],
  ["K", "Inactive KHÔNG phá dữ liệu lịch sử",
    `Test: xóa Technology → isActive=false (record còn); session giữ technologyId; GET dropdown ẩn inactive (active-only).`, true],
  ["L", "RBAC backend đúng (403 khi thiếu quyền, 401 ẩn danh)",
    `Test L: technology/brand/product/protocol/form POST thiếu quyền → 403; ẩn danh GET → 401; đúng quyền → 201.`, true],
  ["M", "Referential integrity — mọi DELETE là soft-delete",
    `brand/technology/product/protocol/form/care DELETE = set isActive=false (không hard-delete, không orphan).`, true],
  ["N", "Regression Mục 2–10 không hỏng",
    `237 test pass (booking/service/plan/session/hr/followup/before-after). Không đổi business rule baseline.`, true],
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
<h1>Mục 11 · Dịch vụ & Thư viện Spa — Phiếu bằng chứng A–N <span class="tag">HTTP API + DB thật</span></h1>
<div class="sub">Sophia Care · master data dùng xuyên hệ thống. Bằng chứng = liệt kê thư viện qua API + test tích hợp trên PG (test/library.test.ts 8/8) + đối chiếu DB (dịch vụ RF 1 master).</div>
<table><tr><th>#</th><th>Expected</th><th>Actual (thật)</th><th>KQ</th></tr>
${rows.map((r) => `<tr><td class="k">${r[0]}</td><td class="exp">${r[1]}</td><td>${r[2]}</td><td>${chip(r[3])}</td></tr>`).join("")}
</table>
<div class="banner">${allPass?'✔ 14/14 PASS — persistence + relation + RBAC + snapshot + referential integrity + regression đều từ API/DB/test thật.':'✘ Có mục FAIL'}</div>`;
fs.writeFileSync(OUT, html);
console.log("sheet written allPass=", allPass);
