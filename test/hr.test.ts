import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq, makeCustomer, makePlanWithSession } from "./helpers";
import { maskFinance, canSeeFinance } from "@/lib/clinic";
import { PERMISSIONS } from "@/lib/rbac";

async function employee(roles: string[], fee?: number) {
  return prisma.employee.create({
    data: { code: uniq("NV"), fullName: "NV " + uniq("n"), roles, defaultFee: fee ?? null },
  });
}

describe("HR — nhân sự đa vai trò + fee theo buổi (mục 22–24)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("một nhân sự giữ NHIỀU vai trò", async () => {
    const e = await employee(["Kỹ thuật viên", "Master", "CSKH"]);
    expect(e.roles).toHaveLength(3);
    expect(e.roles).toContain("Master");
  });

  it("gán nhiều nhân sự cho một buổi với vai trò + phí; tổng phí đúng", async () => {
    const c = await makeCustomer();
    const { session } = await makePlanWithSession(c.id);
    const e1 = await employee(["Kỹ thuật viên"], 200_000);
    const e2 = await employee(["Master"], 500_000);
    await prisma.sessionStaff.create({ data: { sessionId: session.id, employeeId: e1.id, staffName: e1.fullName, role: "PRIMARY", fee: 200_000 } });
    await prisma.sessionStaff.create({ data: { sessionId: session.id, employeeId: e2.id, staffName: e2.fullName, role: "MASTER", fee: 500_000 } });

    const rows = await prisma.sessionStaff.findMany({ where: { sessionId: session.id } });
    expect(rows).toHaveLength(2);
    const total = rows.reduce((s, r) => s + Number(r.fee ?? 0), 0);
    expect(total).toBe(700_000);
    expect(rows.map((r) => r.role).sort()).toEqual(["MASTER", "PRIMARY"]);
  });

  it("phí nhân sự bị mask khi KHÔNG có finance.read", async () => {
    const e = await employee(["Kỹ thuật viên"], 300_000);
    const noFinance = { permissions: [PERMISSIONS.HR_READ] } as any;
    const withFinance = { permissions: [PERMISSIONS.HR_READ, PERMISSIONS.FINANCE_READ] } as any;
    expect(canSeeFinance(noFinance)).toBe(false);
    const masked = maskFinance(e, canSeeFinance(noFinance), ["defaultFee"]);
    expect(masked.defaultFee).toBeNull();
    const unmasked = maskFinance(e, canSeeFinance(withFinance), ["defaultFee"]);
    expect(Number(unmasked.defaultFee)).toBe(300_000);
  });

  it("xóa buổi → xóa luôn phân công nhân sự (cascade)", async () => {
    const c = await makeCustomer();
    const { session } = await makePlanWithSession(c.id);
    const e = await employee(["Kỹ thuật viên"], 100_000);
    await prisma.sessionStaff.create({ data: { sessionId: session.id, employeeId: e.id, staffName: e.fullName, role: "PRIMARY", fee: 100_000 } });
    await prisma.treatmentSession.delete({ where: { id: session.id } });
    const rows = await prisma.sessionStaff.findMany({ where: { sessionId: session.id } });
    expect(rows).toHaveLength(0);
    // nhân sự vẫn còn (chỉ gỡ liên kết)
    expect(await prisma.employee.findUnique({ where: { id: e.id } })).not.toBeNull();
  });
});
