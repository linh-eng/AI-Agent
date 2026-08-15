// Mục 12 — Import khách hàng: bằng chứng THẬT (HTTP API) — 14 case + idempotency + update.
const BASE = "http://localhost:3100";
let IP = 70;
const j = (x) => JSON.stringify(x, null, 2);
const line = (t) => console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70));

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${IP++}` }, body: JSON.stringify({ email, password }) });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}
async function api(cookie, path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  let data = null, error = null; try { const j = await res.json(); data = j.data; error = j.error; } catch {}
  return { status: res.status, data, error };
}

const out = {};
const staff = await login("quanly@sophia.com.vn", "quanly123");
const SRC = "IMP-TEST-" + IP;

line("Batch 1 — tạo nền (base customer có phone/email/legacyId)");
const b1 = await api(staff, "/api/imports/customers/commit", {
  legacySource: SRC, strategy: "skip", filename: "base.csv",
  rows: [{ fullName: "Khách Nền", phone: "0901000001", email: "base1@mail.com", legacyId: "EXT-100" }],
});
out.batch1 = { batchCode: b1.data.batchCode, created: b1.data.created };
console.log(j(out.batch1));

line("Batch 2 — 10 dòng gồm 14 loại case (preview + commit, chế độ BỎ QUA trùng)");
const rows2 = [
  { fullName: "Nguyễn Văn Mới", phone: "0902000002", email: "moi@mail.com", dob: "15/03/1990" }, // 1,8,12 unicode+valid
  { fullName: "Trùng Phone", phone: "0901000001" },                                              // 2 dup phone
  { fullName: "Trùng Email", phone: "0902000099", email: "BASE1@MAIL.COM" },                     // 3,7 dup email (uppercase)
  { fullName: "Nguyễn Văn Mới", phone: "0902000003" },                                           // 4 trùng tên khác phone → NEW
  { fullName: "Trùng +84", phone: "+84 901000001" },                                             // 5 +84 → dup phone
  { fullName: "Cách Trống", phone: "0902 000 004" },                                             // 6 phone có khoảng trắng → NEW
  { fullName: "Ngày Sai", phone: "0902000005", dob: "32/13/2020" },                              // 9 dob sai → ERROR
  { fullName: "", phone: "0902000006" },                                                         // 10 thiếu tên → ERROR
  { fullName: "Trùng EXT", phone: "0902000007", legacyId: "EXT-100" },                           // 13 externalId đã tồn tại
  { fullName: "", phone: "", email: "" },                                                        // 11 dòng blank → ERROR
];
const prev2 = await api(staff, "/api/imports/customers/preview", { legacySource: SRC, strategy: "skip", rows: rows2 });
out.batch2_preview = {
  summary: prev2.data.summary,
  perRow: prev2.data.analysis.map((a) => ({ i: a.index + 1, status: a.status, action: a.action, matchedBy: a.matchedBy, phoneNorm: a.normalized.phone, emailNorm: a.normalized.email })),
};
console.log(j(out.batch2_preview));
const b2 = await api(staff, "/api/imports/customers/commit", { legacySource: SRC, strategy: "skip", filename: "batch2.csv", mapping: { fullName: "Ho ten", phone: "SDT", email: "Email", legacyId: "Ma cu" }, rows: rows2 });
out.batch2_commit = { batchCode: b2.data.batchCode, created: b2.data.created, skipped: b2.data.skippedDuplicate, errorRows: b2.data.errorRows, createdCodes: b2.data.createdCodes, errors: b2.data.errors.map((e) => ({ row: e.index + 1, reason: e.reason })) };
console.log(j(out.batch2_commit));

line("Batch 3 — IMPORT LẠI cùng batch 2 (idempotency: không tạo trùng)");
const b3 = await api(staff, "/api/imports/customers/commit", { legacySource: SRC, strategy: "skip", filename: "batch2.csv", rows: rows2 });
out.batch3 = { created: b3.data.created, skipped: b3.data.skippedDuplicate, errorRows: b3.data.errorRows };
console.log(j(out.batch3));

line("Batch 4 — UPDATE mode: điền chỗ trống + KHÔNG ghi đè + audit");
const b4 = await api(staff, "/api/imports/customers/commit", {
  legacySource: SRC, strategy: "update", filename: "update.csv",
  rows: [{ fullName: "Khách Nền", phone: "0901000001", email: "khac@mail.com", address: "456 XYZ", source: "MKT", dob: "20/08/1996" }],
});
out.batch4 = { updated: b4.data.updated, created: b4.data.created, updatedCodes: b4.data.updatedCodes, batchCode: b4.data.batchCode };
console.log(j(out.batch4));

out.source = SRC;
const fs = await import("node:fs");
fs.writeFileSync(process.env.EV_OUT || "/tmp/m12-out.json", j(out));
console.log("\n→ wrote", process.env.EV_OUT || "/tmp/m12-out.json");
