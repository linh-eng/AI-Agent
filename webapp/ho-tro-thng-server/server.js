/* =====================================================================
 * Hệ thống Hỗ trợ THNG — Máy chủ nội bộ (LAN) + Đăng nhập & Phân quyền
 * Zero-dependency: chỉ cần cài Node.js, KHÔNG cần "npm install".
 * Chạy:  node server.js   (hoặc start-windows.bat / start.sh)
 * Dữ liệu dùng chung + tài khoản lưu tại:  data.json
 * ===================================================================== */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ROOT = __dirname;
const PUB = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data.json");
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 giờ

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

/* ============================ KHO DỮ LIỆU ============================ */
let DB = { tickets: [], ps: [], users: [], seq: {} };
function loadDB() {
  try { if (fs.existsSync(DATA_FILE)) DB = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { console.error("Lỗi đọc data.json:", e.message); }
  DB.tickets = DB.tickets || []; DB.ps = DB.ps || []; DB.users = DB.users || []; DB.seq = DB.seq || {};
}
let saving = false, saveAgain = false;
function saveDB() {
  if (saving) { saveAgain = true; return; }
  saving = true;
  const tmp = DATA_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(DB, null, 2), (err) => {
    if (err) { console.error("Lỗi ghi:", err.message); saving = false; return; }
    fs.rename(tmp, DATA_FILE, () => { saving = false; if (saveAgain) { saveAgain = false; saveDB(); } });
  });
}
function ymd(d) { return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
function genId(pfx) { const day = new Date(); const k = pfx + ymd(day); DB.seq[k] = (DB.seq[k]||0)+1; return `${pfx}-${ymd(day)}-${String(DB.seq[k]).padStart(4,"0")}`; }

/* ============================ MẬT KHẨU (scrypt) ============================ */
function hashPw(pw, salt) { salt = salt || crypto.randomBytes(16).toString("hex"); const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex"); return { salt, hash }; }
function verifyPw(pw, salt, hash) {
  try { const h = crypto.scryptSync(String(pw), salt, 64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)); }
  catch { return false; }
}
function sanitizeUser(u) { return { username: u.username, name: u.name, role: u.role, dept: u.dept || "" }; }

/* ============================ PHIÊN ĐĂNG NHẬP ============================ */
const sessions = new Map(); // token -> { username, exp }
function newSession(username) { const t = crypto.randomBytes(24).toString("hex"); sessions.set(t, { username, exp: Date.now()+SESSION_MS }); return t; }
function cookies(req) { const o = {}; (req.headers.cookie||"").split(";").forEach(p => { const i = p.indexOf("="); if (i>0) o[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim()); }); return o; }
function currentUser(req) {
  const t = cookies(req).sid; if (!t) return null;
  const s = sessions.get(t); if (!s || s.exp < Date.now()) { sessions.delete(t); return null; }
  return DB.users.find(u => u.username === s.username) || null;
}

/* ============================ DỮ LIỆU MẪU LẦN ĐẦU ============================ */
function seedUsers() {
  if (DB.users.length) return;
  const mk = (username, pw, name, role, dept) => { const { salt, hash } = hashPw(pw); return { username, name, role, dept: dept||"", salt, hash, mustChange: username==="admin" }; };
  DB.users.push(
    mk("admin", "admin123", "Quản trị viên", "admin", "Phòng Hỗ trợ"),
    mk("dieuphoi", "123456", "Trưởng bộ phận Hỗ trợ", "dieuphoi", "Phòng Hỗ trợ"),
    mk("xuly1", "123456", "Trần Văn B", "xuly", "Phòng Hỗ trợ"),
    mk("kinhdoanh", "123456", "Nguyễn Văn A", "yeucau", "P. Kinh doanh"),
    mk("giamdoc", "123456", "Ban Giám đốc", "giamdoc", "Ban Giám đốc"),
  );
  saveDB();
}
function seedTickets() {
  if (DB.tickets.length || DB.ps.length) return;
  const d = new Date("2026-08-03T08:15:00");
  DB.seq["TK"+ymd(d)] = 0; DB.seq["PS"+ymd(d)] = 0;
  const extern = new Set(["Sự cố dịch vụ - gián đoạn vận hành","Bảo trì - bảo dưỡng định kỳ","Sửa chữa - khắc phục hỏng hóc","Giao nhận hàng hóa cho khách hàng","Lắp đặt - nghiệm thu tại điểm khách hàng","Khiếu nại - yêu cầu xử lý của khách hàng"]);
  const loai = "Giao nhận hàng hóa cho khách hàng";
  const id = genId("TK");
  DB.tickets.push({ id, tCreate: d.toISOString(), createdBy: "kinhdoanh", loai, luong: extern.has(loai)?"Hỗ trợ Khách hàng bên ngoài":"Hỗ trợ Nội bộ",
    donvi:"P. Kinh doanh", nguoiYC:"Nguyễn Văn A", sdt:"0901234567", email:"a.nguyen@congty.vn", watchers:"Trưởng P.KD; KT trưởng",
    noidung:"Giao hàng mẫu cho khách hàng ABC theo HĐ 125/HĐKT", soluong:20, dvt:"Thùng", quycach:"Carton 40x30x30cm, hàng dễ vỡ, không xếp chồng",
    diadiemGiao:"Kho A - 12 Nguyễn Huệ, Q.1", diadiemNhan:"Cty ABC - 45 Lê Lợi, Q.3", tGiaoYC:"2026-08-03T10:00",
    uutien:"P2 - Ưu tiên cao", doi:"Đội Giao nhận 1", assignee:"Trần Văn B", phoihop:"Lê Văn E (bốc xếp)",
    tAssign:"2026-08-03T08:25", tStart:"2026-08-03T09:30", tDone:"2026-08-03T16:20", trangthai:"6. Hoàn tất",
    slThucte:19, diadiemThucte:"Cty ABC - 45 Lê Lợi, Q.3", nguoiNhan:"Lê Thị C", nghiemthu:"Hoàn thành một phần",
    dexuat:"Đổi 01 thùng mới giao trong ngày 04/08; phổ biến lại quy tắc bốc xếp", dathuchien:"Đã lập biên bản với khách, nhập lại kho 01 thùng lỗi",
    attach:"BBGN_08.pdf; anh_thung_mop.jpg", csat:4, nhanxet:"Xử lý nhanh, cần cẩn thận khâu bốc xếp", tClose:"2026-08-04T09:00", moLai:0, ghichu:"" });
  DB.ps.push({ id: genId("PS"), ticketId:id, ngay:"2026-08-03", loai:"Sự cố hàng hóa (hư hỏng/thiếu/mất)",
    mota:"01/20 thùng bị móp góc, khách hàng ABC từ chối nhận", nguyennhan:"Xếp chồng quá 3 lớp khi bốc xếp lên xe",
    anhhuong:"Trung bình", chiphiDX:50000, chiphiDuyet:50000, duyet:"Đã duyệt", attach:"BBGN_08.pdf; anh_thung_mop.jpg", nguoiXL:"Trần Văn B" });
  saveDB();
}

/* ============================ LỌC THEO QUYỀN ============================ */
function visibleTickets(user) {
  if (can(user, "viewAll")) return DB.tickets;
  return DB.tickets.filter(t => t.donvi === user.dept || t.nguoiYC === user.name || t.createdBy === user.username);
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
      /* ---- Công khai: đăng nhập ---- */
      if (p === "/api/login" && req.method === "POST") {
        const { username, password } = await readBody(req);
        const u = DB.users.find(x => x.username === String(username||"").trim());
        if (!u || !verifyPw(password, u.salt, u.hash)) return sendJSON(res, 401, { error: "Sai tên đăng nhập hoặc mật khẩu" });
        const token = newSession(u.username);
        return sendJSON(res, 200, { user: sanitizeUser(u), cap: capOf(u.role), roleLabel: ROLES[u.role].label, mustChange: !!u.mustChange },
          { "Set-Cookie": `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MS/1000}` });
      }
      if (p === "/api/logout" && req.method === "POST") {
        const t = cookies(req).sid; if (t) sessions.delete(t);
        return sendJSON(res, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" });
      }

      /* ---- Từ đây cần đăng nhập ---- */
      const me = currentUser(req);
      if (!me) return sendJSON(res, 401, { error: "Chưa đăng nhập" });

      if (p === "/api/me" && req.method === "GET")
        return sendJSON(res, 200, { user: sanitizeUser(me), cap: capOf(me.role), roleLabel: ROLES[me.role].label, mustChange: !!me.mustChange });

      if (p === "/api/change-password" && req.method === "POST") {
        const { oldPassword, newPassword } = await readBody(req);
        if (!verifyPw(oldPassword, me.salt, me.hash)) return sendJSON(res, 400, { error: "Mật khẩu hiện tại không đúng" });
        if (!newPassword || String(newPassword).length < 6) return sendJSON(res, 400, { error: "Mật khẩu mới tối thiểu 6 ký tự" });
        const { salt, hash } = hashPw(newPassword); me.salt = salt; me.hash = hash; me.mustChange = false; saveDB();
        return sendJSON(res, 200, { ok: true });
      }

      if (p === "/api/data" && req.method === "GET")
        return sendJSON(res, 200, { tickets: visibleTickets(me), ps: DB.ps, seq: DB.seq });

      /* ---- Ticket ---- */
      if (p === "/api/tickets" && req.method === "POST") {
        if (!can(me, "create")) return sendJSON(res, 403, { error: "Không có quyền tạo ticket" });
        const t = await readBody(req); t.id = genId("TK"); t.tCreate = new Date().toISOString(); t.createdBy = me.username;
        DB.tickets.unshift(t); saveDB(); return sendJSON(res, 201, t);
      }
      let m;
      if ((m = p.match(/^\/api\/tickets\/(.+)$/))) {
        const id = decodeURIComponent(m[1]); const i = DB.tickets.findIndex(x => x.id === id);
        if (i < 0) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          if (!can(me, "edit")) return sendJSON(res, 403, { error: "Không có quyền sửa ticket" });
          const t = await readBody(req); t.id = id; t.createdBy = DB.tickets[i].createdBy; DB.tickets[i] = t; saveDB(); return sendJSON(res, 200, t);
        }
        if (req.method === "DELETE") {
          if (!can(me, "del")) return sendJSON(res, 403, { error: "Không có quyền xóa ticket" });
          DB.tickets.splice(i, 1); saveDB(); return sendJSON(res, 200, { ok: true });
        }
      }

      /* ---- Phát sinh ---- */
      if (p === "/api/ps" && req.method === "POST") {
        if (!can(me, "ps")) return sendJSON(res, 403, { error: "Không có quyền ghi phát sinh" });
        const x = await readBody(req); x.id = genId("PS"); DB.ps.unshift(x); saveDB(); return sendJSON(res, 201, x);
      }
      if ((m = p.match(/^\/api\/ps\/(.+)$/))) {
        const id = decodeURIComponent(m[1]); const i = DB.ps.findIndex(x => x.id === id);
        if (i < 0) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          if (!can(me, "approve")) return sendJSON(res, 403, { error: "Không có quyền phê duyệt/sửa phát sinh" });
          const x = await readBody(req); x.id = id; DB.ps[i] = x; saveDB(); return sendJSON(res, 200, x);
        }
        if (req.method === "DELETE") {
          if (!can(me, "del")) return sendJSON(res, 403, { error: "Không có quyền xóa" });
          DB.ps.splice(i, 1); saveDB(); return sendJSON(res, 200, { ok: true });
        }
      }

      /* ---- Người dùng (chỉ admin) ---- */
      if (p === "/api/users") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        if (req.method === "GET") return sendJSON(res, 200, DB.users.map(sanitizeUser));
        if (req.method === "POST") {
          const b = await readBody(req); const un = String(b.username||"").trim();
          if (!un || !b.password) return sendJSON(res, 400, { error: "Thiếu tên đăng nhập hoặc mật khẩu" });
          if (DB.users.some(u => u.username === un)) return sendJSON(res, 400, { error: "Tên đăng nhập đã tồn tại" });
          if (!ROLES[b.role]) return sendJSON(res, 400, { error: "Vai trò không hợp lệ" });
          const { salt, hash } = hashPw(b.password);
          DB.users.push({ username: un, name: b.name||un, role: b.role, dept: b.dept||"", salt, hash });
          saveDB(); return sendJSON(res, 201, { ok: true });
        }
      }
      if ((m = p.match(/^\/api\/users\/(.+)$/))) {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        const un = decodeURIComponent(m[1]); const i = DB.users.findIndex(u => u.username === un);
        if (i < 0) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          const b = await readBody(req); const u = DB.users[i];
          if (b.name != null) u.name = b.name;
          if (b.role && ROLES[b.role]) u.role = b.role;
          if (b.dept != null) u.dept = b.dept;
          if (b.password) { const { salt, hash } = hashPw(b.password); u.salt = salt; u.hash = hash; u.mustChange = false; }
          saveDB(); return sendJSON(res, 200, { ok: true });
        }
        if (req.method === "DELETE") {
          if (un === me.username) return sendJSON(res, 400, { error: "Không thể tự xóa tài khoản đang dùng" });
          if (DB.users[i].role === "admin" && DB.users.filter(u => u.role === "admin").length <= 1) return sendJSON(res, 400, { error: "Phải còn ít nhất 1 quản trị viên" });
          DB.users.splice(i, 1); saveDB(); return sendJSON(res, 200, { ok: true });
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

/* ============================ KHỞI ĐỘNG ============================ */
loadDB(); seedUsers(); seedTickets();
server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces(); const ips = [];
  for (const name of Object.keys(nets)) for (const ni of nets[name]) if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
  console.log("\n===============================================================");
  console.log("  HỆ THỐNG HỖ TRỢ THNG — máy chủ nội bộ (có đăng nhập) đã chạy");
  console.log("===============================================================");
  console.log("  • Trên máy chủ này, mở:   http://localhost:" + PORT);
  if (ips.length) { console.log("  • Các phòng ban trong mạng nội bộ mở:"); ips.forEach(ip => console.log("        http://" + ip + ":" + PORT)); }
  console.log("  • Tài khoản quản trị mặc định:  admin / admin123  (đổi ngay sau lần đầu)");
  console.log("  • Dữ liệu + tài khoản lưu tại: " + DATA_FILE);
  console.log("  • Nhấn Ctrl + C để dừng máy chủ.");
  console.log("===============================================================\n");
});
