/* =====================================================================
 * Hệ thống Hỗ trợ THNG — Máy chủ nội bộ (LAN)
 * Zero-dependency: chỉ cần cài Node.js, không cần "npm install".
 * Chạy:  node server.js        (hoặc dùng file start-windows.bat / start.sh)
 * Dữ liệu dùng chung lưu tại:  data.json  (cùng thư mục)
 * ===================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // lắng nghe mọi card mạng để LAN truy cập được
const ROOT = __dirname;
const PUB = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data.json");

/* ----------------------- Kho dữ liệu (file JSON) ----------------------- */
let DB = { tickets: [], ps: [], seq: {} };
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) DB = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) { console.error("Lỗi đọc data.json:", e.message); }
  if (!DB.tickets) DB.tickets = [];
  if (!DB.ps) DB.ps = [];
  if (!DB.seq) DB.seq = {};
}
let saving = false, saveAgain = false;
function saveDB() {
  // Ghi an toàn: ghi file tạm rồi đổi tên (atomic) để không hỏng dữ liệu khi trùng lúc
  if (saving) { saveAgain = true; return; }
  saving = true;
  const tmp = DATA_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(DB, null, 2), (err) => {
    if (err) { console.error("Lỗi ghi:", err.message); saving = false; return; }
    fs.rename(tmp, DATA_FILE, () => {
      saving = false;
      if (saveAgain) { saveAgain = false; saveDB(); }
    });
  });
}

/* ----------------------- Sinh mã & tiện ích ----------------------- */
function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function genId(pfx) {
  const day = new Date();
  const k = pfx + ymd(day);
  DB.seq[k] = (DB.seq[k] || 0) + 1;
  return `${pfx}-${ymd(day)}-${String(DB.seq[k]).padStart(4, "0")}`;
}

/* ----------------------- Dữ liệu mẫu lần đầu ----------------------- */
function seedIfEmpty() {
  if (DB.tickets.length || DB.ps.length) return;
  const d = new Date("2026-08-03T08:15:00");
  DB.seq["TK20260803"] = 0; DB.seq["PS20260803"] = 0;
  const flowExternal = new Set([
    "Sự cố dịch vụ - gián đoạn vận hành","Bảo trì - bảo dưỡng định kỳ","Sửa chữa - khắc phục hỏng hóc",
    "Giao nhận hàng hóa cho khách hàng","Lắp đặt - nghiệm thu tại điểm khách hàng","Khiếu nại - yêu cầu xử lý của khách hàng"]);
  const loai = "Giao nhận hàng hóa cho khách hàng";
  const id = genId("TK");
  DB.tickets.push({
    id, tCreate: d.toISOString(), loai, luong: flowExternal.has(loai) ? "Hỗ trợ Khách hàng bên ngoài" : "Hỗ trợ Nội bộ",
    donvi: "P. Kinh doanh", nguoiYC: "Nguyễn Văn A", sdt: "0901234567", email: "a.nguyen@congty.vn",
    watchers: "Trưởng P.KD; KT trưởng", noidung: "Giao hàng mẫu cho khách hàng ABC theo HĐ 125/HĐKT",
    soluong: 20, dvt: "Thùng", quycach: "Carton 40x30x30cm, hàng dễ vỡ, không xếp chồng",
    diadiemGiao: "Kho A - 12 Nguyễn Huệ, Q.1", diadiemNhan: "Cty ABC - 45 Lê Lợi, Q.3", tGiaoYC: "2026-08-03T10:00",
    uutien: "P2 - Ưu tiên cao", doi: "Đội Giao nhận 1", assignee: "Trần Văn B", phoihop: "Lê Văn E (bốc xếp)",
    tAssign: "2026-08-03T08:25", tStart: "2026-08-03T09:30", tDone: "2026-08-03T16:20",
    trangthai: "6. Hoàn tất", slThucte: 19, diadiemThucte: "Cty ABC - 45 Lê Lợi, Q.3",
    nguoiNhan: "Lê Thị C", nghiemthu: "Hoàn thành một phần",
    dexuat: "Đổi 01 thùng mới giao trong ngày 04/08; phổ biến lại quy tắc bốc xếp",
    dathuchien: "Đã lập biên bản với khách, nhập lại kho 01 thùng lỗi",
    attach: "BBGN_08.pdf; anh_thung_mop.jpg", csat: 4,
    nhanxet: "Xử lý nhanh, cần cẩn thận khâu bốc xếp", tClose: "2026-08-04T09:00", moLai: 0, ghichu: ""
  });
  DB.ps.push({
    id: genId("PS"), ticketId: id, ngay: "2026-08-03", loai: "Sự cố hàng hóa (hư hỏng/thiếu/mất)",
    mota: "01/20 thùng bị móp góc, khách hàng ABC từ chối nhận",
    nguyennhan: "Xếp chồng quá 3 lớp khi bốc xếp lên xe", anhhuong: "Trung bình",
    chiphiDX: 50000, chiphiDuyet: 50000, duyet: "Đã duyệt", attach: "BBGN_08.pdf; anh_thung_mop.jpg", nguoiXL: "Trần Văn B"
  });
  saveDB();
}

/* ----------------------- Máy chủ HTTP ----------------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png" };

function sendJSON(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(s);
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  // ---------- API ----------
  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/data" && req.method === "GET") return sendJSON(res, 200, DB);

      if (p === "/api/tickets" && req.method === "POST") {
        const t = await readBody(req);
        t.id = genId("TK"); t.tCreate = new Date().toISOString();
        DB.tickets.unshift(t); saveDB(); return sendJSON(res, 201, t);
      }
      let m;
      if ((m = p.match(/^\/api\/tickets\/(.+)$/))) {
        const id = decodeURIComponent(m[1]);
        const i = DB.tickets.findIndex(x => x.id === id);
        if (i < 0) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") { const t = await readBody(req); t.id = id; DB.tickets[i] = t; saveDB(); return sendJSON(res, 200, t); }
        if (req.method === "DELETE") { DB.tickets.splice(i, 1); saveDB(); return sendJSON(res, 200, { ok: true }); }
      }

      if (p === "/api/ps" && req.method === "POST") {
        const x = await readBody(req);
        x.id = genId("PS"); DB.ps.unshift(x); saveDB(); return sendJSON(res, 201, x);
      }
      if ((m = p.match(/^\/api\/ps\/(.+)$/))) {
        const id = decodeURIComponent(m[1]);
        const i = DB.ps.findIndex(x => x.id === id);
        if (i < 0) return sendJSON(res, 404, { error: "not found" });
        if (req.method === "PUT") { const x = await readBody(req); x.id = id; DB.ps[i] = x; saveDB(); return sendJSON(res, 200, x); }
        if (req.method === "DELETE") { DB.ps.splice(i, 1); saveDB(); return sendJSON(res, 200, { ok: true }); }
      }
      return sendJSON(res, 404, { error: "unknown endpoint" });
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  // ---------- File tĩnh ----------
  let file = p === "/" ? "index.html" : decodeURIComponent(p.replace(/^\/+/, ""));
  const full = path.join(PUB, file);
  if (!full.startsWith(PUB)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end("Không tìm thấy trang."); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

/* ----------------------- Khởi động ----------------------- */
loadDB(); seedIfEmpty();
server.listen(PORT, HOST, () => {
  const nets = require("os").networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets))
    for (const ni of nets[name]) if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
  console.log("\n===============================================================");
  console.log("  HỆ THỐNG HỖ TRỢ THNG — máy chủ nội bộ đã chạy");
  console.log("===============================================================");
  console.log("  • Trên máy chủ này, mở:   http://localhost:" + PORT);
  if (ips.length) {
    console.log("  • Các phòng ban trong mạng nội bộ mở một trong các địa chỉ:");
    ips.forEach(ip => console.log("        http://" + ip + ":" + PORT));
  }
  console.log("  • Dữ liệu dùng chung lưu tại: " + DATA_FILE);
  console.log("  • Nhấn Ctrl + C để dừng máy chủ.");
  console.log("===============================================================\n");
});
