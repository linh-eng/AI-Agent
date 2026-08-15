// Mục 10 — Before/After & Đánh giá: bằng chứng THẬT (HTTP API) trên DB demo.
// Chạy: node scripts/m10-evidence.mjs (server :3100). Xuất JSON ra EV_OUT.
const BASE = "http://localhost:3100";
let IP = 40;
const j = (x) => JSON.stringify(x, null, 2);
const line = (t) => console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70));

async function login(path, email, password, cookieName) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.4.0.${IP++}` },
    body: JSON.stringify({ email, password }),
  });
  const setc = res.headers.getSetCookie?.() ?? [];
  return setc.map((c) => c.split(";")[0]).join("; ");
}
async function api(cookie, method, path) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { cookie } });
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("application/json")) { try { data = (await res.json()).data; } catch {} }
  return { status: res.status, contentType: ct, data };
}

const out = {};
const staff = await login("/api/auth/login", "quanly@sophia.com.vn", "quanly123");
const portalLinh = await login("/api/portal/login", "linh.do@example.com", "khach123"); // KH-100004
const portalAn = await login("/api/portal/login", "khachhang@example.com", "khach123"); // KH-000001

// =====================================================================
line("A · GALLERY LINEAGE — mỗi nhóm ảnh truy ngược session→khách→dịch vụ→KTV");
// =====================================================================
const groups = await api(staff, "GET", "/api/before-after");
out.A = {
  endpoint: "GET /api/before-after",
  groups: groups.data.map((g) => ({
    sessionId: g.sessionId, sessionNumber: g.sessionNumber, customer: g.customerName,
    service: g.serviceName, ktv: g.technicianName, performedAt: g.performedAt?.slice(0, 10),
    before: g.before.map((m) => m.id), after: g.after.map((m) => m.id),
  })),
};
console.log(j(out.A));
const gRF = groups.data.find((g) => g.serviceName && /RF/.test(g.serviceName));
const gHIFU = groups.data.find((g) => g.serviceName && /HIFU/.test(g.serviceName));

// =====================================================================
line("B · FILTER — gallery + KPI dùng CÙNG bộ lọc (không global)");
// =====================================================================
const kAll = await api(staff, "GET", "/api/session-reviews/summary");
// Lọc theo KHOẢNG NGÀY (cùng trường performedAt mà gallery dùng) — không mơ hồ.
// Buổi RF (SS-100001) 25/07; buổi HIFU (SS-100003) 03/09.
const wJul = "from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z"; // chỉ SS-100001
const wSep = "from=2026-08-15T00:00:00Z&to=2026-10-01T00:00:00Z"; // chỉ SS-100003
const galJul = await api(staff, "GET", `/api/before-after?${wJul}`);
const kpiJul = await api(staff, "GET", `/api/session-reviews/summary?${wJul}`);
const galSep = await api(staff, "GET", `/api/before-after?${wSep}`);
const kpiSep = await api(staff, "GET", `/api/session-reviews/summary?${wSep}`);
out.B = {
  global: { galleryGroups: groups.data.length, kpiTotalReviews: kAll.data.totalReviews },
  window_Jul_RF: { galleryGroups: galJul.data.length, galleryService: galJul.data[0]?.serviceName, kpiTotalReviews: kpiJul.data.totalReviews },
  window_Sep_HIFU: { galleryGroups: galSep.data.length, galleryService: galSep.data[0]?.serviceName, kpiTotalReviews: kpiSep.data.totalReviews },
};
console.log(j(out.B));

// =====================================================================
line("D/F/G · PRIVACY — ảnh private không lên portal; ảnh shared → chủ khách xem được");
// =====================================================================
// SS-100001: cả before+after đã chia sẻ. SS-100003: after KHÔNG chia sẻ (private).
const sharedImg = gRF?.before?.[0]?.id ?? gRF?.after?.[0]?.id;
const privateImg = gHIFU?.after?.[0]?.id; // after HIFU private
const gGET = await api(portalLinh, "GET", `/api/portal/media/${sharedImg}`);
const pGET = await api(portalLinh, "GET", `/api/portal/media/${privateImg}`);
const overview = await api(portalLinh, "GET", "/api/portal/overview");
out.DFG = {
  sharedImg, privateImg,
  portal_owner_shared_status: gGET.status, portal_owner_shared_ct: gGET.contentType,
  portal_owner_private_status: pGET.status,
  overview_media_ids: overview.data.media.map((m) => m.id),
  overview_includes_shared: overview.data.media.some((m) => m.id === sharedImg),
  overview_includes_private: overview.data.media.some((m) => m.id === privateImg),
};
console.log(j(out.DFG));

// =====================================================================
line("H · CROSS-CUSTOMER — khách khác (KH-000001) KHÔNG xem được ảnh của KH-100004");
// =====================================================================
const crossShared = await api(portalAn, "GET", `/api/portal/media/${sharedImg}`);
const crossPrivate = await api(portalAn, "GET", `/api/portal/media/${privateImg}`);
out.H = { as: "KH-000001 (khachhang@example.com)", shared_of_other_status: crossShared.status, private_of_other_status: crossPrivate.status };
console.log(j(out.H));

// =====================================================================
line("I/J/K/L · KPI toàn cục (đối chiếu DB ở bước psql)");
// =====================================================================
out.IJKL = {
  totalReviews: kAll.data.totalReviews,
  avgSatisfaction: kAll.data.avgSatisfaction,
  avgTechnician: kAll.data.avgTechnician,
  wouldReturnRate: kAll.data.wouldReturnRate,
  technicians: kAll.data.technicians,
};
console.log(j(out.IJKL));

const fs = await import("node:fs");
fs.writeFileSync(process.env.EV_OUT || "/tmp/m10-out.json", j(out));
console.log("\n→ wrote", process.env.EV_OUT || "/tmp/m10-out.json");
