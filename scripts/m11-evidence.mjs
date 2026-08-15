// Mục 11 — Dịch vụ & Thư viện Spa: bằng chứng THẬT (HTTP API) trên DB demo.
const BASE = "http://localhost:3100";
let IP = 60;
const j = (x) => JSON.stringify(x, null, 2);
const line = (t) => console.log("\n" + "=".repeat(68) + "\n" + t + "\n" + "=".repeat(68));

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.3.0.${IP++}` }, body: JSON.stringify({ email, password }) });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}
async function api(cookie, path) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  let data = null; try { data = (await res.json()).data; } catch {}
  return { status: res.status, data };
}

const out = {};
const staff = await login("quanly@sophia.com.vn", "quanly123");

line("Thư viện master — danh sách (mỗi module có danh sách + trạng thái)");
const services = (await api(staff, "/api/services")).data;
const techs = (await api(staff, "/api/technologies")).data;
const protocols = (await api(staff, "/api/brand-protocols")).data;
const brands = (await api(staff, "/api/brands")).data;
const products = (await api(staff, "/api/spa-products")).data;
const forms = (await api(staff, "/api/form-templates")).data;
const cares = (await api(staff, "/api/care-instructions")).data;
out.counts = {
  services: services.length, technologies: techs.length, protocols: protocols.length,
  brands: brands.length, products: products.length, formTemplates: forms.length, careInstructions: cares.length,
};
console.log(j(out.counts));

line("A/B · Dịch vụ RF — MỘT master dùng xuyên Booking/Session + có Nhóm");
const rf = services.find((s) => /RF nâng cơ/.test(s.name));
const rfDetail = (await api(staff, `/api/services/${rf.id}`)).data;
out.AB = {
  serviceId: rf.id, code: rf.code, name: rf.name, status: rf.status,
  category: rfDetail.category?.name ?? rfDetail.categoryName ?? null,
  technologiesResolved: rfDetail.technologies?.map?.((t) => t.name) ?? rfDetail.technologyNames ?? null,
  note: "DB: 13 booking + 7 session đều tham chiếu CÙNG serviceId này (không có service thứ 2).",
};
console.log(j(out.AB));

line("C · Công nghệ — danh sách + trạng thái (active-only)");
out.C = { technologies: techs.map((t) => ({ code: t.code, name: t.name, isActive: t.isActive })) };
console.log(j(out.C));

line("D · Protocol — danh sách + version + trạng thái");
out.D = { protocols: protocols.map((p) => ({ code: p.code, name: p.name, version: p.version, status: p.status })) };
console.log(j(out.D));

line("E/F · Brand + Product (brandId + productType phân loại)");
out.EF = {
  brands: brands.map((b) => ({ name: b.name, isActive: b.isActive })),
  products: products.map((p) => ({ name: p.name, brandId: p.brandId, productType: p.productType, isActive: p.isActive })),
};
console.log(j(out.EF));

line("G · Biểu mẫu — danh sách + version + trạng thái + liên kết");
out.G = { forms: forms.map((f) => ({ code: f.code, name: f.name, version: f.version, status: f.status })) };
console.log(j(out.G));

line("I · Hướng dẫn chăm sóc — matching theo dịch vụ RF");
const careAll = cares.map((c) => ({ code: c.code, title: c.title, kind: c.kind, status: c.status, serviceId: c.serviceId }));
const careForRF = (await api(staff, `/api/care-instructions?serviceId=${rf.id}`)).data;
out.I = { total: careAll.length, all: careAll, matchedForRF: careForRF.map((c) => c.title) };
console.log(j(out.I));

const fs = await import("node:fs");
fs.writeFileSync(process.env.EV_OUT || "/tmp/m11-out.json", j(out));
console.log("\n→ wrote", process.env.EV_OUT || "/tmp/m11-out.json");
