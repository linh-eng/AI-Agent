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

const APP_VERSION = "v3.9.3"; // đổi mỗi lần cập nhật để dễ kiểm tra bản đang chạy
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
// Các trường theo dõi trong nhật ký thay đổi (audit log)
const AUDIT_FIELDS = [["uutien","Ưu tiên"],["assignee","Người thực hiện"],["doi","Đội hỗ trợ"],["donvi","Đơn vị yêu cầu"],
  ["nguoiYC","Người yêu cầu"],["loai","Loại công việc"],["luong","Luồng"],["noidung","Nội dung"],["tGiaoYC","Thời hạn mong muốn"],
  ["soluong","Số lượng"],["slThucte","SL thực tế"],["nghiemthu","Kết quả nghiệm thu"],["csat","CSAT"],["nhanxet","Nhận xét"]];
function diffAudit(cur, next) {
  const changes = [];
  for (const [f, label] of AUDIT_FIELDS) {
    const a = cur[f], b = next[f];
    if (typeof b === "object") continue;
    if (String(a==null?"":a) !== String(b==null?"":b)) changes.push({ field: label, from: a==null?"":String(a), to: b==null?"":String(b) });
  }
  return changes;
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
// Bổ sung cột hồ sơ người dùng (5C) — an toàn nếu đã tồn tại
for (const col of ["chucdanh TEXT DEFAULT ''","sdt TEXT DEFAULT ''","email TEXT DEFAULT ''","trangthai TEXT DEFAULT 'active'","canProxy INTEGER DEFAULT 0"]) {
  try { db.exec("ALTER TABLE users ADD COLUMN " + col); } catch (e) {}
}
db.exec("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)");
const qSetGet = db.prepare("SELECT v FROM settings WHERE k = ?");
const qSetSet = db.prepare("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v");
// Đính kèm file thật (3f): metadata trong DB, nội dung file lưu trên đĩa (uploads/)
db.exec("CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, ticketId TEXT, name TEXT, mime TEXT, size INTEGER, uploadedBy TEXT, at TEXT)");
db.exec("CREATE INDEX IF NOT EXISTS ix_files_ticketId ON files(ticketId)");
const UPLOAD_DIR = path.join(ROOT, "uploads");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) {}
const Q_FILES = {
  byTicket: db.prepare("SELECT id,ticketId,name,mime,size,uploadedBy,at FROM files WHERE ticketId=? ORDER BY rowid"),
  one:      db.prepare("SELECT * FROM files WHERE id=?"),
  ins:      db.prepare("INSERT INTO files(id,ticketId,name,mime,size,uploadedBy,at) VALUES(?,?,?,?,?,?,?)"),
  del:      db.prepare("DELETE FROM files WHERE id=?"),
};
const ALLOWED_UPLOAD = /\.(jpe?g|png|gif|webp|bmp|pdf|docx?|xlsx?|txt|csv|pptx?|zip|heic)$/i;

// Lịch sử truy cập (đăng nhập) — module Lịch sử truy cập
db.exec("CREATE TABLE IF NOT EXISTS loginlog (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, name TEXT, at TEXT, ip TEXT, ua TEXT, ok INTEGER)");
db.exec("CREATE INDEX IF NOT EXISTS ix_loginlog_user ON loginlog(username)");
const Q_LOGIN = {
  ins:    db.prepare("INSERT INTO loginlog(username,name,at,ip,ua,ok) VALUES(?,?,?,?,?,?)"),
  recent: db.prepare("SELECT username,name,at,ip,ua,ok FROM loginlog ORDER BY id DESC LIMIT ?"),
  byUser: db.prepare("SELECT username,name,at,ip,ua,ok FROM loginlog WHERE username=? ORDER BY id DESC LIMIT ?"),
  lastOk: db.prepare("SELECT at FROM loginlog WHERE username=? AND ok=1 ORDER BY id DESC LIMIT 1"),
  prune:  db.prepare("DELETE FROM loginlog WHERE id NOT IN (SELECT id FROM loginlog ORDER BY id DESC LIMIT 5000)"),
};
function clientIP(req){ return String(req.headers["x-forwarded-for"]||"").split(",")[0].trim() || (req.socket&&req.socket.remoteAddress) || ""; }
function logLogin(username, name, req, ok){ try{ Q_LOGIN.ins.run(username||"", name||"", new Date().toISOString(), clientIP(req), String(req.headers["user-agent"]||"").slice(0,180), ok?1:0); if(Math.random()<0.02) Q_LOGIN.prune.run(); }catch(e){} }

// Thông báo trong ứng dụng — module Thông báo
db.exec("CREATE TABLE IF NOT EXISTS notifs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, at TEXT, type TEXT, text TEXT, ticketId TEXT, seen INTEGER DEFAULT 0)");
db.exec("CREATE INDEX IF NOT EXISTS ix_notifs_user ON notifs(username,seen)");
const Q_NOTIF = {
  ins:     db.prepare("INSERT INTO notifs(username,at,type,text,ticketId,seen) VALUES(?,?,?,?,?,0)"),
  recent:  db.prepare("SELECT id,at,type,text,ticketId,seen FROM notifs WHERE username=? ORDER BY id DESC LIMIT 40"),
  unseen:  db.prepare("SELECT COUNT(*) c FROM notifs WHERE username=? AND seen=0"),
  seenAll: db.prepare("UPDATE notifs SET seen=1 WHERE username=? AND seen=0"),
  seenOne: db.prepare("UPDATE notifs SET seen=1 WHERE username=? AND id=?"),
  prune:   db.prepare("DELETE FROM notifs WHERE id NOT IN (SELECT id FROM notifs ORDER BY id DESC LIMIT 4000)"),
};
function pushNotif(username, type, text, ticketId){ if(!username) return; try{ Q_NOTIF.ins.run(username, new Date().toISOString(), type||"", String(text||""), String(ticketId||"")); }catch(e){} }
// Ánh xạ tên người thực hiện -> username (tài khoản đang hoạt động)
function userByName(name){ name=String(name||"").trim(); if(!name) return null; return S.users.all().find(u=>String(u.name||"").trim()===name && (u.trangthai||"active")==="active") || null; }
// Danh sách username có quyền tiếp nhận / duyệt (điều phối + quản trị)
function dispatcherUsernames(){ return S.users.all().filter(u=>ROLES[u.role]&&(ROLES[u.role].approve) && (u.trangthai||"active")==="active").map(u=>u.username); }

// Sao lưu tự động — module Sao lưu
const BACKUP_DIR = path.join(ROOT, "backups");
try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}
let lastBackupAt = 0;
function pad2(n){ return String(n).padStart(2,"0"); }
function stampNow(){ const d=new Date(); return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; }
function listBackups(){ try{ return fs.readdirSync(BACKUP_DIR).filter(n=>n.startsWith("backup-")).map(n=>{ const p=path.join(BACKUP_DIR,n); let size=0; try{ const st=fs.statSync(path.join(p,"data.db")); size=st.size; }catch(e){} return { name:n, at:n.replace("backup-",""), size }; }).sort((a,b)=>b.name.localeCompare(a.name)); }catch(e){ return []; } }
function runBackup(reason){
  try{
    try{ db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); }catch(e){}          // gộp WAL vào data.db để bản sao đầy đủ
    const dir = path.join(BACKUP_DIR, "backup-" + stampNow());
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(DB_FILE, path.join(dir, "data.db"));
    if (fs.existsSync(UPLOAD_DIR)) { try{ fs.cpSync(UPLOAD_DIR, path.join(dir, "uploads"), { recursive: true }); }catch(e){} }
    fs.writeFileSync(path.join(dir, "info.txt"), "Sao lưu lúc " + new Date().toLocaleString("vi-VN") + " (" + (reason||"tự động") + ")\n");
    lastBackupAt = Date.now();
    // dọn bản cũ, giữ N bản gần nhất
    const keep = Math.max(1, +getConfig().backup.keep || 7);
    const all = listBackups();
    all.slice(keep).forEach(b => { try{ fs.rmSync(path.join(BACKUP_DIR, b.name), { recursive:true, force:true }); }catch(e){} });
    return { ok:true, name: path.basename(dir) };
  }catch(e){ return { ok:false, error:e.message }; }
}

/* ---- SLA theo giờ làm việc (bản máy chủ — để cảnh báo trễ hạn) ---- */
function segOverlapMs(dayStart, end, h1, h2){ const a=new Date(dayStart); a.setHours(h1,0,0,0); const b=new Date(dayStart); b.setHours(h2,0,0,0); const lo=Math.max(dayStart.getTime(),a.getTime()), hi=Math.min(end.getTime(),b.getTime()); return hi>lo?(hi-lo)/60000:0; }
function workHoursSrv(start, end){ if(!start||!end) return 0; const w=getConfig().work||{mStart:8,mEnd:12,aStart:13,aEnd:17,sat:false}; let s=new Date(start), e=new Date(end); if(e<=s) return 0; let mins=0, cur=new Date(s), guard=0;
  while(cur<e && guard++<200000){ const day=cur.getDay(); if((day>=1&&day<=5)||(day===6&&w.sat)){ mins+=segOverlapMs(cur,e,w.mStart,w.mEnd); mins+=segOverlapMs(cur,e,w.aStart,w.aEnd); } cur.setDate(cur.getDate()+1); cur.setHours(0,0,0,0); }
  return mins/60; }
function isRunningSrv(s){ return ["Đã tiếp nhận","Đang xử lý","Mở lại"].includes(baseStatus(s)); }
function slaUsedSrv(t){ const hist=Array.isArray(t.history)?t.history:null; const endTime=new Date().toISOString();
  if(hist&&hist.length){ let used=0; for(let i=0;i<hist.length;i++){ const from=hist[i].at, to=(i+1<hist.length?hist[i+1].at:endTime); if(isRunningSrv(hist[i].to)) used+=workHoursSrv(from,to); } return used; }
  return workHoursSrv(t.tStart||t.tAssign||t.tCreate, endTime); }
function slaProcHours(uutien){ const sla=getConfig().sla||{}; const arr=sla[uutien]; return arr?arr[1]:8; }
// Giai đoạn B — SLA nghiệm thu (giờ làm việc) theo nhóm loại việc
function wtGroupSrv(loai){ const wts=getConfig().worktypes||[]; const w=wts.find(x=>x[1]===loai); return w?(w[4]||""):""; }
function acceptSlaHours(t){ const cfg=getConfig().acceptSla||{}; const g=wtGroupSrv(t.loai)||"default"; const h=(cfg[g]!=null?cfg[g]:cfg.default); return +h||1; }
function acceptUsedSrv(t){ return t.tSubmit ? workHoursSrv(t.tSubmit, new Date().toISOString()) : 0; }
const DEFAULT_WORKTYPES = [
  ["KT01","Xử lý sự cố / lỗi sản phẩm","Hỗ trợ kỹ thuật","P2 - Ưu tiên cao","kt"],
  ["KT02","Hỗ trợ cài đặt, cấu hình","Hỗ trợ kỹ thuật","P3 - Ưu tiên trung bình","kt"],
  ["KT03","Hỗ trợ tư vấn kỹ thuật cho khách hàng","Hỗ trợ khách hàng","P3 - Ưu tiên trung bình","kt"],
  ["KT04","Hỗ trợ kiểm thử (testing)","Hỗ trợ nội bộ","P3 - Ưu tiên trung bình","kt"],
  ["TK01","Hỗ trợ triển khai tại khách hàng","Triển khai dự án","P2 - Ưu tiên cao","tk"],
  ["TK02","Chuẩn bị thiết bị / vật tư cho dự án","Triển khai dự án","P3 - Ưu tiên trung bình","tk"],
  ["TK03","Hỗ trợ nghiệm thu, bàn giao dự án","Triển khai dự án","P2 - Ưu tiên cao","tk"],
  ["TK04","Khảo sát hiện trạng tại khách hàng","Triển khai dự án","P3 - Ưu tiên trung bình","tk"],
  ["BH01","Tiếp nhận bảo hành, đổi trả thiết bị","Bảo hành","P2 - Ưu tiên cao","bh"],
  ["BH02","Sửa chữa, thay thế linh kiện","Bảo hành","P2 - Ưu tiên cao","bh"],
  ["BH03","Bảo trì định kỳ","Bảo hành","P4 - Thấp","bh"],
  ["GN01","Giao nhận hàng hóa cho khách hàng","Hỗ trợ khách hàng bên ngoài","P2 - Ưu tiên cao","gn"],
  ["GN02","Vận chuyển nội bộ giữa các kho/chi nhánh","Hỗ trợ nội bộ","P3 - Ưu tiên trung bình","gn"],
  ["GN03","Nhận hàng từ nhà cung cấp","Hỗ trợ nội bộ","P3 - Ưu tiên trung bình","gn"],
  ["HC01","Hỗ trợ chứng từ, hồ sơ thầu","Hỗ trợ nội bộ","P3 - Ưu tiên trung bình","hc"],
  ["HC02","Hỗ trợ hồ sơ thanh toán, đối chiếu công nợ","Hỗ trợ nội bộ","P3 - Ưu tiên trung bình","hc"],
  ["HC03","Hỗ trợ chuẩn bị họp, sự kiện","Hỗ trợ nội bộ","P4 - Thấp","hc"],
  ["KH99","Khác (ghi rõ)","","P3 - Ưu tiên trung bình","khac"],
];
const DEFAULT_CONFIG = {
  sla: { "P1 - Khẩn cấp":[15,2], "P2 - Ưu tiên cao":[30,4], "P3 - Ưu tiên trung bình":[60,8], "P4 - Thấp":[120,24] },
  work: { mStart:8, mEnd:12, aStart:13, aEnd:17, sat:false }, // sat=true nếu làm Thứ 7
  warn: 0.8, overload: 3, maxUpload: 10, // maxUpload: dung lượng tối đa mỗi file (MB)
  backup: { enabled:true, everyHours:24, keep:7 }, // sao lưu tự động
  company: { // thông tin công ty & logo — dùng làm header/footer biểu mẫu in
    name: "CÔNG TY THÁI NGUYỄN (THNG)",
    dept: "BỘ PHẬN HỖ TRỢ & TRIỂN KHAI",
    address: "", phone: "", email: "", taxCode: "", website: "",
    logo: "", // ảnh logo dạng data URI (base64)
    footer: "" // ghi chú chân trang biểu mẫu
  },
  accept: { // bộ hạng mục nghiệm thu theo nhóm loại công việc (Giai đoạn A) — mỗi nhóm 1 mảng hạng mục, tổng trọng số nên = 100
    default: [
      { key:"thuchien", ten:"Chất lượng thực hiện", trongSo:40 },
      { key:"baocao",   ten:"Báo cáo kết quả",       trongSo:20 },
      { key:"hinhanh",  ten:"Hình ảnh",              trongSo:20 },
      { key:"chungtu",  ten:"Chứng từ",              trongSo:20 }
    ]
  },
  acceptSla: { default: 1 }, // Giai đoạn B — SLA nghiệm thu (giờ làm việc) theo nhóm loại việc
  score: { // Giai đoạn D — công thức điểm theo hạng mục (thay điểm cũ)
    lanFactor: [100, 80, 60, 40], // % điểm còn lại theo lần đạt (1,2,3,4+)
    mucDoLoi: { nhe:20, tb:40, nang:60, lamlai:100 }, // % điểm hạng mục bị trừ khi phải tạo ticket khắc phục
    slaPhat: 10 // điểm trừ trên tổng nếu trễ SLA xử lý
  },
  quality: { csat:40, sla:25, sl:15, ps:10, reopen:10 },
  cat: {
    donvi: ["Phòng Hành chính","Phòng Kế toán","Phòng Kinh doanh","Phòng Mua hàng","Phòng Triển khai","Phòng Testing","Phòng Bảo hành","Phòng Tư vấn kỹ thuật","Ban Giám đốc","Trợ lý Giám đốc"],
    doi: ["Đội Kỹ thuật","Đội Triển khai","Đội Bảo hành","Đội Giao nhận","Đội Hành chính","Đội trực khẩn cấp"],
    dvt: ["Thùng","Kiện","Bao","Cái","Bộ","Hộp","Tập","Kg","Chuyến","Lần","Người","Khác"],
    loaiPS: ["Chi phí phát sinh","Sự cố hàng hóa (hư hỏng/thiếu/mất)","Sai lệch chứng từ","Chậm trễ tiến độ","Thiếu nhân sự - phương tiện","Thay đổi yêu cầu từ NSD","Vượt phạm vi hỗ trợ","Khác"],
    nghiemthu: ["Đạt - nghiệm thu đủ","Đạt - có điều chỉnh","Không đạt - phải làm lại","Hoàn thành một phần","Hủy yêu cầu"]
  },
  worktypes: DEFAULT_WORKTYPES
};
function getConfig() {
  const r = qSetGet.get("config"); const c = r ? JSON.parse(r.v) : {};
  return { ...DEFAULT_CONFIG, ...c,
    cat: { ...DEFAULT_CONFIG.cat, ...(c.cat||{}) },
    backup: { ...DEFAULT_CONFIG.backup, ...(c.backup||{}) },
    company: { ...DEFAULT_CONFIG.company, ...(c.company||{}) },
    accept: (c.accept && typeof c.accept === "object") ? { ...DEFAULT_CONFIG.accept, ...c.accept } : DEFAULT_CONFIG.accept,
    acceptSla: (c.acceptSla && typeof c.acceptSla === "object") ? { ...DEFAULT_CONFIG.acceptSla, ...c.acceptSla } : DEFAULT_CONFIG.acceptSla,
    score: c.score ? { ...DEFAULT_CONFIG.score, ...c.score,
      mucDoLoi: { ...DEFAULT_CONFIG.score.mucDoLoi, ...(c.score.mucDoLoi||{}) },
      lanFactor: (Array.isArray(c.score.lanFactor) && c.score.lanFactor.length) ? c.score.lanFactor : DEFAULT_CONFIG.score.lanFactor } : DEFAULT_CONFIG.score,
    worktypes: (Array.isArray(c.worktypes) && c.worktypes.length) ? c.worktypes : DEFAULT_CONFIG.worktypes };
}
// Danh mục Dự án (5H) — lưu trong settings, dùng chung mọi ticket
function getProjects() { const r = qSetGet.get("projects"); return r ? JSON.parse(r.v) : []; }
function setProjects(arr) { qSetSet.run("projects", JSON.stringify(Array.isArray(arr) ? arr : [])); }
function seedConfig() { if (!qSetGet.get("config")) qSetSet.run("config", JSON.stringify(DEFAULT_CONFIG)); }

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
  userIns:    db.prepare("INSERT INTO users(username,name,role,dept,salt,hash,mustChange,chucdanh,sdt,email,trangthai,canProxy) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"),
  userUpd:    db.prepare("UPDATE users SET name=?,role=?,dept=?,salt=?,hash=?,mustChange=?,chucdanh=?,sdt=?,email=?,trangthai=?,canProxy=? WHERE username=?"),
  userProfile:db.prepare("UPDATE users SET sdt=?,email=? WHERE username=?"),
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
// Người theo dõi (watchers) là chuỗi tự do "Tên A; Tên B" — khớp theo tên
function watchersHas(u, watchers) { const nm = String(u.name||"").trim().toLowerCase(); if (!nm) return false;
  return String(watchers||"").toLowerCase().split(/[;,\n]/).some(x => x.trim() === nm); }
// Quy tắc nhìn thấy 1 ticket (có xét công việc riêng tư)
function ticketVisible(u, t) {
  if (t.riengTu) { // riêng tư: chỉ Người tạo · Người được yêu cầu · Người theo dõi · Quản trị
    return u.role === "admin"
      || t.createdBy === u.username
      || (t.nguoiDuocYC && t.nguoiDuocYC === u.username)
      || (t.nguoiYC && String(t.nguoiYC).trim() === String(u.name||"").trim())
      || watchersHas(u, t.watchers);
  }
  if (can(u, "viewAll")) return true;
  return t.donvi === (u.dept||"") || t.nguoiYC === (u.name||"") || t.createdBy === (u.username||"");
}
function ticketsForUser(u) { return allTickets().filter(t => ticketVisible(u, t)); }
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
function sanitizeUser(u) { return { username: u.username, name: u.name, role: u.role, dept: u.dept || "", chucdanh: u.chucdanh||"", sdt: u.sdt||"", email: u.email||"", trangthai: u.trangthai||"active", canProxy: !!u.canProxy }; }

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
  const mk = (username, pw, name, role, dept, chucdanh, sdt, email, canProxy) => { const { salt, hash } = hashPw(pw); S.userIns.run(username, name, role, dept||"", salt, hash, 1, chucdanh||"", sdt||"", email||"", "active", canProxy?1:0); };
  mk("admin", "admin123", "Quản trị viên", "admin", "Phòng Hỗ trợ", "Quản trị hệ thống", "0900000001", "admin@thng.vn", 1);
  mk("dieuphoi", "123456", "Trưởng bộ phận Hỗ trợ", "dieuphoi", "Phòng Hỗ trợ", "Trưởng bộ phận", "0900000002", "dieuphoi@thng.vn", 1);
  mk("xuly1", "123456", "Trần Văn B", "xuly", "Phòng Hỗ trợ", "Nhân viên", "0900000003", "tvb@thng.vn", 0);
  mk("kinhdoanh", "123456", "Nguyễn Văn A", "yeucau", "Phòng Kinh doanh", "Nhân viên", "0901234567", "a.nguyen@thng.vn", 0);
  mk("giamdoc", "123456", "Ban Giám đốc", "giamdoc", "Ban Giám đốc", "Giám đốc", "0900000009", "gd@thng.vn", 0);
  mk("troly", "123456", "Trợ lý Giám đốc", "yeucau", "Trợ lý Giám đốc", "Trợ lý", "0900000010", "troly@thng.vn", 1);
}
function seedTickets() {
  if (S.cntTickets.get().c > 0) return;
  const d = new Date("2026-08-03T08:15:00");
  qSeqSet.run("TK"+ymd(d), 0); qSeqSet.run("PS"+ymd(d), 0);
  const extern = new Set(["Sự cố dịch vụ - gián đoạn vận hành","Bảo trì - bảo dưỡng định kỳ","Sửa chữa - khắc phục hỏng hóc","Giao nhận hàng hóa cho khách hàng","Lắp đặt - nghiệm thu tại điểm khách hàng","Khiếu nại - yêu cầu xử lý của khách hàng"]);
  const loai = "Giao nhận hàng hóa cho khách hàng";
  const id = genId("TK", d);
  const t = { id, tCreate: d.toISOString(), createdBy: "kinhdoanh", loai, luong: extern.has(loai)?"Hỗ trợ Khách hàng bên ngoài":"Hỗ trợ Nội bộ",
    donvi:"Phòng Kinh doanh", nguoiYC:"Nguyễn Văn A", sdt:"0901234567", email:"a.nguyen@congty.vn", watchers:"Trưởng P.KD; KT trưởng",
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
// Gom nguyên byte rồi mới giải mã UTF-8 MỘT LẦN — tránh vỡ ký tự nhiều byte (vd "Đ") khi bị cắt giữa 2 gói dữ liệu (body lớn)
function readBody(req, max) { const cap = max || 5e6; return new Promise(r => { const chunks=[]; let len=0; req.on("data", c => { chunks.push(c); len += c.length; if (len>cap) req.destroy(); }); req.on("end", () => { try { const s = Buffer.concat(chunks).toString("utf8"); r(s ? JSON.parse(s) : {}); } catch { r({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/version" && req.method === "GET")
        return sendJSON(res, 200, { version: APP_VERSION, modules: ["notifs", "loginlog", "backup"] });
      if (p === "/api/login" && req.method === "POST") {
        const { username, password } = await readBody(req);
        const un = String(username||"").trim();
        const u = S.user.get(un);
        if (!u || !verifyPw(password, u.salt, u.hash)) { logLogin(un, u?u.name:"", req, false); return sendJSON(res, 401, { error: "Sai tên đăng nhập hoặc mật khẩu" }); }
        if ((u.trangthai||"active") !== "active") { logLogin(un, u.name, req, false); return sendJSON(res, 403, { error: "Tài khoản đã ngưng hoạt động. Liên hệ Quản trị." }); }
        logLogin(u.username, u.name, req, true);
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

      let m;
      if (p === "/api/me" && req.method === "GET")
        return sendJSON(res, 200, { user: sanitizeUser(me), cap: capOf(me.role), roleLabel: ROLES[me.role].label, mustChange: !!me.mustChange });

      if (p === "/api/change-password" && req.method === "POST") {
        const { oldPassword, newPassword } = await readBody(req);
        if (!verifyPw(oldPassword, me.salt, me.hash)) return sendJSON(res, 400, { error: "Mật khẩu hiện tại không đúng" });
        if (!validPw(newPassword)) return sendJSON(res, 400, { error: PW_MSG });
        const { salt, hash } = hashPw(newPassword);
        S.userUpd.run(me.name, me.role, me.dept||"", salt, hash, 0, me.chucdanh||"", me.sdt||"", me.email||"", me.trangthai||"active", me.canProxy?1:0, me.username);
        return sendJSON(res, 200, { ok: true });
      }

      // Người dùng tự cập nhật SĐT & Email của mình (5C - Thông tin cá nhân)
      if (p === "/api/profile" && req.method === "POST") {
        const b = await readBody(req);
        S.userProfile.run(String(b.sdt||"").trim(), String(b.email||"").trim(), me.username);
        return sendJSON(res, 200, { ok: true });
      }

      // Danh bạ nhân sự — cho mọi tài khoản có quyền tạo phiếu (dùng cho "tạo thay" & chọn "người được yêu cầu")
      if (p === "/api/people" && req.method === "GET") {
        if (!can(me, "create")) return sendJSON(res, 403, { error: "Cần quyền tạo phiếu" });
        return sendJSON(res, 200, S.users.all().filter(u => (u.trangthai||"active")==="active").map(sanitizeUser));
      }

      if (p === "/api/config" && req.method === "GET")
        return sendJSON(res, 200, getConfig());
      if (p === "/api/config" && req.method === "PUT") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        const b = await readBody(req, 8e6); qSetSet.run("config", JSON.stringify(b)); return sendJSON(res, 200, { ok: true });
      }

      /* ---- Danh mục Dự án (5H) ---- */
      if (p === "/api/projects" && req.method === "GET")
        return sendJSON(res, 200, getProjects());
      if (p === "/api/projects" && req.method === "PUT") {
        if (!can(me, "edit")) return sendJSON(res, 403, { error: "Không có quyền quản lý danh mục dự án" });
        const b = await readBody(req);
        setProjects((Array.isArray(b) ? b : (b.projects || [])).filter(x => x && (x.ma || x.ten)));
        return sendJSON(res, 200, { ok: true, projects: getProjects() });
      }

      /* ---- Đính kèm file thật (3f) ---- */
      if (p === "/api/files" && req.method === "GET") {
        const tid = url.searchParams.get("ticketId") || "";
        return sendJSON(res, 200, Q_FILES.byTicket.all(tid));
      }
      if (p === "/api/upload" && req.method === "POST") {
        if (!can(me, "edit") && !can(me, "create")) return sendJSON(res, 403, { error: "Không có quyền đính kèm" });
        const maxMB = +getConfig().maxUpload || 10;
        const b = await readBody(req, Math.ceil(maxMB * 1024 * 1024 * 1.4) + 200000);
        const name = String(b.name || "").trim();
        if (!name || !b.dataB64) return sendJSON(res, 400, { error: "Thiếu tên file hoặc nội dung" });
        if (!ALLOWED_UPLOAD.test(name)) return sendJSON(res, 400, { error: "Định dạng file không được phép" });
        let buf; try { buf = Buffer.from(String(b.dataB64), "base64"); } catch { return sendJSON(res, 400, { error: "Nội dung file không hợp lệ" }); }
        if (buf.length > maxMB * 1024 * 1024) return sendJSON(res, 400, { error: `File vượt giới hạn ${maxMB} MB` });
        const id = crypto.randomBytes(12).toString("hex");
        fs.writeFileSync(path.join(UPLOAD_DIR, id), buf);
        const rec = { id, ticketId: String(b.ticketId || ""), name, mime: String(b.mime || "application/octet-stream"), size: buf.length, uploadedBy: me.username, at: new Date().toISOString() };
        Q_FILES.ins.run(rec.id, rec.ticketId, rec.name, rec.mime, rec.size, rec.uploadedBy, rec.at);
        return sendJSON(res, 201, rec);
      }
      if ((m = p.match(/^\/api\/file\/([a-f0-9]+)$/))) {
        const rec = Q_FILES.one.get(m[1]);
        if (!rec) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "DELETE") {
          if (!can(me, "edit")) return sendJSON(res, 403, { error: "Không có quyền xóa file" });
          try { fs.unlinkSync(path.join(UPLOAD_DIR, rec.id)); } catch (e) {}
          Q_FILES.del.run(rec.id); return sendJSON(res, 200, { ok: true });
        }
        if (req.method === "GET") {
          const fp = path.join(UPLOAD_DIR, rec.id);
          if (!fs.existsSync(fp)) return sendJSON(res, 404, { error: "file missing" });
          const dl = url.searchParams.get("dl");
          const disp = (dl ? "attachment" : "inline") + `; filename*=UTF-8''` + encodeURIComponent(rec.name);
          res.writeHead(200, { "Content-Type": rec.mime || "application/octet-stream", "Content-Disposition": disp, "Content-Length": rec.size, "Cache-Control": "private, max-age=3600" });
          return fs.createReadStream(fp).pipe(res);
        }
      }

      /* ---- Thông báo trong ứng dụng ---- */
      if (p === "/api/notifs" && req.method === "GET")
        return sendJSON(res, 200, { list: Q_NOTIF.recent.all(me.username), unseen: Q_NOTIF.unseen.get(me.username).c });
      if (p === "/api/notifs/seen" && req.method === "POST") {
        const b = await readBody(req);
        if (b && b.id) Q_NOTIF.seenOne.run(me.username, +b.id); else Q_NOTIF.seenAll.run(me.username);
        if (Math.random() < 0.05) Q_NOTIF.prune.run();
        return sendJSON(res, 200, { ok: true, unseen: Q_NOTIF.unseen.get(me.username).c });
      }

      /* ---- Lịch sử truy cập (admin) ---- */
      if (p === "/api/loginlog" && req.method === "GET") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        const un = url.searchParams.get("username");
        const lim = Math.min(500, +url.searchParams.get("limit") || 200);
        return sendJSON(res, 200, un ? Q_LOGIN.byUser.all(un, lim) : Q_LOGIN.recent.all(lim));
      }

      /* ---- Sao lưu (admin) ---- */
      if (p === "/api/backups" && req.method === "GET") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        return sendJSON(res, 200, { list: listBackups(), lastBackupAt });
      }
      if (p === "/api/backup" && req.method === "POST") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        const r = runBackup("thủ công"); return sendJSON(res, r.ok ? 200 : 500, r.ok ? { ok: true, name: r.name, list: listBackups() } : { error: r.error });
      }
      if (p === "/api/backup/download" && req.method === "GET") {
        if (!can(me, "users")) return sendJSON(res, 403, { error: "Chỉ quản trị viên" });
        try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch (e) {}
        const fn = "data-" + stampNow() + ".db";
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${fn}"`, "Cache-Control": "no-store" });
        return fs.createReadStream(DB_FILE).pipe(res);
      }

      if (p === "/api/data" && req.method === "GET")
        return sendJSON(res, 200, { tickets: ticketsForUser(me), ps: allPS(), seq: {} });

      /* ---- Ticket ---- */
      if (p === "/api/tickets" && req.method === "POST") {
        if (!can(me, "create")) return sendJSON(res, 403, { error: "Không có quyền tạo ticket" });
        const t = await readBody(req); t.tCreate = new Date().toISOString(); t.createdBy = me.username;
        // Giai đoạn C — Ticket khắc phục con: mã = <mã gốc>-01, -02… truy về ticket gốc
        if (t.parentId) {
          const parent = getTicket(t.parentId);
          if (parent) { const kids = allTickets().filter(x => x.parentId === t.parentId); t.id = t.parentId + "-" + String(kids.length + 1).padStart(2,"0"); t.laKhacPhuc = true; }
          else { t.parentId = ""; t.id = genId("TK"); }
        } else { t.id = genId("TK"); }
        t.trangthai = "Tạo mới"; t.uutienDeXuat = t.uutien || ""; t.moLai = +t.moLai || 0;
        t.history = [{ at: t.tCreate, from: "", to: "Tạo mới", by: me.username, note: t.parentId ? ("Tạo ticket khắc phục từ " + t.parentId) : "Tạo phiếu yêu cầu" }];
        delete t._reason;
        saveTicketRow(t, true);
        // Thông báo: ticket mới cần tiếp nhận -> điều phối/quản trị
        dispatcherUsernames().forEach(un => { if (un !== me.username) pushNotif(un, "new", `${t.parentId?"Ticket khắc phục":"Ticket"} mới cần tiếp nhận: ${t.id} · ${t.donvi||""}`, t.id); });
        return sendJSON(res, 201, t);
      }
      if ((m = p.match(/^\/api\/tickets\/(.+)$/))) {
        const id = decodeURIComponent(m[1]); const cur = getTicket(id);
        if (!cur) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") {
          // Người yêu cầu được sửa & gửi lại chính ticket của mình khi bị "Trả lại bổ sung"
          const ownerResubmit = can(me, "create") && cur.createdBy === me.username && baseStatus(cur.trangthai) === "Trả lại bổ sung";
          if (!can(me, "edit") && !ownerResubmit) return sendJSON(res, 403, { error: "Không có quyền sửa ticket" });
          const t = await readBody(req); t.id = id; t.createdBy = cur.createdBy;
          // Chỉ người TẠO yêu cầu (hoặc Quản trị) mới được sửa "Thông tin yêu cầu" (Bước 1).
          // Người khác (người được yêu cầu, người xử lý…) sửa gì ở Bước 1 sẽ bị giữ nguyên theo bản gốc.
          const isReq = (me.username === cur.createdBy) || (cur.nguoiYC && String(cur.nguoiYC).trim() === String(me.name||"").trim());
          if (!isReq && !can(me, "users")) {
            const REQ_FIELDS = ["loai","loaiKhac","luong","moTaThem","donvi","nguoiYC","sdt","email","nguoiDuocYC","nguoiDuocYCName","nguoiDuocYCSdt","riengTu","watchers","noidung","soluong","dvt","quycach","diadiemGiao","diadiemNhan"];
            REQ_FIELDS.forEach(f => { t[f] = cur[f]; });
          }
          const note = String(t._reason || "").trim();
          const nowISO = new Date().toISOString();
          t.history = Array.isArray(cur.history) ? cur.history.slice() : [];
          if (baseStatus(t.trangthai) !== baseStatus(cur.trangthai)) {
            if (needReason(cur.trangthai, t.trangthai) && note.length < 5)
              return sendJSON(res, 400, { error: "Vui lòng ghi lý do (tối thiểu 5 ký tự) cho thao tác này" });
            t.history.push({ at: nowISO, from: cur.trangthai, to: t.trangthai, by: me.username, note });
          }
          // Nhật ký thay đổi (audit log) — máy chủ giữ, không cho client xóa vết
          t.auditLog = Array.isArray(cur.auditLog) ? cur.auditLog.slice() : [];
          const changes = diffAudit(cur, t);
          if (changes.length) t.auditLog.push({ at: nowISO, by: me.username, changes, note: note || "" });
          delete t._reason;
          saveTicketRow(t, false);
          // Thông báo: được giao việc (khi đổi người thực hiện)
          if (String(t.assignee||"").trim() && String(t.assignee||"").trim() !== String(cur.assignee||"").trim()) {
            const au = userByName(t.assignee); if (au && au.username !== me.username) pushNotif(au.username, "assign", `Bạn được giao ticket ${t.id}: ${t.noidung? String(t.noidung).slice(0,60): t.donvi||""}`, t.id);
          }
          // Thông báo: ticket đổi trạng thái -> người tạo phiếu
          if (baseStatus(t.trangthai) !== baseStatus(cur.trangthai) && cur.createdBy && cur.createdBy !== me.username)
            pushNotif(cur.createdBy, "status", `Ticket ${t.id} chuyển sang "${baseStatus(t.trangthai)}"`, t.id);
          // Giai đoạn C — Ticket khắc phục con Hoàn tất -> cập nhật & báo về ticket gốc
          if (t.parentId && baseStatus(t.trangthai) === "Hoàn tất" && baseStatus(cur.trangthai) !== "Hoàn tất") {
            const parent = getTicket(t.parentId);
            if (parent) {
              if (Array.isArray(parent.hangMuc) && t.hangMucKey) {
                const h = parent.hangMuc.find(x => x.key === t.hangMucKey);
                if (h) { h.khacPhucXong = true; h.lyDo = (h.lyDo ? h.lyDo + " · " : "") + "Đã khắc phục (" + t.id + ") — chờ nghiệm thu lại"; }
                saveTicketRow(parent, false);
              }
              if (parent.createdBy) pushNotif(parent.createdBy, "status", `Ticket khắc phục ${t.id} đã Hoàn tất — nghiệm thu lại ticket gốc ${parent.id}`, parent.id);
              const pa = userByName(parent.assignee); if (pa && pa.username !== me.username) pushNotif(pa.username, "status", `Khắc phục ${t.id} xong cho ticket ${parent.id}`, parent.id);
            }
          }
          return sendJSON(res, 200, t);
        }
        if (req.method === "DELETE") {
          if (!can(me, "del")) return sendJSON(res, 403, { error: "Không có quyền xóa ticket" });
          S.ticketDel.run(id); return sendJSON(res, 200, { ok: true });
        }
      }

      /* ---- Phát sinh ---- */
      if (p === "/api/ps" && req.method === "POST") {
        if (!can(me, "ps")) return sendJSON(res, 403, { error: "Không có quyền ghi phát sinh" });
        const x = await readBody(req); x.id = genId("PS"); savePSRow(x, true);
        // Thông báo: phát sinh chờ duyệt -> người có quyền duyệt
        if (baseStatus(x.duyet||"Chờ duyệt") === "Chờ duyệt")
          dispatcherUsernames().forEach(un => { if (un !== me.username) pushNotif(un, "ps", `Phát sinh ${x.id} chờ duyệt (ticket ${x.ticketId||""})`, x.ticketId||""); });
        return sendJSON(res, 201, x);
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
        if (req.method === "GET") return sendJSON(res, 200, S.users.all().map(u => { const su = sanitizeUser(u); const r = Q_LOGIN.lastOk.get(u.username); su.lastLogin = r ? r.at : ""; return su; }));
        if (req.method === "POST") {
          const b = await readBody(req); const un = String(b.username||"").trim();
          if (!un || !b.password) return sendJSON(res, 400, { error: "Thiếu tên đăng nhập hoặc mật khẩu" });
          if (S.user.get(un)) return sendJSON(res, 400, { error: "Tên đăng nhập đã tồn tại" });
          if (!ROLES[b.role]) return sendJSON(res, 400, { error: "Vai trò không hợp lệ" });
          if (!validPw(b.password)) return sendJSON(res, 400, { error: PW_MSG });
          const { salt, hash } = hashPw(b.password);
          // Người dùng mới do admin tạo phải đổi mật khẩu ở lần đăng nhập đầu
          S.userIns.run(un, b.name||un, b.role, b.dept||"", salt, hash, 1, b.chucdanh||"", b.sdt||"", b.email||"", b.trangthai||"active", b.canProxy?1:0);
          return sendJSON(res, 201, { ok: true });
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
          const chucdanh = b.chucdanh != null ? b.chucdanh : (u.chucdanh||"");
          const sdt = b.sdt != null ? b.sdt : (u.sdt||"");
          const email = b.email != null ? b.email : (u.email||"");
          const trangthai = b.trangthai != null ? b.trangthai : (u.trangthai||"active");
          const canProxy = b.canProxy != null ? (b.canProxy?1:0) : (u.canProxy?1:0);
          let salt = u.salt, hash = u.hash, mustChange = u.mustChange;
          if (b.password) { if (!validPw(b.password)) return sendJSON(res, 400, { error: PW_MSG }); const h = hashPw(b.password); salt = h.salt; hash = h.hash; mustChange = 1; }
          S.userUpd.run(name, role, dept, salt, hash, mustChange, chucdanh, sdt, email, trangthai, canProxy, un);
          return sendJSON(res, 200, { ok: true });
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
    const ext = path.extname(full);
    // Không cache HTML/JS để mọi cập nhật giao diện hiện ngay, không cần Ctrl+F5
    const cache = (ext === ".html" || ext === ".js") ? "no-store" : "no-cache";
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": cache });
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
      // Thông báo trễ SLA xử lý: chỉ báo 1 lần cho người thực hiện khi vượt hạn
      if (!isClosedStatus(t.trangthai) && !t._slaBreachNoti && t.assignee) {
        const used = slaUsedSrv(t), lim = slaProcHours(t.uutien);
        if (lim > 0 && used > lim) {
          const au = userByName(t.assignee);
          if (au) pushNotif(au.username, "sla", `Ticket ${t.id} đã TRỄ SLA xử lý (đã dùng ${used.toFixed(1)}h / ${lim}h)`, t.id);
          t._slaBreachNoti = true; saveTicketRow(t, false);
        }
      }
      // Giai đoạn B — Thông báo trễ SLA nghiệm thu: ticket "Đã xử lý" (chờ nghiệm thu) quá hạn
      // (bỏ qua nếu đã nghiệm thu sau lần gửi gần nhất — vd đang chờ khắc phục)
      const ntSauGui = t.tNghiemThu && t.tSubmit && new Date(t.tNghiemThu) >= new Date(t.tSubmit);
      if (baseStatus(t.trangthai) === "Đã xử lý" && t.tSubmit && !ntSauGui && !t._acceptBreachNoti) {
        const usedA = acceptUsedSrv(t), limA = acceptSlaHours(t);
        if (limA > 0 && usedA > limA) {
          if (t.createdBy) pushNotif(t.createdBy, "sla", `Ticket ${t.id} CHỜ NGHIỆM THU quá hạn (${usedA.toFixed(1)}h / ${limA}h) — vui lòng nghiệm thu`, t.id);
          dispatcherUsernames().forEach(un => { if (un !== t.createdBy) pushNotif(un, "sla", `Ticket ${t.id} chờ nghiệm thu quá SLA (${usedA.toFixed(1)}h / ${limA}h)`, t.id); });
          t._acceptBreachNoti = true; saveTicketRow(t, false);
        }
      }
    }
  } catch (e) {}
}, 60000);

/* ---- Sao lưu tự động theo lịch (kiểm tra mỗi 10 phút) ---- */
setInterval(() => {
  try {
    const b = getConfig().backup || {};
    if (!b.enabled) return;
    const everyMs = Math.max(1, +b.everyHours || 24) * 3600 * 1000;
    if (Date.now() - lastBackupAt >= everyMs) { const r = runBackup("tự động"); if (r.ok) console.log("  ✓ Đã sao lưu tự động: " + r.name); }
  } catch (e) {}
}, 10 * 60 * 1000);
// Sao lưu 1 lần ~30 giây sau khi khởi động (nếu đến hạn / chưa có bản nào)
setTimeout(() => { try { const b = getConfig().backup||{}; if (b.enabled && !listBackups().length) { const r=runBackup("khởi động"); if(r.ok) console.log("  ✓ Đã tạo bản sao lưu đầu tiên: "+r.name); } } catch(e){} }, 30000);

/* ============================ KHỞI ĐỘNG ============================ */
migrateFromJson(); seedConfig(); seedUsers(); seedTickets();
server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces(); const ips = [];
  for (const name of Object.keys(nets)) for (const ni of nets[name]) if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
  console.log("\n===============================================================");
  console.log("  HỆ THỐNG HỖ TRỢ THNG — máy chủ nội bộ (SQLite) " + APP_VERSION + " đã chạy");
  console.log("===============================================================");
  console.log("  • Trên máy chủ này, mở:   http://localhost:" + PORT);
  if (ips.length) { console.log("  • Các phòng ban trong mạng nội bộ mở:"); ips.forEach(ip => console.log("        http://" + ip + ":" + PORT)); }
  console.log("  • Tài khoản quản trị mặc định:  admin / admin123  (đổi ngay sau lần đầu)");
  console.log("  • Cơ sở dữ liệu: " + DB_FILE);
  console.log("  • Nhấn Ctrl + C để dừng máy chủ.");
  console.log("===============================================================\n");
});
