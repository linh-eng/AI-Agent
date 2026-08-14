// =============================================================================
// Mục 7 — Kiểm tra 2 bằng chứng cuối: WORKFLOW BÁN DƯỚI GIÁ SÀN (chốt báo giá) +
// AUDIT/SNAPSHOT khi duyệt. Chạy ROUTE HANDLER THẬT của Next qua cookie phiên →
// đi qua toàn bộ RBAC (requirePermission) + service + Prisma trên Postgres thật.
//   A) User KHÔNG có pricefloor.override → backend BLOCK (không chỉ ẩn UI).
//   B) User CÓ quyền → phải nhập lý do → duyệt → lưu BelowFloorApproval snapshot +
//      audit_logs BELOW_FLOOR_APPROVED (đủ trường truy vết).
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => { const v = jar.get(name); return v === undefined ? undefined : { name, value: v }; },
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
  }),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { resetDb, uniq } from "./helpers";
import { createFloorVersion, transitionFloorVersion } from "@/lib/price-floor-service";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { POST as acceptProposal } from "@/app/api/proposals/[id]/accept/route";

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function readJson(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }

async function makeStaff(permCodes: string[]) {
  const email = `${uniq("staff")}@thng.com.vn`.toLowerCase();
  const password = "matkhau123";
  const user = await prisma.user.create({ data: { email, name: "NV " + uniq("n"), passwordHash: await hashPassword(password) } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "Role Test" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of permCodes) {
    const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  return { email, password };
}
async function login(email: string, password: string) {
  jar.clear();
  await staffLogin(jsonRequest("http://t/api/auth/login", "POST", { email, password }, { "x-forwarded-for": "10.0.0.9" }), {});
  return jar.get(SESSION_COOKIE);
}

// RF nâng cơ mặt với giá sàn ACTIVE = 1.715.000 (giá vốn 1.200.000, biên 30%).
async function makeRfWithFloor() {
  const svc = await prisma.service.create({ data: { code: uniq("DV-RF"), name: "RF nâng cơ mặt", standardPrice: 1_800_000, durationMinutes: 45 } });
  const v = await createFloorVersion({
    serviceId: svc.id, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000, createdBy: "QL",
    lines: [
      { category: "MATERIAL", name: "Gel dẫn RF", quantity: 1, unitCost: 350_000, calcType: "FIXED" },
      { category: "STAFF", name: "KTV", quantity: 1, unitCost: 400_000, calcType: "FIXED" },
      { category: "MACHINE", name: "Máy RF", calcType: "PER_SESSION", calcValue: 300_000 },
      { category: "OPERATION", name: "Vận hành", calcType: "FIXED", calcValue: 100_000 },
      { category: "OTHER", name: "Khác", quantity: 1, unitCost: 50_000, calcType: "FIXED" },
    ],
  });
  await transitionFloorVersion(v.id, "submit", { canApprove: true });
  await transitionFloorVersion(v.id, "approve", { actor: "QL", canApprove: true });
  await transitionFloorVersion(v.id, "activate", { actor: "QL", canApprove: true });
  return { svc, floor: Number((await prisma.servicePriceFloorVersion.findUniqueOrThrow({ where: { id: v.id } })).floorPrice) };
}

// Báo giá 1 phương án RF: giá niêm yết 1.800.000, sẽ chốt 1.600.000 (dưới sàn).
async function makeRfProposal(serviceId: string) {
  const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Khách RF" } });
  const prop = await prisma.treatmentProposal.create({
    data: {
      code: uniq("PROP"), customerId: cust.id, title: "Báo giá RF", status: "SENT",
      options: { create: [{ kind: "RECOMMENDED", name: "Gói RF", orderIndex: 0, items: { create: [{ itemType: "SERVICE", refId: serviceId, name: "RF nâng cơ mặt", quantity: 1, unitPrice: 1_800_000, orderIndex: 0 }] } }] },
    },
    include: { options: { include: { items: true } } },
  });
  return { prop, optionId: prop.options[0].id };
}

describe("Mục 7 · Bán dưới giá sàn — block / approve / snapshot / audit", () => {
  beforeAll(async () => { await resetDb(); });
  beforeEach(() => { jar.clear(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("A) User KHÔNG quyền duyệt → backend BLOCK (409 chưa xác nhận; 403 dù allowBelowFloor)", async () => {
    const { svc, floor } = await makeRfWithFloor();
    expect(floor).toBe(1_715_000);
    const { prop, optionId } = await makeRfProposal(svc.id);
    const staff = await makeStaff(["proposal.accept", "finance.read"]); // KHÔNG có pricefloor.override
    await login(staff.email, staff.password);

    // Không gửi allowBelowFloor → 409 kèm chi tiết giá sàn (cảnh báo, chưa chốt).
    const r1 = await acceptProposal(jsonRequest("http://t/accept", "POST", { optionId, agreedPrice: 1_600_000, priceAdjustReason: "Khách quen" }), { params: { id: prop.id } });
    expect(r1.status).toBe(409);
    const j1 = await readJson(r1);
    expect(j1.details.priceFloor.floorTotal).toBe(1_715_000);
    expect(j1.details.priceFloor.canOverride).toBe(false);

    // Cố tình bỏ qua (allowBelowFloor=true) nhưng THIẾU quyền → 403 (không silently bypass).
    const r2 = await acceptProposal(jsonRequest("http://t/accept", "POST", { optionId, agreedPrice: 1_600_000, allowBelowFloor: true, priceAdjustReason: "Khách quen" }), { params: { id: prop.id } });
    expect(r2.status).toBe(403);

    // Báo giá VẪN chưa chốt (không bị bypass).
    const after = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: prop.id } });
    expect(after.status).toBe("SENT");
    expect(await prisma.belowFloorApproval.count({ where: { proposalId: prop.id } })).toBe(0);
  });

  it("B) User CÓ quyền: thiếu lý do → 422; có lý do → chốt + SNAPSHOT + AUDIT đầy đủ", async () => {
    const { svc } = await makeRfWithFloor();
    const { prop, optionId } = await makeRfProposal(svc.id);
    const staff = await makeStaff(["proposal.accept", "pricefloor.override", "finance.read"]);
    await login(staff.email, staff.password);

    // Bấm duyệt nhưng THIẾU lý do → 422 (bắt buộc nhập lý do).
    const rNoReason = await acceptProposal(jsonRequest("http://t/accept", "POST", { optionId, agreedPrice: 1_600_000, allowBelowFloor: true }), { params: { id: prop.id } });
    expect(rNoReason.status).toBe(422);

    // Có lý do → chốt thành công.
    const ok = await acceptProposal(jsonRequest("http://t/accept", "POST", { optionId, agreedPrice: 1_600_000, allowBelowFloor: true, priceAdjustReason: "Khách VIP lâu năm, duyệt giảm dưới sàn" }), { params: { id: prop.id } });
    expect(ok.status).toBe(200);
    const afterProp = await prisma.treatmentProposal.findUniqueOrThrow({ where: { id: prop.id } });
    expect(afterProp.status).toBe("ACCEPTED");
    expect(Number(afterProp.agreedPrice)).toBe(1_600_000);

    // --- SNAPSHOT bản ghi duyệt dưới sàn (đủ trường truy vết) ---
    const appr = await prisma.belowFloorApproval.findFirstOrThrow({ where: { proposalId: prop.id } });
    expect(appr.context).toBe("PROPOSAL");
    expect(appr.serviceId).toBe(svc.id); // Dịch vụ
    expect(Number(appr.floorPrice)).toBe(1_715_000); // Giá sàn snapshot
    expect(Number(appr.actualPrice)).toBe(1_600_000); // Giá bán thực tế
    expect(Number(appr.standardPrice)).toBe(1_800_000); // Giá chuẩn (giá niêm yết phương án)
    expect(Number(appr.belowAmount)).toBe(115_000); // thấp hơn sàn
    expect(Number(appr.belowPercent)).toBeCloseTo(6.71, 1); // % dưới sàn
    expect(appr.approvedBy).toBeTruthy(); // Người duyệt
    expect(appr.approvedAt).toBeInstanceOf(Date); // Thời điểm
    expect(appr.reason).toBe("Khách VIP lâu năm, duyệt giảm dưới sàn"); // Lý do

    // --- AUDIT LOG (không chỉ badge) ---
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BELOW_FLOOR_APPROVED", entityId: prop.id } });
    expect((audit.changes as any).floorTotal).toBe(1_715_000);
    expect((audit.changes as any).agreedPrice).toBe(1_600_000);
    expect((audit.changes as any).reason).toBe("Khách VIP lâu năm, duyệt giảm dưới sàn");
    expect(audit.createdAt).toBeInstanceOf(Date);
  });

  it("SNAPSHOT bất biến: đổi giá sàn (version mới) sau khi duyệt KHÔNG đổi bản ghi cũ", async () => {
    const { svc } = await makeRfWithFloor();
    const { prop, optionId } = await makeRfProposal(svc.id);
    const staff = await makeStaff(["proposal.accept", "pricefloor.override", "finance.read"]);
    await login(staff.email, staff.password);
    await acceptProposal(jsonRequest("http://t/accept", "POST", { optionId, agreedPrice: 1_600_000, allowBelowFloor: true, priceAdjustReason: "duyệt" }), { params: { id: prop.id } });
    const before = Number((await prisma.belowFloorApproval.findFirstOrThrow({ where: { proposalId: prop.id } })).floorPrice);

    // Tạo version giá sàn mới (giá sàn thay đổi mạnh) + áp dụng.
    const v2 = await createFloorVersion({ serviceId: svc.id, minMarginPercent: 30, changeReason: "cost tăng mạnh", lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 5_000_000, calcType: "FIXED" }] });
    await transitionFloorVersion(v2.id, "submit", { canApprove: true });
    await transitionFloorVersion(v2.id, "approve", { actor: "QL", canApprove: true });
    await transitionFloorVersion(v2.id, "activate", { actor: "QL", canApprove: true });

    const after = Number((await prisma.belowFloorApproval.findFirstOrThrow({ where: { proposalId: prop.id } })).floorPrice);
    expect(after).toBe(before); // snapshot 1.715.000 KHÔNG đổi
    expect(after).toBe(1_715_000);
  });
});
