const BASE = "http://localhost:3100";
let IP = 80;
const j = (x) => JSON.stringify(x, null, 2);
const line = (t) => console.log("\n"+"=".repeat(66)+"\n"+t+"\n"+"=".repeat(66));
async function login(email, pw){ const r=await fetch(`${BASE}/api/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`10.0.9.${IP++}`},body:JSON.stringify({email,password:pw})}); return (r.headers.getSetCookie?.()??[]).map(c=>c.split(";")[0]).join("; "); }
async function api(cookie, method, path, body){ const r=await fetch(`${BASE}${path}`,{method,headers:{"content-type":"application/json",cookie},body:body===undefined?undefined:JSON.stringify(body)}); let data=null,error=null; try{const j=await r.json();data=j.data;error=j.error;}catch{} return {status:r.status,data,error}; }
const out={};
const mgr = await login("quanly@sophia.com.vn","quanly123");
const letan = await login("letan@sophia.com.vn","letan123");

line("A · GET cấu hình hiện tại");
const before = await api(mgr,"GET","/api/settings/brand");
out.A = { status: before.status, brand: before.data };
console.log(j(out.A));

line("B/C/D/K · PUT đổi tên/khẩu hiệu/màu → GET request MỚI vẫn giữ (persist)");
const put = await api(mgr,"PUT","/api/settings/brand",{ name:"Sophia Care (đã đổi)", tagline:"Chăm sóc tận tâm", primaryColor:"#3366cc" });
const after = await api(mgr,"GET","/api/settings/brand");
out.BCDK = { putStatus: put.status, afterGet: after.data };
console.log(j(out.BCDK));

line("D(neg) · màu SAI định dạng → 422 (validate)");
const bad = await api(mgr,"PUT","/api/settings/brand",{ name:"X", primaryColor:"notacolor" });
out.Dneg = { status: bad.status, error: bad.error };
console.log(j(out.Dneg));

line("I · RBAC ghi: Lễ tân (không setting.write) PUT → 403");
const forbid = await api(letan,"PUT","/api/settings/brand",{ name:"Hack" });
out.I = { role:"RECEPTION (letan)", status: forbid.status, error: forbid.error };
console.log(j(out.I));

line("G · version = package.json (single source)");
const fs = await import("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));
out.G = { packageVersion: pkg.version };
console.log(j(out.G));

// khôi phục tên mặc định để giữ demo sạch
await api(mgr,"PUT","/api/settings/brand",{ name:"Sophia Care", tagline:"Quản lý khách hàng & vận hành dịch vụ", primaryColor:"#4f7d6e" });
fs.writeFileSync(process.env.EV_OUT||"/tmp/m13-out.json", j(out));
console.log("\n→ wrote", process.env.EV_OUT||"/tmp/m13-out.json");
