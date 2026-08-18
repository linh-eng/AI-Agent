// =============================================================================
// HR-PH5 — Compensation (policy · sales commission · treatment incentive · KPI
// bonus). Chứng minh A–AS.
//   Policy A–G · Attribution H–M · Sales commission N–U · Treatment incentive
//   V–AC · Package AD–AF · KPI bonus AG–AL · RBAC/Self AM–AS.
// Chỉ PUBLISHED sinh tiền · collected-cash · contribution-source · locked+VERIFIED
// KPI · idempotent · reversal · KHÔNG EmployeeRoleFee/Booking/finance.read.
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
import { POST as policyCreate, GET as policyList } from "@/app/api/compensation-policies/route";
import { GET as policyGet } from "@/app/api/compensation-policies/[id]/route";
import { POST as versionCreate } from "@/app/api/compensation-policy-versions/route";
import { POST as publishRaw } from "@/app/api/compensation-policy-versions/[id]/publish/route";
import { POST as commRuleCreate } from "@/app/api/commission-rules/route";
import { POST as incRuleCreate } from "@/app/api/treatment-incentive-rules/route";
import { POST as kpiRuleCreate } from "@/app/api/kpi-bonus-rules/route";
import { POST as attrCreate, GET as attrList } from "@/app/api/sales-attributions/route";
import { POST as generateRaw } from "@/app/api/compensation/generate/route";
import { GET as eventsList } from "@/app/api/compensation-events/route";

let ip = 0;
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const D = async (res: Response) => { const j = await rj(res); return j && "data" in j ? j.data : j; };
async function makeUser(perms: string[], over: { linkEmployeeId?: string } = {}) {
  const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: "U " + uniq("n"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("ROLE"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const c of perms) { const p = await prisma.permission.upsert({ where: { code: c }, update: {}, create: { code: c } }); await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }); }
  if (over.linkEmployeeId) await prisma.employee.update({ where: { id: over.linkEmployeeId }, data: { userId: user.id } });
  return { email, userId: user.id };
}
async function login(email: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.75.0.${++ip}` }, body: JSON.stringify({ email, password: "matkhau123" }) }), {} as any);
}
const J = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

// wrappers
const createPolicy = (b: unknown) => policyCreate(new Request("http://t/api/compensation-policies", J(b)), {} as any);
const listPolicies = () => policyList(new Request("http://t/api/compensation-policies"), {} as any);
const getPolicy = (id: string) => policyGet(new Request("http://t/api/compensation-policies/" + id), { params: { id } } as any);
const createVersion = (b: unknown) => versionCreate(new Request("http://t/api/compensation-policy-versions", J(b)), {} as any);
const publish = (id: string) => publishRaw(new Request("http://t/api/compensation-policy-versions/" + id + "/publish", { method: "POST" }), { params: { id } } as any);
const addCommRule = (b: unknown) => commRuleCreate(new Request("http://t/api/commission-rules", J(b)), {} as any);
const addIncRule = (b: unknown) => incRuleCreate(new Request("http://t/api/treatment-incentive-rules", J(b)), {} as any);
const addKpiRule = (b: unknown) => kpiRuleCreate(new Request("http://t/api/kpi-bonus-rules", J(b)), {} as any);
const addAttr = (b: unknown) => attrCreate(new Request("http://t/api/sales-attributions", J(b)), {} as any);
const listAttr = (qs = "") => attrList(new Request("http://t/api/sales-attributions" + qs), {} as any);
const generate = (b: unknown) => generateRaw(new Request("http://t/api/compensation/generate", J(b)), {} as any);
const events = (qs = "") => eventsList(new Request("http://t/api/compensation-events" + qs), {} as any);

const WRITER = [PERMISSIONS.COMPENSATION_POLICY_READ, PERMISSIONS.COMPENSATION_POLICY_WRITE, PERMISSIONS.TREATMENT_WRITE];
async function boot() { const m = await makeUser(WRITER); await login(m.email); return m; }

// fact builders
async function mkEmp(over: { roles?: string[]; branchId?: string; title?: string; fullName?: string } = {}) {
  return prisma.employee.create({ data: { code: uniq("NV"), fullName: over.fullName ?? "NV " + uniq("x"), title: over.title ?? "KTV", status: "ACTIVE", isActive: true, roles: over.roles ?? [], branchId: over.branchId ?? null } });
}
async function mkSessionContrib(employeeId: string, over: { minutes?: number; weight?: number; typeCode?: string; role?: string; serviceId?: string; status?: string; entryKind?: string; branchId?: string } = {}) {
  const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
  const s = await prisma.treatmentSession.create({ data: { code: uniq("SS"), customerId: cust.id, sessionNumber: 1, status: "COMPLETED", performedAt: new Date(), executionFrozenAt: new Date() } });
  let serviceId = over.serviceId;
  let itemId: string | undefined;
  if (!serviceId) { const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "DV", standardPrice: 0 } }); serviceId = svc.id; }
  const item = await prisma.sessionExecutionItem.create({ data: { sessionId: s.id, serviceId, sortOrder: 0 } });
  itemId = item.id;
  const svcName = (await prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } }))!.name;
  const c = await prisma.sessionStaffContribution.create({ data: {
    treatmentSessionId: s.id, sessionExecutionItemId: itemId, employeeId, employeeNameSnapshot: "snap", employeeRoleSnapshot: over.role ?? "KTV",
    contributionTypeCode: over.typeCode ?? "PRIMARY_OPERATOR", actualMinutes: over.minutes ?? 45, weight: (over.weight ?? 1) as any,
    serviceIdSnapshot: serviceId, serviceNameSnapshot: svcName, status: (over.status as any) ?? "ACTIVE", entryKind: (over.entryKind as any) ?? "CONTRIBUTION", branchId: over.branchId ?? null,
  } });
  return { session: s, contrib: c, serviceId: serviceId!, itemId: itemId! };
}
async function mkPayment(over: { amount?: number; void?: boolean; customerId?: string } = {}) {
  const customerId = over.customerId ?? (await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } })).id;
  return prisma.payment.create({ data: { code: uniq("PT"), customerId, amount: (over.amount ?? 5_000_000) as any, method: "CASH", ...(over.void ? { voidedAt: new Date(), voidReason: "test" } : {}) } });
}
// tạo chính sách PUBLISHED + trả versionId (thêm rule qua callback trước publish)
async function publishedPolicy(scope: { scopeType?: string; branchId?: string; roleCode?: string; employeeId?: string }, addRules: (versionId: string) => Promise<void>) {
  const pol = await D(await createPolicy({ name: "CS " + uniq("p"), scopeType: scope.scopeType ?? "COMPANY", branchId: scope.branchId ?? null, roleCode: scope.roleCode ?? null, employeeId: scope.employeeId ?? null }));
  const versionId = pol.versions[0].id;
  // Backdate effectiveFrom để chính sách áp dụng cho mọi FACT trong test (thực tế
  // chính sách được publish TRƯỚC khi công việc phát sinh).
  await prisma.compensationPolicyVersion.update({ where: { id: versionId }, data: { effectiveFrom: new Date("2020-01-01T00:00:00Z") } });
  await addRules(versionId);
  await publish(versionId);
  return { policyId: pol.id, versionId };
}
async function evOf(employeeId: string, type?: string) {
  const rows = await D(await events(`?employeeId=${employeeId}${type ? `&eventType=${type}` : ""}`));
  return rows as any[];
}

describe("HR-PH5 · Policy (A–G)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("A+B: tạo DRAFT + publish → PUBLISHED bất biến (thêm rule vào PUBLISHED → 409)", async () => {
    await boot();
    const pol = await D(await createPolicy({ name: "CS A", scopeType: "COMPANY" }));
    const vId = pol.versions[0].id;
    expect(pol.versions[0].status).toBe("DRAFT");
    await addIncRule({ policyVersionId: vId, code: "R1", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 100000 });
    await publish(vId);
    const after = await prisma.compensationPolicyVersion.findUnique({ where: { id: vId } });
    expect(after!.status).toBe("PUBLISHED");
    expect(after!.sourceSnapshot).toBeTruthy();
    const r = await addIncRule({ policyVersionId: vId, code: "R2", fixedAmount: 1 });
    expect(r.status).toBe(409); // published bất biến
  });

  it("C: publish version mới supersede version cũ cùng policy (overlap)", async () => {
    await boot();
    const pol = await D(await createPolicy({ name: "CS C", scopeType: "COMPANY" }));
    await addIncRule({ policyVersionId: pol.versions[0].id, code: "R", contributionTypeCode: "PRIMARY_OPERATOR", fixedAmount: 100000 });
    await publish(pol.versions[0].id);
    const v2 = await D(await createVersion({ policyId: pol.id, effectiveFrom: "2026-01-01" }));
    await addIncRule({ policyVersionId: v2.id, code: "R", contributionTypeCode: "PRIMARY_OPERATOR", fixedAmount: 200000 });
    await publish(v2.id);
    const v1 = await prisma.compensationPolicyVersion.findUnique({ where: { id: pol.versions[0].id } });
    expect(v1!.status).toBe("SUPERSEDED");
    const pol2 = await D(await getPolicy(pol.id));
    expect(pol2.currentVersionId).toBe(v2.id);
  });

  it("E: precedence COMPANY→BRANCH→ROLE→EMPLOYEE (override thắng)", async () => {
    await boot();
    const br = await prisma.branch.create({ data: { code: uniq("CN"), name: "CN" } });
    const emp = await mkEmp({ roles: ["KTV"], branchId: br.id });
    for (const [scope, amt] of [
      [{ scopeType: "COMPANY" }, 100000], [{ scopeType: "BRANCH", branchId: br.id }, 200000],
      [{ scopeType: "ROLE", roleCode: "KTV" }, 300000], [{ scopeType: "EMPLOYEE", employeeId: emp.id }, 400000],
    ] as const) {
      await publishedPolicy(scope, async (vId) => { await addIncRule({ policyVersionId: vId, code: "R", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: amt }); });
    }
    const { session } = await mkSessionContrib(emp.id, { branchId: br.id });
    await generate({ type: "incentive", sessionId: session.id });
    const evs = await evOf(emp.id, "TREATMENT_INCENTIVE");
    expect(evs.length).toBe(1);
    expect(Number(evs[0].amount)).toBe(400000); // EMPLOYEE override thắng
  });

  it("F: hai policy EMPLOYEE cùng nhân sự, overlap → publish thứ 2 bị từ chối (409)", async () => {
    await boot();
    const emp = await mkEmp();
    await publishedPolicy({ scopeType: "EMPLOYEE", employeeId: emp.id }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "R", fixedAmount: 100000 }); });
    const pol2 = await D(await createPolicy({ name: "CS F2", scopeType: "EMPLOYEE", employeeId: emp.id }));
    await addIncRule({ policyVersionId: pol2.versions[0].id, code: "R", fixedAmount: 200000 });
    const r = await publish(pol2.versions[0].id);
    expect(r.status).toBe(409);
  });

  it("G: rule DRAFT (chưa publish) KHÔNG sinh tiền", async () => {
    await boot();
    const emp = await mkEmp();
    const pol = await D(await createPolicy({ name: "CS G", scopeType: "COMPANY" }));
    await addIncRule({ policyVersionId: pol.versions[0].id, code: "R", contributionTypeCode: "PRIMARY_OPERATOR", fixedAmount: 100000 });
    // KHÔNG publish
    const { session } = await mkSessionContrib(emp.id);
    await generate({ type: "incentive", sessionId: session.id });
    expect((await evOf(emp.id)).length).toBe(0);
  });
});

describe("HR-PH5 · Sales attribution (H–M)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("H+J+K: attribution FK tường minh + nhiều vai trò + weight lưu", async () => {
    await boot();
    const a = await mkEmp(); const b = await mkEmp();
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    await addAttr({ employeeId: a.id, sourceType: "CUSTOMER", sourceId: cust.id, attributionRole: "CLOSER", weight: 0.7 });
    await addAttr({ employeeId: b.id, sourceType: "CUSTOMER", sourceId: cust.id, attributionRole: "CONSULTANT", weight: 0.3 });
    const rows = await D(await listAttr(`?sourceType=CUSTOMER&sourceId=${cust.id}`));
    expect(rows.length).toBe(2);
    expect(rows.find((r: any) => r.attributionRole === "CLOSER").employeeId).toBe(a.id);
    expect(Number(rows.find((r: any) => r.attributionRole === "CONSULTANT").weight)).toBe(0.3);
  });

  it("M: nhân sự/nguồn sai → 422 (không tạo attribution mồ côi)", async () => {
    await boot();
    const r = await addAttr({ employeeId: "khong-ton-tai", sourceType: "CUSTOMER", sourceId: "x", attributionRole: "CLOSER" });
    expect(r.status).toBe(422);
  });

  it("L: legacy createdBy/receivedBy KHÔNG tự thành attribution (không suy tên)", async () => {
    await boot();
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    await mkPayment({ customerId: cust.id, amount: 5_000_000 }); // receivedBy null/legacy
    const rows = await D(await listAttr(`?sourceType=CUSTOMER&sourceId=${cust.id}`));
    expect(rows.length).toBe(0); // KHÔNG có attribution tự sinh
  });
});

describe("HR-PH5 · Sales commission (N–U)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function commissionPolicy(rate: number) {
    return publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addCommRule({ policyVersionId: vId, code: "SC", basisType: "COLLECTED_CASH", targetType: "ALL", ratePercent: rate }); });
  }

  it("N+U: tiền thực thu × % → hoa hồng + snapshot giải thích", async () => {
    await boot();
    const emp = await mkEmp();
    await commissionPolicy(3);
    const pay = await mkPayment({ amount: 5_000_000 });
    await addAttr({ employeeId: emp.id, sourceType: "CUSTOMER", sourceId: pay.customerId, attributionRole: "CLOSER", weight: 1 });
    await generate({ type: "commission", paymentId: pay.id });
    const evs = await evOf(emp.id, "SALES_COMMISSION");
    expect(evs.length).toBe(1);
    expect(Number(evs[0].amount)).toBe(150000); // 3% × 5m
    const cs = evs[0].calculationSnapshot;
    expect(cs.ratePercent).toBe(3); expect(cs.collectedCash).toBe(5000000);
  });

  it("O+P: thanh toán từng phần → hoa hồng từng phần; phiếu thu thứ 2 → event bổ sung", async () => {
    await boot();
    const emp = await mkEmp();
    await commissionPolicy(3);
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    await addAttr({ employeeId: emp.id, sourceType: "CUSTOMER", sourceId: cust.id, attributionRole: "CLOSER" });
    const p1 = await mkPayment({ customerId: cust.id, amount: 2_000_000 });
    const p2 = await mkPayment({ customerId: cust.id, amount: 3_000_000 });
    await generate({ type: "commission", paymentId: p1.id });
    await generate({ type: "commission", paymentId: p2.id });
    const evs = await evOf(emp.id, "SALES_COMMISSION");
    expect(evs.length).toBe(2);
    expect(evs.map((e: any) => Number(e.amount)).sort((a: number, b: number) => a - b)).toEqual([60000, 90000]);
  });

  it("Q: phiếu thu HỦY → hoa hồng bị đảo (compensating reversal, giữ gốc)", async () => {
    await boot();
    const emp = await mkEmp();
    await commissionPolicy(3);
    const pay = await mkPayment({ amount: 5_000_000 });
    await addAttr({ employeeId: emp.id, sourceType: "CUSTOMER", sourceId: pay.customerId, attributionRole: "CLOSER" });
    await generate({ type: "commission", paymentId: pay.id });
    await prisma.payment.update({ where: { id: pay.id }, data: { voidedAt: new Date(), voidReason: "hủy" } });
    await generate({ type: "commission", paymentId: pay.id }); // reconcile → reverse
    const all = await prisma.compensationEvent.findMany({ where: { employeeId: emp.id, sourceId: pay.id }, orderBy: { createdAt: "asc" } });
    expect(all.length).toBe(2); // gốc + reversal
    expect(all[0].status).toBe("REVERSED");
    expect(all[1].eventType).toBe("REVERSAL");
    const net = all.reduce((s, e) => s + Number(e.amount), 0);
    expect(net).toBe(0); // net về 0
  });

  it("R: cọc ĐÃ PHÂN BỔ → hoa hồng theo tiền thực thu (cọc)", async () => {
    await boot();
    const emp = await mkEmp();
    await commissionPolicy(3);
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const dep = await prisma.deposit.create({ data: { code: uniq("DC"), customerId: cust.id, amount: 4_000_000 as any, method: "CASH", status: "ALLOCATED", allocatedAt: new Date() } });
    await addAttr({ employeeId: emp.id, sourceType: "CUSTOMER", sourceId: cust.id, attributionRole: "CLOSER" });
    await generate({ type: "commission", depositId: dep.id });
    const evs = await evOf(emp.id, "SALES_COMMISSION");
    expect(evs.length).toBe(1);
    expect(Number(evs[0].amount)).toBe(120000); // 3% × 4m
  });

  it("S: idempotency — sinh 2 lần cùng phiếu thu → 1 event", async () => {
    await boot();
    const emp = await mkEmp();
    await commissionPolicy(3);
    const pay = await mkPayment({ amount: 5_000_000 });
    await addAttr({ employeeId: emp.id, sourceType: "CUSTOMER", sourceId: pay.customerId, attributionRole: "CLOSER" });
    await generate({ type: "commission", paymentId: pay.id });
    await generate({ type: "commission", paymentId: pay.id });
    expect((await evOf(emp.id, "SALES_COMMISSION")).length).toBe(1);
  });

  it("T: nhiều nhân sự chia theo weight (closer 0.7 / consultant 0.3)", async () => {
    await boot();
    const closer = await mkEmp(); const consultant = await mkEmp();
    await commissionPolicy(3);
    const pay = await mkPayment({ amount: 5_000_000 });
    await addAttr({ employeeId: closer.id, sourceType: "CUSTOMER", sourceId: pay.customerId, attributionRole: "CLOSER", weight: 0.7 });
    await addAttr({ employeeId: consultant.id, sourceType: "CUSTOMER", sourceId: pay.customerId, attributionRole: "CONSULTANT", weight: 0.3 });
    await generate({ type: "commission", paymentId: pay.id });
    expect(Number((await evOf(closer.id))[0].amount)).toBe(105000); // 3%×5m×0.7
    expect(Number((await evOf(consultant.id))[0].amount)).toBe(45000); // 3%×5m×0.3
  });
});

describe("HR-PH5 · Treatment incentive (V–AC)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("V: fixed theo dịch vụ/vai trò", async () => {
    await boot();
    const emp = await mkEmp();
    const { session } = await mkSessionContrib(emp.id, { typeCode: "PRIMARY_OPERATOR", minutes: 45 });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 200000 }); });
    await generate({ type: "incentive", sessionId: session.id });
    expect(Number((await evOf(emp.id))[0].amount)).toBe(200000);
  });

  it("W: per-minute rule", async () => {
    await boot();
    const emp = await mkEmp();
    const { session } = await mkSessionContrib(emp.id, { minutes: 45 });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "PER_MINUTE", perMinuteAmount: 1000 }); });
    await generate({ type: "incentive", sessionId: session.id });
    expect(Number((await evOf(emp.id))[0].amount)).toBe(45000); // 1000 × 45
  });

  it("X: weight áp dụng CHỈ khi policy nói (APPLY_CONTRIBUTION_WEIGHT)", async () => {
    await boot();
    const empApply = await mkEmp(); const empIgnore = await mkEmp();
    const s1 = await mkSessionContrib(empApply.id, { weight: 0.6, minutes: 30 });
    const s2 = await mkSessionContrib(empIgnore.id, { weight: 0.6, minutes: 30 });
    await publishedPolicy({ scopeType: "EMPLOYEE", employeeId: empApply.id }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 200000, weightMode: "APPLY_CONTRIBUTION_WEIGHT" }); });
    await publishedPolicy({ scopeType: "EMPLOYEE", employeeId: empIgnore.id }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 200000, weightMode: "IGNORE_WEIGHT" }); });
    await generate({ type: "incentive", sessionId: s1.session.id });
    await generate({ type: "incentive", sessionId: s2.session.id });
    expect(Number((await evOf(empApply.id))[0].amount)).toBe(120000); // 200k × 0.6
    expect(Number((await evOf(empIgnore.id))[0].amount)).toBe(200000); // weight bỏ qua
  });

  it("Y: nhiều nhân sự cùng dịch vụ → rule riêng theo vai trò", async () => {
    await boot();
    const master = await mkEmp(); const primary = await mkEmp();
    // cùng 1 buổi: tạo session rồi 2 contribution
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "DV", standardPrice: 0 } });
    const s = await prisma.treatmentSession.create({ data: { code: uniq("SS"), customerId: cust.id, sessionNumber: 1, status: "COMPLETED", executionFrozenAt: new Date() } });
    const item = await prisma.sessionExecutionItem.create({ data: { sessionId: s.id, serviceId: svc.id, sortOrder: 0 } });
    await prisma.sessionStaffContribution.create({ data: { treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: master.id, employeeNameSnapshot: "m", employeeRoleSnapshot: "MASTER", contributionTypeCode: "MASTER_SUPERVISION", actualMinutes: 15, serviceIdSnapshot: svc.id, status: "ACTIVE" } });
    await prisma.sessionStaffContribution.create({ data: { treatmentSessionId: s.id, sessionExecutionItemId: item.id, employeeId: primary.id, employeeNameSnapshot: "p", employeeRoleSnapshot: "KTV", contributionTypeCode: "PRIMARY_OPERATOR", actualMinutes: 45, serviceIdSnapshot: svc.id, status: "ACTIVE" } });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => {
      await addIncRule({ policyVersionId: vId, code: "TI-M", contributionTypeCode: "MASTER_SUPERVISION", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 50000 });
      await addIncRule({ policyVersionId: vId, code: "TI-P", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 150000 });
    });
    await generate({ type: "incentive", sessionId: s.id });
    expect(Number((await evOf(master.id))[0].amount)).toBe(50000);
    expect(Number((await evOf(primary.id))[0].amount)).toBe(150000);
  });

  it("Z+AA: contribution reversal → compensation reversal; correction → incentive mới", async () => {
    await boot();
    const emp = await mkEmp();
    const { session, contrib } = await mkSessionContrib(emp.id, { minutes: 45 });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "PER_MINUTE", perMinuteAmount: 1000 }); });
    await generate({ type: "incentive", sessionId: session.id });
    expect(Number((await evOf(emp.id)).find((e: any) => e.eventType === "TREATMENT_INCENTIVE")!.amount)).toBe(45000);
    // reverse contribution (đóng góp gốc → REVERSED + dòng REVERSAL) + contribution mới (60′)
    await prisma.sessionStaffContribution.update({ where: { id: contrib.id }, data: { status: "REVERSED", reversedAt: new Date() } });
    await prisma.sessionStaffContribution.create({ data: { treatmentSessionId: session.id, sessionExecutionItemId: contrib.sessionExecutionItemId, employeeId: emp.id, employeeNameSnapshot: "snap", employeeRoleSnapshot: "KTV", contributionTypeCode: "PRIMARY_OPERATOR", actualMinutes: 60, serviceIdSnapshot: contrib.serviceIdSnapshot, status: "ACTIVE" } });
    await generate({ type: "incentive", sessionId: session.id });
    const evs = await prisma.compensationEvent.findMany({ where: { employeeId: emp.id, eventType: { in: ["TREATMENT_INCENTIVE", "REVERSAL"] } } });
    const net = evs.reduce((s, e) => s + Number(e.amount), 0);
    expect(net).toBe(60000); // 45k gốc − 45k reversal + 60k mới
  });

  it("AB+AC: Booking staff/EmployeeRoleFee KHÔNG được dùng (chỉ contribution)", async () => {
    await boot();
    const emp = await mkEmp();
    await prisma.employeeRoleFee.create({ data: { employeeId: emp.id, role: "KTV", fee: 999000 as any, isActive: true } });
    // buổi có SessionStaff (gán booking-style) NHƯNG KHÔNG có contribution
    const cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "KH" } });
    const s = await prisma.treatmentSession.create({ data: { code: uniq("SS"), customerId: cust.id, sessionNumber: 1, status: "COMPLETED", executionFrozenAt: new Date() } });
    await prisma.sessionStaff.create({ data: { sessionId: s.id, employeeId: emp.id, staffName: "x", role: "PRIMARY", fee: 999000 as any } });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 200000 }); });
    await generate({ type: "incentive", sessionId: s.id });
    expect((await evOf(emp.id)).length).toBe(0); // không contribution → không incentive; role fee KHÔNG dùng
  });
});

describe("HR-PH5 · Package (AD–AF)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it("AD+AF: fixed incentive theo dịch vụ (không phụ thuộc chiết khấu gói) + item gói resolve đúng rule", async () => {
    await boot();
    const emp = await mkEmp();
    const svc = await prisma.service.create({ data: { code: uniq("DV"), name: "Pico", standardPrice: 3_000_000 } });
    const { session } = await mkSessionContrib(emp.id, { serviceId: svc.id, typeCode: "PRIMARY_OPERATOR" });
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", serviceId: svc.id, basisType: "FIXED_PER_SERVICE", fixedAmount: 200000 }); });
    await generate({ type: "incentive", sessionId: session.id });
    expect(Number((await evOf(emp.id))[0].amount)).toBe(200000); // cố định, không theo giá bán/chiết khấu
  });

  it("AE: rule PERCENT_ALLOCATED_REVENUE bị hoãn (không có phân bổ doanh thu) → 0 event", async () => {
    await boot();
    const emp = await mkEmp();
    const { session } = await mkSessionContrib(emp.id);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "PERCENT_ALLOCATED_REVENUE", ratePercent: 10 }); });
    await generate({ type: "incentive", sessionId: session.id });
    expect((await evOf(emp.id)).length).toBe(0); // DEFER
  });
});

describe("HR-PH5 · KPI bonus (AG–AL)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function mkKpiSnapshot(employeeId: string, value: number, quality: string, locked: boolean) {
    const def = await prisma.kpiDefinition.upsert({ where: { code: "avg_technician_score" }, update: {}, create: { code: "avg_technician_score", name: "Điểm KTV TB", category: "CUSTOMER", unit: "điểm" } });
    const period = await prisma.kpiPeriod.create({ data: { code: uniq("KP"), name: "Kỳ", periodType: "MONTHLY", startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-01-31T00:00:00Z"), status: locked ? "LOCKED" : "CALCULATED", lockedAt: locked ? new Date() : null } });
    const snap = await prisma.employeeKpiSnapshot.create({ data: { kpiPeriodId: period.id, employeeId, kpiDefinitionId: def.id, value: value as any, sourceQuality: quality as any, status: "CURRENT", version: 1, lockedAt: locked ? new Date() : null } });
    return { def, period, snap };
  }

  it("AG+AL: kỳ KHÓA + VERIFIED đủ điều kiện; snapshot vẫn là nguồn bằng chứng", async () => {
    await boot();
    const emp = await mkEmp();
    const { def, period, snap } = await mkKpiSnapshot(emp.id, 4.9, "VERIFIED", true);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addKpiRule({ policyVersionId: vId, code: "KB", kpiDefinitionId: def.id, comparator: "GTE", threshold: 4.8, bonusType: "FIXED", fixedAmount: 1000000 }); });
    await generate({ type: "kpi", periodId: period.id });
    const evs = await evOf(emp.id, "KPI_BONUS");
    expect(evs.length).toBe(1);
    expect(Number(evs[0].amount)).toBe(1000000);
    expect(evs[0].calculationSnapshot.kpiSnapshotId).toBe(snap.id);
  });

  it("AH: kỳ CHƯA KHÓA → không đủ điều kiện (409)", async () => {
    await boot();
    const emp = await mkEmp();
    const { def, period } = await mkKpiSnapshot(emp.id, 4.9, "VERIFIED", false);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addKpiRule({ policyVersionId: vId, code: "KB", kpiDefinitionId: def.id, comparator: "GTE", threshold: 4.8, fixedAmount: 1000000 }); });
    const r = await generate({ type: "kpi", periodId: period.id });
    expect(r.status).toBe(409);
  });

  it("AI: LEGACY_NAME_MATCH bị loại (mặc định requireVerified)", async () => {
    await boot();
    const emp = await mkEmp();
    const { def, period } = await mkKpiSnapshot(emp.id, 5.0, "LEGACY_NAME_MATCH", true);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addKpiRule({ policyVersionId: vId, code: "KB", kpiDefinitionId: def.id, comparator: "GTE", threshold: 4.8, fixedAmount: 1000000 }); });
    await generate({ type: "kpi", periodId: period.id });
    expect((await evOf(emp.id, "KPI_BONUS")).length).toBe(0);
  });

  it("AJ+AK: bậc (tier) đúng + idempotency", async () => {
    await boot();
    const emp = await mkEmp();
    const { def, period } = await mkKpiSnapshot(emp.id, 4.95, "VERIFIED", true);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => {
      await addKpiRule({ policyVersionId: vId, code: "KB1", kpiDefinitionId: def.id, comparator: "GTE", threshold: 4.5, tier: 1, fixedAmount: 500000 });
      await addKpiRule({ policyVersionId: vId, code: "KB2", kpiDefinitionId: def.id, comparator: "GTE", threshold: 4.9, tier: 2, fixedAmount: 1000000 });
    });
    await generate({ type: "kpi", periodId: period.id });
    await generate({ type: "kpi", periodId: period.id }); // idempotent
    const evs = await evOf(emp.id, "KPI_BONUS");
    expect(evs.length).toBe(1); // idempotency
    expect(Number(evs[0].amount)).toBe(1000000); // bậc cao hơn
  });
});

describe("HR-PH5 · RBAC / Self (AM–AS)", () => {
  beforeAll(async () => { await prisma.$executeRawUnsafe("TRUNCATE auth_throttles RESTART IDENTITY CASCADE").catch(() => {}); });
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  async function seedEventForEmp() {
    await boot();
    const emp = await mkEmp();
    const { session } = await mkSessionContrib(emp.id);
    await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", basisType: "FIXED_PER_CONTRIBUTION", fixedAmount: 200000 }); });
    await generate({ type: "incentive", sessionId: session.id });
    return emp;
  }

  it("AM+AN: self thấy event CỦA MÌNH, KHÔNG thấy của người khác", async () => {
    const emp = await seedEventForEmp();
    const other = await mkEmp();
    const selfUser = await makeUser([PERMISSIONS.TREATMENT_READ], { linkEmployeeId: emp.id });
    await login(selfUser.email);
    const rows = await D(await events());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.employeeId === emp.id)).toBe(true);
    const cross = await D(await events(`?employeeId=${other.id}`));
    expect(cross.every((r: any) => r.employeeId === emp.id)).toBe(true); // scope cứng self
  });

  it("AO+AS: finance.read / payroll.read ĐƠN LẺ KHÔNG cấp quyền compensation (403)", async () => {
    await seedEventForEmp();
    const fin = await makeUser([PERMISSIONS.FINANCE_READ]);
    await login(fin.email);
    expect((await events()).status).toBe(403);
    expect((await createPolicy({ name: "x", scopeType: "COMPANY" })).status).toBe(403);
    const pay = await makeUser([PERMISSIONS.PAYROLL_READ]);
    await login(pay.email);
    expect((await events()).status).toBe(403); // payroll TÁCH BIỆT compensation
  });

  it("AP: compensationPolicy.read xem được nhưng KHÔNG tạo (cần write)", async () => {
    await seedEventForEmp();
    const reader = await makeUser([PERMISSIONS.COMPENSATION_POLICY_READ]);
    await login(reader.email);
    expect((await events()).status).toBe(200);
    expect((await listPolicies()).status).toBe(200);
    expect((await createPolicy({ name: "x", scopeType: "COMPANY" })).status).toBe(403);
  });

  it("AQ: commission.read cho phép xem event; ẩn danh → 401", async () => {
    await seedEventForEmp();
    const cr = await makeUser([PERMISSIONS.COMMISSION_READ]);
    await login(cr.email);
    expect((await events()).status).toBe(200);
    jar.clear();
    expect((await events()).status).toBe(401);
  });

  it("AR: multi-role UNION quyền hoạt động", async () => {
    const emp = await mkEmp();
    const { session } = await (async () => { const m = await boot(); const { session } = await mkSessionContrib(emp.id); await publishedPolicy({ scopeType: "COMPANY" }, async (vId) => { await addIncRule({ policyVersionId: vId, code: "TI", contributionTypeCode: "PRIMARY_OPERATOR", fixedAmount: 200000 }); }); return { session }; })();
    const email = `${uniq("c")}@thng.com.vn`.toLowerCase();
    const user = await prisma.user.create({ data: { email, name: "Union", passwordHash: await hashPassword("matkhau123") } });
    const r1 = await prisma.role.create({ data: { code: uniq("R1"), name: "R1" } });
    const r2 = await prisma.role.create({ data: { code: uniq("R2"), name: "R2" } });
    await prisma.userRole.createMany({ data: [{ userId: user.id, roleId: r1.id }, { userId: user.id, roleId: r2.id }] });
    for (const [rid, code] of [[r1.id, PERMISSIONS.COMPENSATION_POLICY_READ], [r2.id, PERMISSIONS.COMPENSATION_POLICY_WRITE]] as const) {
      const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
      await prisma.rolePermission.create({ data: { roleId: rid, permissionId: p.id } });
    }
    await login(email);
    expect((await generate({ type: "incentive", sessionId: session.id })).status).toBe(200);
    expect((await events()).status).toBe(200);
  });
});
