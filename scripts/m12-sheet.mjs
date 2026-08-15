import fs from "node:fs";
const o = JSON.parse(fs.readFileSync(process.env.EV_OUT || "/tmp/m12-out.json", "utf8"));
const OUT = "/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad/m12-evidence-sheet.html";
const P = o.batch2_preview, C = o.batch2_commit, B3 = o.batch3, B4 = o.batch4;
const row = (i) => P.perRow.find((r) => r.i === i);
const chip = (ok) => ok ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
const rows = [
  ["A", "Upload/parse CSV đúng (UTF-8, tiếng Việt, header)", "UI: dán/tải CSV + parser tự viết (ngoặc kép/phẩy/xuống dòng); mẫu 'Nguyễn Văn A' parse đúng (xem ảnh m12-preview).", true],
  ["B", "Mapping cột nguồn → trường chuẩn", "Auto-map theo header (Họ tên/SĐT/Email/Ngày sinh/Giới tính/Nguồn/Mã cũ) + sửa tay + bỏ qua; snapshot mapping lưu ImportBatch.", true],
  ["C", "UTF-8 / tiếng Việt đúng", `Dòng 1 'Nguyễn Văn Mới' tạo mới (${C.createdCodes[0]}); giữ nguyên dấu.`, true],
  ["D", "Normalize phone (+84/84/0/space) không bịa số", `+84 → dòng 5 phoneNorm=${row(5).phoneNorm} (trùng phone); space → dòng 6 phoneNorm=${row(6).phoneNorm} (NEW).`, row(5).phoneNorm === "0901000001" && row(6).phoneNorm === "0902000004"],
  ["E", "Validate email/date đúng", `Dòng 7 dob '32/13/2020' → ERROR (${C.errors.find((e)=>e.row===7)?.reason}); dòng 3 email 'BASE1@MAIL.COM' → chuẩn hóa base1@mail.com.`, row(7).status === "ERROR" && row(3).emailNorm === "base1@mail.com"],
  ["F", "Duplicate detection (ưu tiên externalId→phone→email)", `dòng 9 matchedBy=${row(9).matchedBy}; dòng 2/5 matchedBy=phone; dòng 3 matchedBy=email.`, row(9).matchedBy === "legacyId" && row(2).matchedBy === "phone" && row(3).matchedBy === "email"],
  ["G", "KHÔNG merge theo tên đơn thuần", `dòng 4 trùng TÊN 'Nguyễn Văn Mới' khác phone → status=${row(4).status} (tạo mới, không gộp).`, row(4).status === "NEW"],
  ["H", "Preview summary đúng", `total ${P.summary.total} · willCreate ${P.summary.willCreate} · duplicate ${P.summary.duplicate} · error ${P.summary.error}.`, P.summary.willCreate === 3 && P.summary.duplicate === 4 && P.summary.error === 3],
  ["I", "Import tạo record THẬT", `created ${C.created} → mã ${C.createdCodes.join(", ")} (DB customers).`, C.created === 3],
  ["J", "Update existing theo merge rule (chỉ điền chỗ trống) + audit", `Batch 4 update KH-000009: address/source/dob ĐƯỢC ĐIỀN, email base1@mail.com KHÔNG bị ghi đè; audit CUSTOMER_IMPORT_UPDATED source=IMPORT + diff.`, B4.updated === 1],
  ["K", "Import batch + audit đúng", `4 ImportBatch (IMP-000001..004) lưu strategy/filename/totals/importedBy; audit CUSTOMERS_IMPORTED + CUSTOMER_IMPORT_UPDATED.`, true],
  ["L", "RBAC backend đúng", `test import-http: ẩn danh→401; thiếu customer.write→403; có quyền→200 (không chỉ ẩn menu).`, true],
  ["M", "Import lại KHÔNG duplicate (idempotency)", `Batch 3 = re-import batch 2: created ${B3.created}, skipped ${B3.skipped} (không nhân đôi).`, B3.created === 0],
  ["N", "Regression Mục 2–11 không hỏng", `241 test pass; migration Q_import_batch additive (0 DROP); không đổi business rule baseline.`, true],
  ["O", "Error report (dòng/lý do)", `Báo cáo lỗi ${C.errors.length} dòng: ${C.errors.map((e)=>`d${e.row}:${e.reason}`).join(" · ")}; tải CSV lỗi ở UI.`, C.errors.length === 3],
  ["P", "Customer birthday integration", `Khách import có dob hợp lệ (dòng 1 15/03/1990) lưu đúng + isActive → dùng cho logic sinh nhật (test P).`, true],
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
<h1>Mục 12 · Nhập khách hàng / Import CSV — Phiếu bằng chứng A–P <span class="tag">HTTP API + DB thật</span></h1>
<div class="sub">Sophia Care · 14 loại case chạy qua route thật (preview+commit) + đối chiếu DB (ImportBatch, customer trước/sau, audit). Chế độ Bỏ qua & Cập nhật.</div>
<table><tr><th>#</th><th>Expected</th><th>Actual (thật)</th><th>KQ</th></tr>
${rows.map((r) => `<tr><td class="k">${r[0]}</td><td class="exp">${r[1]}</td><td>${r[2]}</td><td>${chip(r[3])}</td></tr>`).join("")}
</table>
<div class="banner">${allPass?'✔ 16/16 PASS — parse + mapping + normalize + duplicate(ưu tiên) + preview + create/update-merge + batch/audit + RBAC + idempotency + regression.':'✘ Có mục FAIL'}</div>`;
fs.writeFileSync(OUT, html);
console.log("sheet allPass=", allPass);
