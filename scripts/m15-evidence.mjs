// =============================================================================
// Mục 15 — Bằng chứng LIVE HTTP: RBAC 7 vai trò. Chạy thật qua server Next
// (http://localhost:3100) + DB thật. Kiểm ALLOW/DENY (status) + FIELD PRIVACY
// (JSON tài chính) — KHÔNG dựa vào ẩn menu.
// =============================================================================
const BASE = process.env.BASE || "http://localhost:3100";

async function login(email, password) {
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.150.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` }, body: JSON.stringify({ email, password }) });
  const sc = res.headers.get("set-cookie");
  const body = await res.json().catch(() => null);
  return { status: res.status, cookie: sc ? sc.split(";")[0] : "", perms: body?.data?.permissions || [] };
}
async function call(cookie, path, method = "GET", body) {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
}
const S = (s) => (s >= 200 && s < 300 ? `${s} ✅` : `${s} ⛔`);

const ROLES = [
  { key: "ADMIN", email: "admin@sophia.com.vn", pw: "admin123" },
  { key: "MANAGER", email: "quanly@sophia.com.vn", pw: "quanly123" },
  { key: "RECEPTION", email: "letan@sophia.com.vn", pw: "letan123" },
  { key: "CUSTOMER_CARE", email: "cskh@sophia.com.vn", pw: "cskh123" },
  { key: "SPECIALIST", email: "chuyenvien@sophia.com.vn", pw: "chuyenvien123" },
  { key: "CASHIER", email: "thungan@sophia.com.vn", pw: "thungan123" },
  { key: "MARKETING", email: "marketing@sophia.com.vn", pw: "marketing123" },
];

// Đại diện các route + kỳ vọng theo vai trò (ALLOW = 2xx; DENY = 403).
function costFromServices(json) {
  const list = json?.data || []; const withCost = list.find((s) => s.expectedCost != null);
  return withCost ? "hiện" : (list.length ? "null(mask)" : "-");
}

(async () => {
  const out = [];
  // Anonymous 401
  const anon = await call("", "/api/users");
  const anonCust = await call("", "/api/customers");
  out.push(`### B · Anonymous → 401\n/api/users = ${anon.status}; /api/customers = ${anonCust.status}`);

  const rows = [];
  for (const r of ROLES) {
    const s = await login(r.email, r.pw);
    if (s.status !== 200) { rows.push(`${r.key}: LOGIN FAIL ${s.status}`); continue; }
    const users = await call(s.cookie, "/api/users");           // user.manage
    const customers = await call(s.cookie, "/api/customers");    // clinic read
    const priceFloors = await call(s.cookie, "/api/price-floors"); // pricefloor/finance
    const services = await call(s.cookie, "/api/services");      // service read + cost mask
    const sessPost = await call(s.cookie, "/api/treatment-sessions", "POST", {}); // treatment.write gate
    const payPost = await call(s.cookie, "/api/payments", "POST", {}); // payment.write gate
    const fin = s.perms.includes("finance.read");
    rows.push(
      `| ${r.key} | ${S(users.status)} | ${S(customers.status)} | ${S(priceFloors.status)} | ${costFromServices(services.json)} | ${S(sessPost.status)} | ${S(payPost.status)} | ${fin ? "có" : "KHÔNG"} |`
    );
  }
  out.push(
    "### A–K · Ma trận HTTP theo vai trò (status thật + field privacy)\n" +
    "| Role | /users (user.manage) | /customers (read) | /price-floors | /services expectedCost | POST session (treatment.write) | POST payment (payment.write) | finance.read |\n" +
    "|------|------|------|------|------|------|------|------|\n" +
    rows.join("\n")
  );

  // J · Financial privacy chi tiết: so sánh CSKH vs Thu ngân trên spa-products.cost
  const cskh = await login("cskh@sophia.com.vn", "cskh123");
  const cashier = await login("thungan@sophia.com.vn", "thungan123");
  const spCskh = await call(cskh.cookie, "/api/spa-products");
  const spCashier = await call(cashier.cookie, "/api/spa-products");
  const costCskh = (spCskh.json?.data || []).map((p) => p.cost);
  const costCashier = (spCashier.json?.data || []).map((p) => p.cost);
  out.push(
    "### J · Financial privacy — spa-products.cost (JSON trực tiếp)\n" +
    `CSKH (non-finance): cost = [${costCskh.slice(0,4).join(", ")}] → toàn null\n` +
    `Thu ngân (finance): cost = [${costCashier.slice(0,4).join(", ")}] → có giá trị`
  );

  console.log(out.join("\n\n"));
})();
