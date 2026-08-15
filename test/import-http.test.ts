// Mục 12 — RBAC backend cho import (gọi route thật; thiếu quyền → 403).
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
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as previewPost } from "@/app/api/imports/customers/preview/route";
import { POST as commitPost } from "@/app/api/imports/customers/commit/route";

let ip = 0;
function jr(url: string, body?: unknown) { return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  return { email };
}
async function login(email: string) { jar.clear(); await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {}); return jar.get(SESSION_COOKIE); }

beforeAll(async () => { await resetDb(); });
beforeEach(() => { jar.clear(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Mục 12 · RBAC import (backend)", () => {
  const rows = [{ fullName: "KH Import", phone: "0902220001" }];
  it("L · ẩn danh → 401; thiếu customer.write → 403; có quyền → 200", async () => {
    expect((await commitPost(jr("http://t/api/imports/customers/commit", { legacySource: "MySpa", rows }), {})).status).toBe(401);

    const reader = await makeStaff([PERMISSIONS.CUSTOMER_READ]);
    await login(reader.email);
    expect((await previewPost(jr("http://t/api/imports/customers/preview", { legacySource: "MySpa", rows }), {})).status).toBe(403);
    expect((await commitPost(jr("http://t/api/imports/customers/commit", { legacySource: "MySpa", rows }), {})).status).toBe(403);

    const importer = await makeStaff([PERMISSIONS.CUSTOMER_READ, PERMISSIONS.CUSTOMER_WRITE]);
    await login(importer.email);
    const prev = await previewPost(jr("http://t/api/imports/customers/preview", { legacySource: "MySpa", rows }), {});
    expect(prev.status).toBe(200);
    const commit = await commitPost(jr("http://t/api/imports/customers/commit", { legacySource: "MySpa", filename: "test.csv", mapping: { fullName: "Ho ten" }, rows }), {});
    expect(commit.status).toBe(200);
    const rep = (await rj(commit)).data;
    expect(rep.created).toBe(1);
    // ImportBatch có mapping + filename
    const batch = await prisma.importBatch.findUnique({ where: { code: rep.batchCode } });
    expect(batch!.filename).toBe("test.csv");
    expect((batch!.mapping as any).fullName).toBe("Ho ten");
  });
});
