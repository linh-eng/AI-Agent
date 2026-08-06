/* =====================================================================
 * Hệ thống Hỗ trợ THNG — Máy chủ nội bộ (LAN) + Đăng nhập & Phân quyền
 * Lưu trữ: SQLite (node:sqlite tích hợp sẵn trong Node 22.5+/24) — data.db
 * Zero-dependency: chỉ cần cài Node.js, KHÔNG cần "npm install".
 * Tự động di trú dữ liệu cũ từ data.json (nếu có) sang data.db lần đầu chạy.
 * Chạy:  node server.js   (hoặc start-windows.bat / start.sh)
 * ===================================================================== */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
let DatabaseSync;
try { ({ DatabaseSync } = require("node:sqlite")); }
catch (e) {
  console.error("\n[!] Node của bạn chưa hỗ trợ node:sqlite. Hãy cập nhật Node.js lên bản 22.5+ hoặc 24 LTS (https://nodejs.org).\n");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ROOT = __dirname;
const PUB = path.join(ROOT, "public");
const DB_FILE = path.join(ROOT, "data.db");
const JSON_FILE = path.join(ROOT, "data.json");
const SESSION_MS = 8 * 60 * 60 * 1000;

/* ============================ QUYỀN THEO VAI TRÒ ============================ */
const ROLES = {
  admin:    { label: "Quản trị hệ thống",               viewAll:1, create:1, edit:1, del:1, ps:1, approve:1, users:1 },
  dieuphoi: { label: "Điều phối / Trưởng bộ phận Hỗ trợ", viewAll:1, create:1, edit:1, del:1, ps:1, approve:1 },
  xuly:     { label: "Nhân viên xử lý",                  viewAll:1, create:1, edit:1, ps:1 },
  yeucau:   { label: "Người yêu cầu (phòng ban)",         create:1 },
  giamdoc:  { label: "Ban giám đốc (chỉ xem)",            viewAll:1, readonly:1 },
};
function can(user, act) { return !!(user && ROLES[user.role] && ROLES[user.role][act]); }
function capOf(role) { const r = ROLES[role] || {}; const o = {}; for (const k in r) if (k !== "label") o[k] = r[k]; return o; }

/* ---- Trạng thái & quy trình (v3) ---- */
function baseStatus(s) { return String(s || "").replace(/^\d+\.\s*/, "").trim(); }
function isClosedStatus(s) { const b = baseStatus(s); return b === "Hoàn tất" || b === "Từ chối"; }
// Thao tác nào bắt buộc ghi lý do
function needReason(from, to) {
  const bt = baseStatus(to), bf = baseStatus(from);
  if (["Từ chối", "Trả lại bổ sung", "Tạm dừng", "Mở lại"].includes(bt)) return true;
  if (bf === "Tạm dừng" && bt === "Đã tiếp nhận") return true; // phân loại lại
  return false;
}

/* ============================ SQLITE ============================ */
const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, role TEXT, dept TEXT, salt TEXT, hash TEXT, mustChange INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, tCreate TEXT, createdBy TEXT, donvi TEXT, nguoiYC TEXT, uutien TEXT, trangthai TEXT, data TEXT);
  CREATE TABLE IF NOT EXISTS ps (id TEXT PRIMARY KEY, ticketId TEXT, data TEXT);
  CREATE TABLE IF NOT EXISTS seq (k TEXT PRIMARY KEY, v INTEGER);
  CREATE INDEX IF NOT EXISTS ix_tickets_donvi ON tickets(donvi);
  CREATE INDEX IF NOT EXISTS ix_tickets_createdBy ON tickets(createdBy);
  CREATE INDEX IF NOT EXISTS ix_ps_ticketId ON ps(ticketId);
`);

/* ---- Tiện ích ID ---- */
function ymd(d) { return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
const qSeqGet = db.prepare("SELECT v FROM seq WHERE k = ?");
const qSeqSet = db.prepare("INSERT INTO seq(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v");
function seqNext(pfx, day) { const k = pfx + ymd(day); const cur = qSeqGet.get(k); const v = (cur ? cur.v : 0) + 1; qSeqSet.run(k, v); return v; }
// Mã ticket lấy theo NGÀY TIẾP NHẬN (ngày tạo phiếu), không phải ngày lưu bản ghi.
function genId(pfx, day) { day = day || new Date(); return `${pfx}-${ymd(day)}-${String(seqNext(pfx, day)).padStart(4,"0")}`; }
// Kiểm tra mật khẩu: tối thiểu 8 ký tự, có cả chữ và số
function validPw(pw) { pw = String(pw || ""); return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw); }
const PW_MSG = "Mật khẩu phải từ 8 ký tự trở lên và có cả chữ lẫn số";

/* ---- Lớp truy cập dữ liệu (DAL) ---- */
const S = {
  users:      db.prepare("SELECT * FROM users"),
  user:       db.prepare("SELECT * FROM users WHERE username = ?"),
  userIns:    db.prepare("INSERT INTO users(username,name,role,dept,salt,hash,mustChange) VALUES(?,?,?,?,?,?,?)"),
  userUpd:    db.prepare("UPDATE users SET name=?,role=?,dept=?,salt=?,hash=?,mustChange=? WHERE username=?"),
  userDel:    db.prepare("DELETE FROM users WHERE username = ?"),
  tickets:    db.prepare("SELECT data FROM tickets ORDER BY rowid DESC"),
  ticketsFor: db.prepare("SELECT data FROM tickets WHERE donvi=? OR nguoiYC=? OR createdBy=? ORDER BY rowid DESC"),
  ticket:     db.prepare("SELECT data FROM tickets WHERE id = ?"),
  ticketIns:  db.prepare("INSERT INTO tickets(id,tCreate,createdBy,donvi,nguoiYC,uutien,trangthai,data) VALUES(?,?,?,?,?,?,?,?)"),
  ticketUpd:  db.prepare("UPDATE tickets SET tCreate=?,createdBy=?,donvi=?,nguoiYC=?,uutien=?,trangthai=?,data=? WHERE id=?"),
  ticketDel:  db.prepare("DELETE FROM tickets WHERE id = ?"),
  psAll:      db.prepare("SELECT data FROM ps ORDER BY rowid DESC"),
  psOne:      db.prepare("SELECT data FROM ps WHERE id = ?"),
  psIns:      db.prepare("INSERT INTO ps(id,ticketId,data) VALUES(?,?,?)"),
  psUpd:      db.prepare("UPDATE ps SET ticketId=?,data=? WHERE id=?"),
  psDel:      db.prepare("DELETE FROM ps WHERE id = ?"),
  cntUsers:   db.prepare("SELECT COUNT(*) c FROM users"),
  cntTickets: db.prepare("SELECT COUNT(*) c FROM tickets"),
  cntAdmins:  db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'"),
};
const parse = rows => rows.map(r => JSON.parse(r.data));
function allTickets() { return parse(S.tickets.all()); }
function ticketsForUser(u) { return can(u,"viewAll") ? allTickets() : parse(S.ticketsFor.all(u.dept||"", u.name||"", u.username||"")); }
function getTicket(id) { const r = S.ticket.get(id); return r ? JSON.parse(r.data) : null; }
function saveTicketRow(t, isNew) {
  const args = [t.tCreate||"", t.createdBy||"", t.donvi||"", t.nguoiYC||"", t.uutien||"", t.trangthai||"", JSON.stringify(t)];
  if (isNew) S.ticketIns.run(t.id, ...args); else S.ticketUpd.run(...args, t.id);
}
function allPS() { return parse(S.psAll.all()); }
function getPS(id) { const r = S.psOne.get(id); return r ? JSON.parse(r.data) : null; }
function savePSRow(x, isNew) { if (isNew) S.psIns.run(x.id, x.ticketId||"", JSON.stringify(x)); else S.psUpd.run(x.ticketId||"", JSON.stringify(x), x.id); }

/* ============================ MẬT KHẨU (scrypt) ============================ */
function hashPw(pw, salt) { salt = salt || crypto.randomBytes(16).toString("hex"); const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex"); return { salt, hash }; }
function verifyPw(pw, salt, hash) { try { const h = crypto.scryptSync(String(pw), salt, 64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)); } catch { return false; } }
function sanitizeUser(u) { return { username: u.username, name: u.name, role: u.role, dept: u.dept || "" }; }

/* ============================ PHIÊN ĐĂNG NHẬP ============================ */
const sessions = new Map();
function newSession(username) { const t = crypto.randomBytes(24).toString("hex"); sessions.set(t, { username, exp: Date.now()+SESSION_MS }); return t; }
function cookies(req) { const o = {}; (req.headers.cookie||"").split(";").forEach(p => { const i = p.indexOf("="); if (i>0) o[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim()); }); return o; }
function currentUser(req) {
  const t = cookies(req).sid; if (!t) return null;
  const s = sessions.get(t); if (!s || s.exp < Date.now()) { sessions.delete(t); return null; }
  return S.user.get(s.username) || null;
}

/* ============================ DI TRÚ TỪ data.json ============================ */
function migrateFromJson() {
  if (S.cntUsers.get().c > 0 || S.cntTickets.get().c > 0) return; // đã có dữ liệu -> bỏ qua
  if (!fs.existsSync(JSON_FILE)) return;
  let old; try { old = JSON.parse(fs.readFileSync(JSON_FILE, "utf8")); } catch { return; }
  const tx = db.prepare("SELECT 1"); // no-op để giữ phong cách; dùng transaction thủ công
  db.exec("BEGIN");
  try {
    (old.users||[]).forEach(u => S.userIns.run(u.username, u.name||u.username, u.role, u.dept||"", u.salt, u.hash, u.mustChange?1:0));
    (old.tickets||[]).slice().reverse().forEach(t => saveTicketRow(t, true)); // reverse để giữ thứ tự hiển thị
    (old.ps||[]).slice().reverse().forEach(x => savePSRow(x, true));
    Object.entries(old.seq||{}).forEach(([k,v]) => qSeqSet.run(k, v));
    db.exec("COMMIT");
    fs.renameSync(JSON_FILE, JSON_FILE + ".imported"); // đổi tên để không nhập lại
    console.log("  ✓ Đã di trú dữ liệu từ data.json sang data.db (bản cũ lưu thành data.json.imported).");
  } catch (e) { db.exec("ROLLBACK"); console.error("Lỗi di trú:", e.message); }
}

/* ============================ DỮ LIỆU MẪU LẦN ĐẦU ============================ */
function seedUsers() {
  if (S.cntUsers.get().c > 0) return;
  // mustChange=1 cho MỌI tài khoản mẫu — bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên
  const mk = (username, pw, name, role, dept) => { const { salt, hash } = hashPw(pw); S.userIns.run(username, name, role, dept||"", salt, hash, 1); };
  mk("admin", "admin123", "Quản trị viên", "admin", "Phòng Hỗ trợ");
  mk("dieuphoi", "123456", "Trưởng bộ phận Hỗ trợ", "dieuphoi", "Phòng Hỗ trợ");
  mk("xuly1", "123456", "Trần Văn B", "xuly", "Phòng Hỗ trợ");
  mk("kinhdoanh", "123456", "Nguyễn Văn A", "yeucau", "P. Kinh doanh");
  mk("giamdoc", "123456", "Ban Giám đốc", "giamdoc", "Ban Giám đốc");
}
function seedTickets() {
  if (S.cntTickets.get().c > 0) return;
  const d = new Date("2026-08-03T08:15:00");
  qSeqSet.run("TK"+ymd(d), 0); qSeqSet.run("PS"+ymd(d), 0);
  const extern = new Set(["Sự cố dịch vụ - gián đoạn vận hành","Bảo trì - bảo dưỡng định kỳ","Sửa chữa - khắc phục hỏng hóc","Giao nhận hàng hóa cho khách hàng","Lắp đặt - nghiệm thu tại điểm khách hàng","Khiếu nại - yêu cầu xử lý của khách hàng"]);
  const loai = "Giao nhận hàng hóa cho khách hàng";
  const id = genId("TK", d);
  const t = { id, tCreate: d.toISOString(), createdBy: "kinhdoanh", loai, luong: extern.has(loai)?"Hỗ trợ Khách hàng bên ngoài":"Hỗ trợ Nội bộ",
    donvi:"P. Kinh doanh", nguoiYC:"Nguyễn Văn A", sdt:"0901234567", email:"a.nguyen@congty.vn", watchers:"Trưởng P.KD; KT trưởng",
    noidung:"Giao hàng mẫu cho khách hàng ABC theo HĐ 125/HĐKT", soluong:20, dvt:"Thùng", quycach:"Carton 40x30x30cm, hàng dễ vỡ, không xếp chồng",
    diadiemGiao:"Kho A - 12 Nguyễn Huệ, Q.1", diadiemNhan:"Cty ABC - 45 Lê Lợi, Q.3", tGiaoYC:"2026-08-03T10:00",
    uutien:"P2 - Ưu tiên cao", doi:"Đội Giao nhận 1", assignee:"Trần Văn B", phoihop:"Lê Văn E (bốc xếp)",
    tAssign:"2026-08-03T08:25", tStart:"2026-08-03T09:30", tDone:"2026-08-03T16:20", trangthai:"Hoàn tất", uutienDeXuat:"P2 - Ưu tiên cao",
    slThucte:19, diadiemThucte:"Cty ABC - 45 Lê Lợi, Q.3", nguoiNhan:"Lê Thị C", nghiemthu:"Hoàn thành một phần",
    dexuat:"Đổi 01 thùng mới giao trong ngày 04/08; phổ biến lại quy tắc bốc xếp", dathuchien:"Đã lập biên bản với khách, nhập lại kho 01 thùng lỗi",
    attach:"BBGN_08.pdf; anh_thung_mop.jpg", csat:4, nhanxet:"Xử lý nhanh, cần cẩn thận khâu bốc xếp", tClose:"2026-08-04T09:00", moLai:0, ghichu:"" };
  t.history = [
    { at:"2026-08-03T08:15:00", from:"", to:"Tạo mới", by:"kinhdoanh", note:"Tạo phiếu yêu cầu" },
    { at:"2026-08-03T08:25:00", from:"Tạo mới", to:"Đã tiếp nhận", by:"dieuphoi", note:"Đủ điều kiện, chốt P2" },
    { at:"2026-08-03T09:30:00", from:"Đã tiếp nhận", to:"Đang xử lý", by:"xuly1", note:"Bắt đầu xử lý" },
    { at:"2026-08-03T16:20:00", from:"Đang xử lý", to:"Đã xử lý", by:"xuly1", note:"Hoàn thành xử lý" },
    { at:"2026-08-04T09:00:00", from:"Đã xử lý", to:"Hoàn tất", by:"kinhdoanh", note:"Nghiệm thu đạt" },
  ];
  saveTicketRow(t, true);
  const psId = genId("PS", d);
  savePSRow({ id: psId, ticketId:id, ngay:"2026-08-03", loai:"Sự cố hàng hóa (hư hỏng/thiếu/mất)", nhomNN:"Chủ quan (do người thực hiện)",
    mota:"01/20 thùng bị móp góc, khách hàng ABC từ chối nhận", nguyennhan:"Xếp chồng quá 3 lớp khi bốc xếp lên xe",
    anhhuong:"Trung bình", chiphiDX:50000, chiphiDuyet:50000, duyet:"Đã duyệt", attach:"BBGN_08.pdf; anh_thung_mop.jpg", nguoiXL:"Trần Văn B" }, true);
}

/* ============================ HTTP ============================ */
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".png":"image/png" };
function sendJSON(res, code, obj, headers) { const s = JSON.stringify(obj); res.writeHead(code, Object.assign({ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }, headers||{})); res.end(s); }
function readBody(req) { return new Promise(r => { let b=""; req.on("data", c => { b+=c; if (b.length>5e6) req.destroy(); }); req.on("end", () => { try { r(b?JSON.parse(b):{}); } catch { r({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/login" && req.method === "POST") {
        const { username, password } = await readBody(req);
        const u = S.user.get(String(username||"").trim());
        if (!u || !verifyPw(password, u.salt, u.hash)) return sendJSON(res, 401, { error: "Sai tên đăng nhập hoặc mật khẩu" });
        const token = newSession(u.username);
        return sendJSON(res, 200, { user: sanitizeUser(u), cap: capOf(u.role), roleLabel: ROLES[u.role].label, mustChange: !!u.mustChange },
          { "Set-Cookie": `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MS/1000}` });
      }
      if (p === "/api/logout" && req.method === "POST") {
        const t = cookies(req).sid; if (t) sessions.delete(t);
        return sendJSON(res, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" });
      }

      const me = currentUser(req);
      if (!me) return sendJSON(res, 401, { error: "Chưa đăng nhập" });

      if (p === "/api/me" && req.method === "GET")
        return sendJSON(res, 200, { user: sanitizeUser(me), cap: capOf(me.role), roleLabel: ROLES[me.role].label, mustChange: !!me.mustChange });

      if (p === "/api/change-password" && req.method === "POST") {
        const { oldPassword, newPassword } = await readBody(req);
        if (!verifyPw(oldPassword, me.salt, me.hash)) return sendJSON(res, 400, { error: "Mật khẩu hiện tại không đúng" });
        if (!validPw(newPassword)) return sendJSON(res, 400, { error: PW_MSG });
        const { salt, hash } = hashPw(newPassword); S.userUpd.run(me.name, me.role, me.dept||"", salt, hash, 0, me.username);
        return sendJSON(res, 200, { ok: true });
      }

      if (p === "/api/data" && req.method === "GET")
        return sendJSON(res, 200, { tickets: ticketsForUser(me), ps: allPS(), seq: {} });

      /* ---- Ticket ---- */
      if (p === "/api/tickets" && req.method === "POST") {
        if (!can(me, "create")) return sendJSON(res, 403, { error: "Không có quyền tạo ticket" });
        const t = await readBody(req); t.id = genId("TK"); t.tCreate = new Date().toISOString(); t.createdBy = me.username;
        t.trangthai = "Tạo mới"; t.uutienDeXuat = t.uutien || ""; t.moLai = +t.moLai || 0;
        t.history = [{ at: t.tCreate, from: "", to: "Tạo mới", by: me.username, note: "Tạo phiếu yêu cầu" }];
        delete t._reason;
        saveTicketRow(t, true); return sendJSON(res, 201, t);
      }
      let m;
      if ((m = p.match(/^\/api\/tickets\/(.+)$/))) {
        const id = decodeURIComponent(m[1]); const cur = getTicket(id);
        if (!cur) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          // Người yêu cầu được sửa & gửi lại chính ticket của mình khi bị "Trả lại bổ sung"
          const ownerResubmit = can(me, "create") && cur.createdBy === me.username && baseStatus(cur.trangthai) === "Trả lại bổ sung";
          if (!can(me, "edit") && !ownerResubmit) return sendJSON(res, 403, { error: "Không có quyền sửa ticket" });
          const t = await readBody(req); t.id = id; t.createdBy = cur.createdBy;
          const note = String(t._reason || "").trim();
          t.history = Array.isArray(cur.history) ? cur.history.slice() : [];
          if (baseStatus(t.trangthai) !== baseStatus(cur.trangthai)) {
            if (needReason(cur.trangthai, t.trangthai) && note.length < 5)
              return sendJSON(res, 400, { error: "Vui lòng ghi lý do (tối thiểu 5 ký tự) cho thao tác này" });
            t.history.push({ at: new Date().toISOString(), from: cur.trangthai, to: t.trangthai, by: me.username, note });
          }
          delete t._reason;
          saveTicketRow(t, false); return sendJSON(res, 200, t);
        }
        if (req.method === "DELETE") {
          if (!can(me, "del")) return sendJSON(res, 403, { error: "Không có quyền xóa ticket" });
          S.ticketDel.run(id); return sendJSON(res, 200, { ok: true });
        }
      }

      /* ---- Phát sinh ---- */
      if (p === "/api/ps" && req.method === "POST") {
        if (!can(me, "ps")) return sendJSON(res, 403, { error: "Không có quyền ghi phát sinh" });
        const x = await readBody(req); x.id = genId("PS"); savePSRow(x, true); return sendJSON(res, 201, x);
      }
      if ((m = p.match(/^\/api\/ps\/(.+)$/))) {
        const id = decodeURIComponent(m[1]); const cur = getPS(id);
        if (!cur) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          if (!can(me, "approve")) return sendJSON(res, 403, { error: "Không có quyền phê duyệt/sửa phát sinh" });
          const x = await readBody(req); x.id = id; savePSRow(x, false); return sendJSON(res, 200, x);
        }
        if (req.method === "DELETE") {
          if (!can(me, "del")) return sendJSON(res, 403, { error: "Không có quyền xóa" });
          S.psDel.run(id); return sendJSON(res, 200, { ok: true });
        }
      }

      /* ---- Người dùng (admin) ---- */
      if (p === "/api/users") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        if (req.method === "GET") return sendJSON(res, 200, S.users.all().map(sanitizeUser));
        if (req.method === "POST") {
          const b = await readBody(req); const un = String(b.username||"").trim();
          if (!un || !b.password) return sendJSON(res, 400, { error: "Thiếu tên đăng nhập hoặc mật khẩu" });
          if (S.user.get(un)) return sendJSON(res, 400, { error: "Tên đăng nhập đã tồn tại" });
          if (!ROLES[b.role]) return sendJSON(res, 400, { error: "Vai trò không hợp lệ" });
          if (!validPw(b.password)) return sendJSON(res, 400, { error: PW_MSG });
          const { salt, hash } = hashPw(b.password);
          // Người dùng mới do admin tạo phải đổi mật khẩu ở lần đăng nhập đầu
          S.userIns.run(un, b.name||un, b.role, b.dept||"", salt, hash, 1); return sendJSON(res, 201, { ok: true });
        }
      }
      if ((m = p.match(/^\/api\/users\/(.+)$/))) {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        const un = decodeURIComponent(m[1]); const u = S.user.get(un);
        if (!u) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          const b = await readBody(req);
          const name = b.name != null ? b.name : u.name;
          const role = (b.role && ROLES[b.role]) ? b.role : u.role;
          const dept = b.dept != null ? b.dept : u.dept;
          let salt = u.salt, hash = u.hash, mustChange = u.mustChange;
          if (b.password) { if (!validPw(b.password)) return sendJSON(res, 400, { error: PW_MSG }); const h = hashPw(b.password); salt = h.salt; hash = h.hash; mustChange = 1; }
          S.userUpd.run(name, role, dept, salt, hash, mustChange, un); return sendJSON(res, 200, { ok: true });
        }
        if (req.method === "DELETE") {
          if (un === me.username) return sendJSON(res, 400, { error: "Không thể tự xóa tài khoản đang dùng" });
          if (u.role === "admin" && S.cntAdmins.get().c <= 1) return sendJSON(res, 400, { error: "Phải còn ít nhất 1 quản trị viên" });
          S.userDel.run(un); return sendJSON(res, 200, { ok: true });
        }
      }

      return sendJSON(res, 404, { error: "unknown endpoint" });
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  /* ---- File tĩnh ---- */
  let file = p === "/" ? "index.html" : decodeURIComponent(p.replace(/^\/+/, ""));
  const full = path.join(PUB, file);
  if (!full.startsWith(PUB)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type":"text/html; charset=utf-8" }); return res.end("Không tìm thấy trang."); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

/* ---- Tự áp phương án 2 khi quá 30' chuyển cấp quản lý không phản hồi (mục 3.4) ---- */
setInterval(() => {
  try {
    const now = Date.now();
    for (const t of allTickets()) {
      const e = t.conflictEscalation;
      if (e && e.deadline && new Date(e.deadline).getTime() < now) {
        t.choDenLuot = true; delete t.conflictEscalation;
        t.priHistory = Array.isArray(t.priHistory) ? t.priHistory : [];
        t.priHistory.push({ at: new Date().toISOString(), by: "HỆ THỐNG", option: 2,
          reason: "Quá 30 phút cấp quản lý không phản hồi — tự áp phương án 2 (giữ nguyên thứ tự)",
          ketQua: "Tự động áp phương án 2", name: t.assignee || "" });
        saveTicketRow(t, false);
        console.log("  ⓘ Ticket " + t.id + ": tự áp phương án 2 sau 30' không phản hồi.");
      }
    }
  } catch (e) {}
}, 60000);

/* ============================ KHỞI ĐỘNG ============================ */
migrateFromJson(); seedUsers(); seedTickets();
server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces(); const ips = [];
  for (const name of Object.keys(nets)) for (const ni of nets[name]) if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
  console.log("\n===============================================================");
  console.log("  HỆ THỐNG HỖ TRỢ THNG — máy chủ nội bộ (SQLite) đã chạy");
  console.log("===============================================================");
  console.log("  • Trên máy chủ này, mở:   http://localhost:" + PORT);
  if (ips.length) { console.log("  • Các phòng ban trong mạng nội bộ mở:"); ips.forEach(ip => console.log("        http://" + ip + ":" + PORT)); }
  console.log("  • Tài khoản quản trị mặc định:  admin / admin123  (đổi ngay sau lần đầu)");
  console.log("  • Cơ sở dữ liệu: " + DB_FILE);
  console.log("  • Nhấn Ctrl + C để dừng máy chủ.");
  console.log("===============================================================\n");
});
