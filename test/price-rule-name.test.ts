// =============================================================================
// Bảng giá — hiển thị TÊN dịch vụ thay vì id thô khi PriceRule thiếu targetName.
// GET /api/price-rules enrich targetName từ thực thể đích (Service/Product/...).
// HTTP thật trên Postgres.
// =============================================================================
import { describe, it, expect, beforeAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => { const v = jar.get(n); return v === undefined ? undefined : { name: n, value: v }; },
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { GET as prListRaw } from "@/app/api/price-rules/route";
const prList = (r: Request) => prListRaw(r, {} as any);

function req(url: string, method: string) {
  return new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.4.9" } });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("pr")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "NV Giá", passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) { const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } }); }
  return email;
}
async function login(email: string) {
  jar.clear();
  const { POST: staffLogin } = await import("@/app/api/auth/login/route");
  const r = new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.4.9" }, body: JSON.stringify({ email, password: "matkhau123" }) });
  await staffLogin(r, {} as any);
  return jar.get(SESSION_COOKIE)!;
}

let token = ""; let svcId = ""; let catId = "";

beforeAll(async () => {
  await resetDb();
  token = await login(await makeStaff(["price.read", "price.write"]));
  const cat = await prisma.serviceCategory.create({ data: { code: uniq("CAT"), name: "Nhóm test giá" } });
  catId = cat.id;
  const svc = await prisma.service.create({ data: { code: uniq("SV"), name: "Dịch vụ Có Tên", categoryId: catId, standardPrice: 1_000_000 } });
  svcId = svc.id;
  // Rule KHÔNG có targetName (mô phỏng bug cũ)
  await prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: svcId, priceType: "VIP", price: 800_000, isActive: true, createdBy: "seed" } });
  // Rule CÓ targetName (giữ nguyên)
  await prisma.priceRule.create({ data: { targetType: "SERVICE", targetId: svcId, targetName: "Tên đã lưu", priceType: "STANDARD", price: 1_000_000, isActive: true, createdBy: "seed" } });
});

describe("PriceRule name resolution", () => {
  it("rule thiếu targetName → enrich thành tên dịch vụ (không hiện id thô)", async () => {
    jar.clear(); jar.set(SESSION_COOKIE, token);
    const res = await prList(req(`http://t/api/price-rules?targetId=${svcId}`, "GET"));
    expect(res.status).toBe(200);
    const rows = (await readJson(res)).data;
    const vip = rows.find((r: any) => r.priceType === "VIP");
    const std = rows.find((r: any) => r.priceType === "STANDARD");
    expect(vip.targetName).toBe("Dịch vụ Có Tên"); // giải từ Service
    expect(vip.targetName).not.toBe(svcId); // KHÔNG phải id thô
    expect(std.targetName).toBe("Tên đã lưu"); // rule có tên: giữ nguyên
  });
});
