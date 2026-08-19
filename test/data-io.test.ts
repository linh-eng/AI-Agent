// =============================================================================
// DATA-IO — Nhập/Xuất CSV danh mục. Chứng minh A–L.
//   Export/template A–C · Import upsert D–H · FK-by-code + enum + date I–J ·
//   RBAC K–L. Upsert theo mã (không xóa dữ liệu ngoài file); dry-run preview.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { GET as listRaw } from "@/app/api/data-io/route";
import { GET as exportRaw } from "@/app/api/data-io/[key]/export/route";
import { GET as templateRaw } from "@/app/api/data-io/[key]/template/route";
import { POST as previewRaw } from "@/app/api/data-io/[key]/preview/route";
import { POST as importRaw } from "@/app/api/data-io/[key]/import/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "U " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.81.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const listDs = () => listRaw(new Request("http://t/api/data-io"), {} as any);
const exportCsv = (key: string) => exportRaw(new Request("http://t/x"), { params: { key } } as any);
const template = (key: string) => templateRaw(new Request("http://t/x"), { params: { key } } as any);
const preview = (key: string, csv: string) => previewRaw(new Request("http://t/x", J({ csv })), { params: { key } } as any);
const doImport = (key: string, csv: string) => importRaw(new Request("http://t/x", J({ csv })), { params: { key } } as any);

const LOY = [PERMISSIONS.LOYALTY_READ, PERMISSIONS.LOYALTY_WRITE];
const SVC = [PERMISSIONS.SERVICE_READ, PERMISSIONS.SERVICE_WRITE];

describe("DATA-IO · Export / template (A–C)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A: liệt kê dataset theo quyền (chỉ cái có readPerm)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    const rows = await D(await listDs());
    const keys = rows.map((r: any) => r.key);
    expect(keys).toContain("membership-tiers");
    expect(keys).toContain("vouchers");
    expect(keys).not.toContain("employees"); // không có staff.read
  });

  it("B: xuất CSV có tiêu đề + dữ liệu", async () => {
    const u = await makeUser(LOY); await login(u.email);
    await prisma.membershipTier.create({ data: { code: "VIP", name: "VIP", minLifetimeSpend: 5_000_000 as any, pointsPerThousand: 2 as any } });
    const res = await exportCsv("membership-tiers");
    expect(res.status).toBe(200);
    const text = (await res.text()).replace(/^﻿/, "");
    expect(text.split("\n")[0]).toContain("Mã"); // tiêu đề tiếng Việt
    expect(text.split("\n")[0]).toContain("Tên hạng");
    expect(text).toContain("VIP");
  });

  it("C: tải mẫu = chỉ dòng tiêu đề", async () => {
    const u = await makeUser(LOY); await login(u.email);
    const text = (await (await template("vouchers")).text()).replace(/^﻿/, "");
    expect(text.split("\n").length).toBe(1);
    expect(text).toContain("Mã"); // tiêu đề tiếng Việt
    expect(text).toContain("Loại");
  });
});

describe("DATA-IO · Import upsert (D–J)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("D: xem trước phân loại Thêm mới / Lỗi (thiếu cột bắt buộc)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    const csv = "code,name,type,value\nGIAM50,Giảm 50k,FIXED,50000\nBADROW,,FIXED,1000";
    const p = await D(await preview("vouchers", csv));
    expect(p.counts.willCreate).toBe(1);
    expect(p.counts.willError).toBe(1); // thiếu name
    expect(p.results[1].errors.join()).toContain("Tên voucher");
  });

  it("E: nhập tạo mới bản ghi", async () => {
    const u = await makeUser(LOY); await login(u.email);
    const csv = "code,name,minLifetimeSpend,pointsPerThousand\nSTD,Thường,0,1\nVIP,VIP,5000000,2";
    const r = await D(await doImport("membership-tiers", csv));
    expect(r.created).toBe(2);
    expect(await prisma.membershipTier.count()).toBe(2);
    expect(Number((await prisma.membershipTier.findUnique({ where: { code: "VIP" } }))!.pointsPerThousand)).toBe(2);
  });

  it("F+G: nhập lần 2 → UPDATE theo mã (không tạo trùng, không xóa cái khác)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    await prisma.membershipTier.create({ data: { code: "STD", name: "Thường", pointsPerThousand: 1 as any } });
    await prisma.membershipTier.create({ data: { code: "KEEP", name: "Giữ nguyên" } }); // không có trong file
    const csv = "code,name,pointsPerThousand\nSTD,Thường mới,3";
    const r = await D(await doImport("membership-tiers", csv));
    expect(r.updated).toBe(1);
    expect(r.created).toBe(0);
    const std = await prisma.membershipTier.findUnique({ where: { code: "STD" } });
    expect(std!.name).toBe("Thường mới");
    expect(Number(std!.pointsPerThousand)).toBe(3);
    expect(await prisma.membershipTier.findUnique({ where: { code: "KEEP" } })).not.toBeNull(); // KHÔNG bị xóa
  });

  it("H: enum sai → lỗi (không nhập)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    const csv = "code,name,type,value\nX,x,GIAMGIA,100";
    const p = await D(await preview("vouchers", csv));
    expect(p.counts.willError).toBe(1);
    expect(p.results[0].errors.join()).toContain("Loại");
  });

  it("I: FK theo MÃ (categoryCode → categoryId) — resolve đúng + báo lỗi mã sai", async () => {
    const u = await makeUser(SVC); await login(u.email);
    await prisma.serviceCategory.create({ data: { code: "NHOM-RF", name: "Nhóm RF" } });
    const okCsv = "code,name,categoryCode,standardPrice,status\nDV-X,Dịch vụ X,NHOM-RF,500000,ACTIVE";
    const r = await D(await doImport("services", okCsv));
    expect(r.created).toBe(1);
    const svc = await prisma.service.findUnique({ where: { code: "DV-X" }, include: { category: true } });
    expect(svc!.category!.code).toBe("NHOM-RF");
    expect(svc!.isActive).toBe(true); // transform status→isActive
    // mã nhóm không tồn tại → lỗi
    const badCsv = "code,name,categoryCode\nDV-Y,Dịch vụ Y,KHONG-CO";
    const p = await D(await preview("services", badCsv));
    expect(p.counts.willError).toBe(1);
    expect(p.results[0].errors.join()).toContain("Mã nhóm");
  });

  it("J: xuất rồi nhập lại (round-trip) giữ nguyên dữ liệu; date + số parse đúng", async () => {
    const u = await makeUser(LOY); await login(u.email);
    await prisma.voucher.create({ data: { code: "RT", name: "Round trip", type: "PERCENT", value: 20 as any, maxDiscount: 300000 as any, expiresAt: new Date("2026-12-31T00:00:00Z") } });
    const csv = (await (await exportCsv("vouchers")).text()).replace(/^﻿/, "");
    await prisma.voucher.deleteMany({});
    const r = await D(await doImport("vouchers", csv));
    expect(r.created).toBe(1);
    const v = await prisma.voucher.findUnique({ where: { code: "RT" } });
    expect(Number(v!.value)).toBe(20);
    expect(Number(v!.maxDiscount)).toBe(300000);
    expect(v!.expiresAt?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("DATA-IO · RBAC (K–L)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("K: chỉ đọc → xuất được, NHẬP bị chặn 403", async () => {
    const u = await makeUser([PERMISSIONS.LOYALTY_READ]); await login(u.email);
    expect((await exportCsv("membership-tiers")).status).toBe(200);
    expect((await preview("membership-tiers", "code,name\nA,B")).status).toBe(403);
    expect((await doImport("membership-tiers", "code,name\nA,B")).status).toBe(403);
    // dataset chỉ hiện canWrite=false
    const rows = await D(await listDs());
    expect(rows.find((r: any) => r.key === "membership-tiers").canWrite).toBe(false);
  });

  it("L: không có quyền đọc dataset → 403; ẩn danh → 401", async () => {
    const u = await makeUser([PERMISSIONS.TREATMENT_READ]); await login(u.email);
    expect((await exportCsv("employees")).status).toBe(403); // không staff.read
    jar.clear();
    expect((await exportCsv("membership-tiers")).status).toBe(401);
  });
});

describe("DATA-IO · Tiêu đề TIẾNG VIỆT + mục nhập liệu bổ sung (M–P)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("M: tiêu đề XUẤT là tiếng Việt + NHẬP theo tiêu đề tiếng Việt (round-trip)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    await prisma.membershipTier.create({ data: { code: "VIP", name: "VIP", pointsPerThousand: 2 as any } });
    const text = (await (await exportCsv("membership-tiers")).text()).replace(/^﻿/, "");
    const head = text.split("\n")[0];
    expect(head).toContain("Mã"); expect(head).toContain("Tên hạng"); expect(head).toContain("Chiết khấu (%)");
    expect(head).not.toContain("pointsPerThousand"); // KHÔNG lộ tên field tiếng Anh ở tiêu đề
    // nhập lại bằng CHÍNH tiêu đề tiếng Việt (round-trip)
    await prisma.membershipTier.deleteMany({});
    const r = await D(await doImport("membership-tiers", text));
    expect(r.created).toBe(1);
    expect((await prisma.membershipTier.findUnique({ where: { code: "VIP" } }))!.name).toBe("VIP");
  });

  it("N: NHẬP chấp nhận tiêu đề tiếng Việt HOẶC tên field tiếng Anh (alias tương thích)", async () => {
    const u = await makeUser(LOY); await login(u.email);
    // tiếng Việt
    const vi = await D(await doImport("membership-tiers", "Mã,Tên hạng,Điểm/1.000đ\nA,Hạng A,2"));
    expect(vi.created).toBe(1);
    // tiếng Anh (file cũ) vẫn chạy
    const en = await D(await doImport("membership-tiers", "code,name,pointsPerThousand\nB,Hạng B,3"));
    expect(en.created).toBe(1);
    expect(Number((await prisma.membershipTier.findUnique({ where: { code: "A" } }))!.pointsPerThousand)).toBe(2);
    expect(Number((await prisma.membershipTier.findUnique({ where: { code: "B" } }))!.pointsPerThousand)).toBe(3);
  });

  it("O: mục nhập liệu BỔ SUNG — Chi nhánh (branches) xuất + nhập theo mã", async () => {
    const u = await makeUser([PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE]); await login(u.email);
    const rows = await D(await listDs());
    expect(rows.map((r: any) => r.key)).toContain("branches");
    // nhập chi nhánh mới bằng tiêu đề tiếng Việt
    const r = await D(await doImport("branches", "Mã,Tên chi nhánh,Địa chỉ\nCN-01,Cơ sở 1,123 Lê Lợi"));
    expect(r.created).toBe(1);
    const b = await prisma.branch.findUnique({ where: { code: "CN-01" } });
    expect(b!.name).toBe("Cơ sở 1"); expect(b!.address).toBe("123 Lê Lợi");
  });

  it("P: mục nhập liệu BỔ SUNG — Hướng dẫn chăm sóc (care-instructions) + Chiến dịch marketing", async () => {
    const u = await makeUser([PERMISSIONS.LIBRARY_READ, PERMISSIONS.CARE_WRITE, PERMISSIONS.MARKETING_READ, PERMISSIONS.MARKETING_WRITE]); await login(u.email);
    const keys = (await D(await listDs())).map((r: any) => r.key);
    expect(keys).toContain("care-instructions");
    expect(keys).toContain("marketing-campaigns");
    const care = await D(await doImport("care-instructions", "Mã,Tiêu đề,Loại,Nội dung\nHD-01,Chăm sóc sau laser,POST_CARE,Tránh nắng 7 ngày"));
    expect(care.created).toBe(1);
    expect((await prisma.careInstruction.findUnique({ where: { code: "HD-01" } }))!.kind).toBe("POST_CARE");
    const mk = await D(await doImport("marketing-campaigns", "Mã,Tên chiến dịch,Kênh,Ngân sách\nMK-01,Hè 2026,Facebook,50000000"));
    expect(mk.created).toBe(1);
    expect(Number((await prisma.marketingCampaign.findUnique({ where: { code: "MK-01" } }))!.budget)).toBe(50000000);
  });

  it("Q: Protocol dịch vụ theo BƯỚC (nested) — nhập nhiều dòng/1 protocol → gom thành steps.items", async () => {
    const u = await makeUser([PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE]); await login(u.email);
    const keys = (await D(await listDs())).map((r: any) => r.key);
    expect(keys).toContain("protocol-steps");
    // 3 dòng cùng 1 mã protocol → 1 BrandProtocol có 3 bước (group/name/purpose)
    const csv = [
      "Mã protocol,Tên protocol,Bước,Tên trị liệu,Mục đích",
      "PRO-ACNE,Trị liệu da mụn,Detox,Sebum Soak,Tan dầu",
      "PRO-ACNE,Trị liệu da mụn,Trị liệu bề mặt,Prozyme,Da nhiều dầu dày sừng",
      "PRO-ACNE,Trị liệu da mụn,Phục hồi,Enzyme 1,Giảm sưng nề",
    ].join("\n");
    const r = await D(await doImport("protocol-steps", csv));
    expect(r.created).toBe(1);
    const p = await prisma.brandProtocol.findUnique({ where: { code: "PRO-ACNE" } });
    expect(p!.name).toBe("Trị liệu da mụn");
    const items = (p!.steps as any).items;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ group: "Detox", name: "Sebum Soak", purpose: "Tan dầu" });
    expect(items[2].name).toBe("Enzyme 1");
  });

  it("R: nested protocol — XUẤT ra dòng/bước + nhập lại (round-trip) UPDATE thay toàn bộ bước", async () => {
    const u = await makeUser([PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE]); await login(u.email);
    await prisma.brandProtocol.create({ data: { code: "PRO-AGE", name: "Lão hóa", kind: "BRAND", status: "ACTIVE", compositionMode: "LEGACY_STEPS", steps: { items: [{ group: "Detox", name: "Sebum Soak", purpose: "Mở kênh dẫn" }, { group: "Bề mặt", name: "RP", purpose: "Nhăn sâu" }] } } as any });
    const text = (await (await exportCsv("protocol-steps")).text()).replace(/^﻿/, "");
    expect(text.split("\n")[0]).toContain("Mã protocol"); // tiêu đề tiếng Việt
    expect(text).toContain("PRO-AGE"); expect(text).toContain("RP");
    // nhập lại (chỉ 1 bước) → UPDATE thay toàn bộ steps (còn 1 bước)
    const r = await D(await doImport("protocol-steps", "Mã protocol,Tên protocol,Bước,Tên trị liệu,Mục đích\nPRO-AGE,Lão hóa,Bề mặt,Quick Peel,Da khỏe"));
    expect(r.updated).toBe(1); expect(r.created).toBe(0);
    const items = (await prisma.brandProtocol.findUnique({ where: { code: "PRO-AGE" } }))!.steps as any;
    expect(items.items).toHaveLength(1);
    expect(items.items[0].name).toBe("Quick Peel");
  });
});
