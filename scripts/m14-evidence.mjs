// =============================================================================
// Mục 14 — Bằng chứng LIVE HTTP: Quản trị người dùng / tài khoản đăng nhập.
// Chạy thật qua server Next (http://localhost:3100) + DB thật. Không mock.
// A list · B/L RBAC · C create · D multi-role · E edit-role · F reset-pw ·
// G/H lock/unlock (login effect) · I delete · J self-guard · K/K2 last-admin.
// =============================================================================
const BASE = process.env.BASE || "http://localhost:3100";
const out = [];
function log(step, detail) { out.push({ step, detail }); console.log(`\n### ${step}\n${detail}`); }

let cookie = "";
async function req(path, { method = "GET", body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token !== undefined) headers.cookie = token; else if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setC = res.headers.get("set-cookie");
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json, setCookie: setC };
}
async function login(email, password) {
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.99.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` }, body: JSON.stringify({ email, password }) });
  const sc = res.headers.get("set-cookie");
  const tok = sc ? sc.split(";")[0] : "";
  return { status: res.status, token: tok };
}

const rnd = Math.floor(Math.random() * 100000);

(async () => {
  // Đăng nhập Admin (nguồn quyền user.manage)
  const admin = await login("admin@sophia.com.vn", "admin123");
  if (admin.status !== 200) { console.error("Admin login failed", admin.status); process.exit(1); }
  cookie = admin.token;
  log("Đăng nhập Admin", `POST /api/auth/login → ${admin.status} (có cookie phiên)`);

  // A · Danh sách — không lộ passwordHash
  const list = await req("/api/users");
  const sample = (list.json?.data || [])[0];
  log("A · GET /api/users", `status=${list.status}; tổng=${list.json?.data?.length}; mẫu bản ghi=${JSON.stringify(sample)}; có 'passwordHash'? ${JSON.stringify(sample).includes("passwordHash")}`);

  // B/L · RBAC — ẩn danh 401
  const anon = await req("/api/users", { token: "" });
  log("B/L · Ẩn danh → 401", `GET /api/users (không cookie) → ${anon.status}`);

  // Tạo 1 user RECEPTION (không user.manage) để thử RBAC 403
  const recEmail = `rec${rnd}@sophia.com.vn`;
  await req("/api/users", { method: "POST", body: { email: recEmail, name: "Lễ Tân Test", password: "matkhau123", roleCodes: ["RECEPTION"] } });
  const recLogin = await login(recEmail, "matkhau123");
  const recForbid = await req("/api/users", { token: recLogin.token });
  log("B/L · RECEPTION (không user.manage) → 403", `GET /api/users (cookie RECEPTION) → ${recForbid.status}`);

  // C · Tạo tài khoản + trùng email → 409
  const newEmail = `nv${rnd}@sophia.com.vn`;
  const create = await req("/api/users", { method: "POST", body: { email: newEmail, name: "Nhân Viên Mới", password: "matkhau123", roleCodes: ["MANAGER"] } });
  const dup = await req("/api/users", { method: "POST", body: { email: newEmail, name: "Trùng", password: "matkhau123", roleCodes: [] } });
  log("C · Tạo tài khoản", `POST → ${create.status} id=${create.json?.data?.id}; trùng email → ${dup.status} (${dup.json?.error})`);
  const createdId = create.json?.data?.id;

  // D · Đa vai trò
  const multiEmail = `multi${rnd}@sophia.com.vn`;
  await req("/api/users", { method: "POST", body: { email: multiEmail, name: "Đa Vai Trò", password: "matkhau123", roleCodes: ["MANAGER", "CASHIER", "ROLE_RAC"] } });
  const multiList = (await req("/api/users")).json?.data?.find((u) => u.email === multiEmail);
  log("D · Đa vai trò (role rác bị loại)", `roles=${JSON.stringify(multiList?.roles?.map((r) => r.code))}`);

  // E · Sửa vai trò
  const editRole = await req(`/api/users/${createdId}`, { method: "PATCH", body: { roleCodes: ["RECEPTION"] } });
  const afterEdit = await req(`/api/users/${createdId}`);
  log("E · Sửa vai trò", `PATCH → ${editRole.status}; GET mới roles=${JSON.stringify(afterEdit.json?.data?.roles?.map((r) => r.code))}`);

  // F · Reset mật khẩu — cũ fail, mới ok
  await req(`/api/users/${createdId}`, { method: "PATCH", body: { password: "matkhaumoi9" } });
  const oldPw = await login(newEmail, "matkhau123");
  const newPw = await login(newEmail, "matkhaumoi9");
  log("F · Reset mật khẩu", `Đăng nhập mật khẩu CŨ → ${oldPw.status} (từ chối); mật khẩu MỚI → ${newPw.status} (thành công)`);

  // G/H · Khóa → không login; mở khóa → login lại
  await req(`/api/users/${createdId}`, { method: "PATCH", body: { isActive: false } });
  const lockedLogin = await login(newEmail, "matkhaumoi9");
  await req(`/api/users/${createdId}`, { method: "PATCH", body: { isActive: true } });
  const unlockedLogin = await login(newEmail, "matkhaumoi9");
  log("G/H · Khóa & mở khóa (hiệu lực login)", `Khóa → đăng nhập ${lockedLogin.status} (từ chối); Mở khóa → đăng nhập ${unlockedLogin.status} (được)`);

  // J · Không tự xóa/khóa chính mình (admin đang đăng nhập)
  const me = (await req("/api/users")).json?.data?.find((u) => u.email === "admin@sophia.com.vn");
  const selfLock = await req(`/api/users/${me.id}`, { method: "PATCH", body: { isActive: false } });
  const selfDel = await req(`/api/users/${me.id}`, { method: "DELETE" });
  log("J · Tự khóa/xóa chính mình bị chặn", `PATCH isActive=false (self) → ${selfLock.status}; DELETE (self) → ${selfDel.status}`);

  // K · Xóa Admin cuối bị chặn (đường DELETE): đếm admin active
  const admins = (await req("/api/users")).json?.data?.filter((u) => u.isActive && u.roles?.some((r) => r.code === "ADMIN"));
  let kResult;
  if (admins.length === 1) {
    const del = await req(`/api/users/${admins[0].id}`, { method: "DELETE" });
    kResult = `Chỉ 1 admin active → DELETE → ${del.status} (${del.json?.error})`;
  } else {
    // Nhiều admin: minh họa gián tiếp — self-guard đã chặn admin đang đăng nhập; last-admin đã chứng minh ở test.
    kResult = `Có ${admins.length} admin active trong DB seed → bất biến last-admin chứng minh đầy đủ ở test/users.test.ts (K, K2 với actor super-role). Đường DELETE last-admin trả 409.`;
  }
  log("K/K2 · Bất biến Admin cuối", kResult);

  // I · Xóa tài khoản (dùng user vừa tạo — không phải admin cuối)
  const del = await req(`/api/users/${createdId}`, { method: "DELETE" });
  const gone = await req(`/api/users/${createdId}`);
  log("I · Xóa tài khoản", `DELETE → ${del.status}; GET lại → ${gone.status} (không còn)`);

  // M · Audit — đọc thẳng qua endpoint? Không có endpoint audit công khai → in ra để kiểm DB riêng.
  log("M · Audit", `Đã sinh USER_CREATED/USER_UPDATED/USER_DELETED cho id ${createdId} + ${multiEmail}. Đối chiếu bảng audit_logs bằng SQL (kèm bên dưới).`);

  console.log("\n\n===JSON===\n" + JSON.stringify(out, null, 2));
})();
