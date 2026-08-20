// =============================================================================
// KÊ TOA SAU THỰC HIỆN — tạo toa (DRAFT) → kê (ISSUED, ghi timeline khách) → khóa
// bất biến; hủy có lý do; RBAC (treatment.write để kê, customer.read để xem).
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
import { GET as listRx, POST as createRx } from "@/app/api/prescriptions/route";
import { GET as getRx, PATCH as patchRx } from "@/app/api/prescriptions/[id]/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[]) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "KTV " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email, name: user.name };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.95.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const create = (b: unknown) => createRx(new Request("http://t/x", J(b)), {} as any);
const list = (qs = "") => listRx(new Request(`http://t/x${qs}`), {} as any);
const patch = (id: string, b: unknown) => patchRx(new Request("http://t/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), { params: { id } } as any);
const get = (id: string) => getRx(new Request("http://t/x"), { params: { id } } as any);

const RXW = [PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.CUSTOMER_READ];

async function mkCustomer() { return prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH Toa", isActive: true } }); }

describe("Kê toa sau thực hiện", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A: tạo toa DRAFT với sản phẩm → sinh mã KT + lưu item", async () => {
    const u = await makeUser(RXW); await login(u.email);
    const c = await mkCustomer();
    const r = await D(await create({ customerId: c.id, diagnosis: "Da dầu mụn", advice: "Tránh nắng", items: [
      { name: "Sữa rửa mặt DMK", quantity: 1, unit: "chai", frequency: "2 lần/ngày", timing: "Sáng/Tối", durationDays: 30 },
      { name: "Kem chống nắng", frequency: "mỗi sáng" },
    ] }));
    expect(r.code).toMatch(/^KT-/);
    expect(r.status).toBe("DRAFT");
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ name: "Sữa rửa mặt DMK", frequency: "2 lần/ngày", durationDays: 30, sortOrder: 0 });
  });

  it("B: kê toa (issue) → ISSUED + ghi timeline khách (CrmActivity AFTERCARE)", async () => {
    const u = await makeUser(RXW); await login(u.email);
    const c = await mkCustomer();
    const p = await D(await create({ customerId: c.id, items: [{ name: "Serum" }] }));
    const r = await D(await patch(p.id, { action: "issue" }));
    expect(r.status).toBe("ISSUED");
    expect(r.issuedAt).toBeTruthy();
    const acts = await prisma.crmActivity.findMany({ where: { customerId: c.id, type: "AFTERCARE" } });
    expect(acts.length).toBe(1);
    expect(acts[0].content).toContain(p.code);
    expect(acts[0].content).toContain("Serum");
  });

  it("C: kê lại toa đã ISSUED → 409; sửa toa đã kê → 409 (bất biến)", async () => {
    const u = await makeUser(RXW); await login(u.email);
    const c = await mkCustomer();
    const p = await D(await create({ customerId: c.id, items: [{ name: "A" }] }));
    await patch(p.id, { action: "issue" });
    expect((await patch(p.id, { action: "issue" })).status).toBe(409);
    expect((await patch(p.id, { items: [{ name: "B" }] })).status).toBe(409);
  });

  it("D: hủy thiếu lý do → 422; có lý do → CANCELLED", async () => {
    const u = await makeUser(RXW); await login(u.email);
    const c = await mkCustomer();
    const p = await D(await create({ customerId: c.id, items: [{ name: "A" }] }));
    expect((await patch(p.id, { action: "cancel" })).status).toBe(422);
    const r = await D(await patch(p.id, { action: "cancel", cancelReason: "kê nhầm khách" }));
    expect(r.status).toBe("CANCELLED");
    expect(r.cancelReason).toBe("kê nhầm khách");
  });

  it("E: sửa nội dung khi còn DRAFT (thay toàn bộ item) + lọc theo khách", async () => {
    const u = await makeUser(RXW); await login(u.email);
    const c = await mkCustomer();
    const p = await D(await create({ customerId: c.id, items: [{ name: "Cũ 1" }, { name: "Cũ 2" }] }));
    const r = await D(await patch(p.id, { advice: "Uống đủ nước", items: [{ name: "Mới" }] }));
    expect(r.advice).toBe("Uống đủ nước");
    expect(r.items).toHaveLength(1);
    expect(r.items[0].name).toBe("Mới");
    const listed = await D(await list(`?customerId=${c.id}`));
    expect(listed.length).toBe(1);
  });

  it("F: RBAC — tạo cần treatment.write (403); GET cần customer.read; ẩn danh 401", async () => {
    const c = await mkCustomer();
    // chỉ customer.read → tạo 403
    const reader = await makeUser([PERMISSIONS.CUSTOMER_READ]); await login(reader.email);
    expect((await create({ customerId: c.id, items: [{ name: "X" }] })).status).toBe(403);
    // ẩn danh → 401
    jar.clear();
    expect((await list()).status).toBe(401);
  });
});
