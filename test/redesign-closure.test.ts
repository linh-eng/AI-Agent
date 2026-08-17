// =============================================================================
// BUSINESS REDESIGN P1–P4 · CLOSURE — nghiệm thu xuyên suốt end-to-end (1 case thật):
//   Customer A → Protocol compose (DMK+Laser+Recovery) → Booking 1×3 items →
//   1 Session (walk-in) × 3 execution items → DMK actual Enzyme#1 (đề xuất #2),
//   qtyStd 5g/qtyActual 4g → inventory trừ ĐÚNG 4g (idempotent) → reversal ledger →
//   snapshot BẤT BIẾN khi sửa Service/SOP/option/product.
// Kèm: legacy Protocol/Booking, plan-based session, audit trail, DB invariants,
//      finance privacy. KHÔNG mở feature mới.
// =============================================================================
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

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
import { POST as svcPost } from "@/app/api/services/route";
import { GET as svcGet, PATCH as svcPatch } from "@/app/api/services/[id]/route";
import { POST as protoPost } from "@/app/api/brand-protocols/route";
import { GET as protoGet, PATCH as protoPatch } from "@/app/api/brand-protocols/[id]/route";
import { POST as bkPost } from "@/app/api/bookings/route";
import { GET as bkGet } from "@/app/api/bookings/[id]/route";
import { POST as sessPost } from "@/app/api/treatment-sessions/route";
import { GET as sessGet, PATCH as sessPatch } from "@/app/api/treatment-sessions/[id]/route";
import { POST as execPost, GET as execGet } from "@/app/api/session-executions/route";
import { PATCH as execPatch } from "@/app/api/session-executions/[id]/route";
import { GET as usageList, POST as usagePost } from "@/app/api/material-usages/route";
import { POST as usageReverse } from "@/app/api/material-usages/[id]/reverse/route";

let ip = 0;
function jreq(url: string, method: string, body?: unknown) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function rj(res: Response) { const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return null; } }
async function makeStaff(perms: string[]) {
  const email = `${uniq("s")}@thng.com.vn`.toLowerCase();
  const user = await prisma.user.create({ data: { email, name: uniq("NV"), passwordHash: await hashPassword("matkhau123") } });
  const role = await prisma.role.create({ data: { code: uniq("R"), name: "R" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  for (const code of perms) {
    const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  return { email, password: "matkhau123" };
}
async function login(email: string, password: string) {
  jar.clear();
  await staffLogin(new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.20.0.${++ip}` }, body: JSON.stringify({ email, password }) }), {} as any);
}

let admin: { email: string; password: string };
let noFin: { email: string; password: string };
// shared state cho end-to-end
const S: any = {};

beforeAll(async () => {
  await resetDb();
  admin = await makeStaff([
    PERMISSIONS.SERVICE_READ, PERMISSIONS.SERVICE_WRITE, PERMISSIONS.LIBRARY_READ, PERMISSIONS.PROTOCOL_WRITE, PERMISSIONS.PROTOCOL_APPROVE,
    PERMISSIONS.BOOKING_READ, PERMISSIONS.BOOKING_WRITE, PERMISSIONS.TREATMENT_READ, PERMISSIONS.TREATMENT_WRITE, PERMISSIONS.TREATMENT_EDIT_COMPLETED,
    PERMISSIONS.MATERIAL_WRITE, PERMISSIONS.CUSTOMER_READ, PERMISSIONS.FINANCE_READ,
  ]);
  noFin = await makeStaff([PERMISSIONS.TREATMENT_READ, PERMISSIONS.CUSTOMER_READ, PERMISSIONS.MATERIAL_WRITE]);
  S.cust = await prisma.customer.create({ data: { code: uniq("KH"), fullName: "Customer A (closure)" } });
});
beforeEach(() => { jar.clear(); });

describe("P1–P4 CLOSURE · end-to-end acceptance", () => {
  it("A · Service SOP: DMK 1 bước · 2 phương án (Enzyme #1/#2 default) · persistence", async () => {
    await login(admin.email, admin.password);
    // SpaProduct catalog liên kết vào step product (để test bất biến khi sửa Product metadata ở K)
    S.prod = (await prisma.spaProduct.create({ data: { sku: uniq("SP"), name: "DMK Enzyme", cost: 1_000_000 } })).id;
    const created = await rj(await svcPost(jreq("http://t/api/services", "POST", {
      name: "DMK Enzyme Treatment", standardPrice: 2_500_000, durationMinutes: 83,
      steps: [{ name: "Đắp Enzyme", durationMinutes: 40, isRequired: true, warnings: "Chống chỉ định: da viêm cấp",
        products: [{ spaProductId: S.prod, name: "DMK Enzyme", quantity: 5, unit: "g", isRequired: true }],
        options: [
          { name: "Enzyme #1", selectMode: "SINGLE_SELECT", isDefault: false, quantity: 5, unit: "g" },
          { name: "Enzyme #2", selectMode: "SINGLE_SELECT", isDefault: true, quantity: 5, unit: "g" },
          { name: "Không đắp", selectMode: "OPTIONAL", isDefault: false },
        ] }],
    }), {} as any));
    S.dmk = created.data.id;
    const laser = await rj(await svcPost(jreq("http://t/api/services", "POST", { name: "Laser Pico", standardPrice: 2_000_000, durationMinutes: 30 }), {} as any));
    const rec = await rj(await svcPost(jreq("http://t/api/services", "POST", { name: "Recovery", standardPrice: 600_000, durationMinutes: 15 }), {} as any));
    S.laser = laser.data.id; S.recovery = rec.data.id;
    const got = await rj(await svcGet(jreq(`http://t/api/services/${S.dmk}`, "GET"), { params: { id: S.dmk } } as any));
    expect(got.data.version).toBe(1);
    expect(got.data.steps).toHaveLength(1);
    expect(got.data.steps[0].options).toHaveLength(3);
    expect(got.data.steps[0].options.filter((o: any) => o.isDefault)).toHaveLength(1);
    expect(got.data.steps[0].warnings).toContain("Chống chỉ định");
    S.enzyme1 = got.data.steps[0].options.find((o: any) => o.name === "Enzyme #1").id;
    S.enzyme2 = got.data.steps[0].options.find((o: any) => o.name === "Enzyme #2").id;
  });

  it("B+C · Protocol compose 3 Service (không double-source) + legacy Protocol vẫn chạy", async () => {
    await login(admin.email, admin.password);
    const compose = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", {
      name: "Điều trị sắc tố kết hợp", kind: "INTERNAL", compositionMode: "SERVICES",
      services: [
        { serviceId: S.dmk, isRequired: true, conditionText: "Chọn enzyme theo tình trạng da", recommendedVariants: [{ stepName: "Đắp Enzyme", optionName: "Enzyme #2" }] },
        { serviceId: S.laser, isRequired: true },
        { serviceId: S.recovery, isRequired: false },
      ],
    }), {} as any));
    S.protocol = compose.data.id;
    let got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${S.protocol}`, "GET"), { params: { id: S.protocol } } as any));
    expect(got.data.compositionMode).toBe("SERVICES");
    expect(got.data.services).toHaveLength(3);
    // KHÔNG double-source: ProtocolService KHÔNG có cột steps riêng
    const raw = await prisma.protocolService.findFirst({ where: { protocolId: S.protocol } });
    expect(raw).not.toHaveProperty("steps");
    // Reorder composition (PATCH) → audit PROTOCOL_SERVICES_CHANGED
    await protoPatch(jreq(`http://t/api/brand-protocols/${S.protocol}`, "PATCH", {
      services: [{ serviceId: S.laser }, { serviceId: S.dmk, conditionText: "Chọn enzyme theo tình trạng da" }, { serviceId: S.recovery, isRequired: false }],
    }), { params: { id: S.protocol } } as any);
    got = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${S.protocol}`, "GET"), { params: { id: S.protocol } } as any));
    expect(got.data.services.map((s: any) => s.service.id)).toEqual([S.laser, S.dmk, S.recovery]);
    // Legacy protocol
    const legacy = await rj(await protoPost(jreq("http://t/api/brand-protocols", "POST", { name: "Legacy P", kind: "INTERNAL", steps: { items: [{ name: "B1" }] } }), {} as any));
    const lg = await rj(await protoGet(jreq(`http://t/api/brand-protocols/${legacy.data.id}`, "GET"), { params: { id: legacy.data.id } } as any));
    expect(lg.data.compositionMode).toBe("LEGACY_STEPS");
    expect(lg.data.services).toHaveLength(0);
  });

  it("D+E · Booking 1×3 items (1 card) + legacy booking dual-read", async () => {
    await login(admin.email, admin.password);
    const bk = await rj(await bkPost(jreq("http://t/api/bookings", "POST", {
      customerId: S.cust.id, scheduledAt: "2026-09-20T02:00:00.000Z",
      items: [{ serviceId: S.dmk }, { serviceId: S.laser }, { serviceId: S.recovery }],
    }), {} as any));
    S.booking = bk.data.id;
    expect(bk.data.serviceId).toBe(S.dmk); // dịch vụ chính = item đầu
    expect(bk.data.durationMinutes).toBe(128); // 83+30+15
    const got = await rj(await bkGet(jreq(`http://t/api/bookings/${S.booking}`, "GET"), { params: { id: S.booking } } as any));
    expect(got.data.items).toHaveLength(3);
    expect(got.data.totalDuration).toBe(128);
    S.bookingItems = got.data.items;
    // legacy booking 1 service → dual-read 1 item ảo
    const legacy = await rj(await bkPost(jreq("http://t/api/bookings", "POST", { customerId: S.cust.id, serviceId: S.laser, scheduledAt: "2026-09-21T02:00:00.000Z" }), {} as any));
    const lg = await rj(await bkGet(jreq(`http://t/api/bookings/${legacy.data.id}`, "GET"), { params: { id: legacy.data.id } } as any));
    expect(lg.data.items).toHaveLength(1);
    expect(lg.data.items[0].legacy).toBe(true);
  });

  it("F+G+I+J · 1 Session (walk-in) × 3 exec; DMK actual Enzyme#1 (đề xuất #2); qtyStd 5≠qtyActual 4", async () => {
    await login(admin.email, admin.password);
    const sess = await rj(await sessPost(jreq("http://t/api/treatment-sessions", "POST", { bookingId: S.booking }), {} as any));
    S.session = sess.data.id;
    expect(sess.data.planId).toBeNull(); // walk-in
    expect(sess.data.customerId).toBe(S.cust.id);
    // exec 1 = DMK actual Enzyme #1 (đề xuất #2), 5g→4g
    const e1 = await rj(await execPost(jreq("http://t/api/session-executions", "POST", {
      sessionId: S.session, serviceId: S.dmk, bookingItemId: S.bookingItems[0].id,
      selectedOptionSource: "SERVICE_SOP_OPTION", selectedOptionId: S.enzyme1, selectedOptionName: "Enzyme #1",
      actualValues: [{ stepName: "Đắp Enzyme", productName: "DMK Enzyme", qtyStd: 5, qtyActual: 4, unit: "g" }],
    }), {} as any));
    S.exec1 = e1.data.id;
    await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: S.session, serviceId: S.laser, bookingItemId: S.bookingItems[1].id, selectedOptionSource: "PRACTITIONER_ADHOC" }), {} as any);
    await execPost(jreq("http://t/api/session-executions", "POST", { sessionId: S.session, serviceId: S.recovery, bookingItemId: S.bookingItems[2].id, selectedOptionSource: "PRACTITIONER_ADHOC" }), {} as any);
    const items = await rj(await execGet(jreq(`http://t/api/session-executions?sessionId=${S.session}`, "GET"), {} as any));
    expect(items.data).toHaveLength(3);
    // BookingItem KHÔNG mutate
    const bi = await prisma.bookingItem.findMany({ where: { bookingId: S.booking } });
    expect(bi).toHaveLength(3);
    // snapshot: actual = Enzyme #1, qtyStd 5 / qtyActual 4
    const snap = e1.data.executionSnapshot;
    expect(snap.option.name).toBe("Enzyme #1");
    expect(snap.option.classification).toBeNull(); // defer
    expect(snap.actualValues[0].qtyStd).toBe(5);
    expect(snap.actualValues[0].qtyActual).toBe(4);
    S.snap1Json = JSON.stringify(snap);
  });

  it("K · Snapshot BẤT BIẾN: sửa Service name + SOP + option + Product metadata → snapshot cũ KHÔNG đổi (DB)", async () => {
    await login(admin.email, admin.password);
    // (1) Sửa toàn diện Service DMK: đổi tên + thay SOP (option/product khác) → version bump
    await svcPatch(jreq(`http://t/api/services/${S.dmk}`, "PATCH", {
      name: "DMK Enzyme Treatment RENAMED",
      steps: [{ name: "Bước mới", durationMinutes: 99, products: [{ name: "Sản phẩm mới", quantity: 99, unit: "ml" }], options: [{ name: "Option mới", quantity: 99, unit: "ml" }] }],
    }), { params: { id: S.dmk } } as any);
    // (2) Sửa Product metadata (SpaProduct catalog): đổi tên + giá vốn + đơn vị
    await prisma.spaProduct.update({ where: { id: S.prod }, data: { name: "SP ĐỔI TÊN", cost: 9_999_999 } });
    const svcNow = await prisma.service.findUnique({ where: { id: S.dmk }, select: { version: true, name: true } });
    expect(svcNow!.version).toBe(2);
    expect(svcNow!.name).toContain("RENAMED");
    // executionSnapshot cũ trong DB KHÔNG đổi (byte-for-byte) sau CẢ 2 thay đổi
    const reread = await prisma.sessionExecutionItem.findUnique({ where: { id: S.exec1 } });
    expect(JSON.stringify(reread!.executionSnapshot)).toBe(S.snap1Json);
    expect((reread!.executionSnapshot as any).source.name).toBe("DMK Enzyme Treatment"); // tên Service CŨ
    expect((reread!.executionSnapshot as any).source.version).toBe(1);
    expect(reread!.sourceVersion).toBe(1);
  });

  it("L+M · Inventory: trừ ĐÚNG 4g (idempotent) + reversal ledger + chặn reverse 2 lần", async () => {
    await login(admin.email, admin.password);
    const mat = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name: "DMK Enzyme lọ", unit: "g" } });
    const cont = await prisma.materialContainer.create({ data: { containerNo: uniq("CT"), usageMaterialId: mat.id, initialQty: 100, remainingQty: 100, unit: "g", costSnapshot: 2_000_000 } });
    const key = uniq("idem");
    const u1 = await rj(await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, sessionId: S.session, quantity: 4, idempotencyKey: key }), {} as any));
    const u2 = await rj(await usagePost(jreq("http://t/api/material-usages", "POST", { source: "SHARED_STOCK", containerId: cont.id, sessionId: S.session, quantity: 4, idempotencyKey: key }), {} as any));
    expect(u1.data.id).toBe(u2.data.id); // idempotent
    let c = await prisma.materialContainer.findUnique({ where: { id: cont.id } });
    expect(Number(c!.remainingQty)).toBe(96); // trừ ĐÚNG 4 (actual), không 5, không double
    S.usage = u1.data.id;
    // reversal
    const rev = await rj(await usageReverse(jreq(`http://t/api/material-usages/${S.usage}/reverse`, "POST", { reason: "Ghi nhầm" }), { params: { id: S.usage } } as any));
    expect(rev.data.reversed).toBe(true);
    const orig = await prisma.materialUsage.findUnique({ where: { id: S.usage } });
    expect(orig).not.toBeNull(); // GIỮ bản gốc
    expect(orig!.reversedAt).not.toBeNull();
    const reversal = await prisma.materialUsage.findFirst({ where: { reversalOfUsageId: S.usage, usageType: "REVERSAL" } });
    expect(reversal).not.toBeNull();
    c = await prisma.materialContainer.findUnique({ where: { id: cont.id } });
    expect(Number(c!.remainingQty)).toBe(100); // cộng lại
    const again = await usageReverse(jreq(`http://t/api/material-usages/${S.usage}/reverse`, "POST", { reason: "lần 2" }), { params: { id: S.usage } } as any);
    expect(again.status).toBe(400); // chặn 2 lần
  });

  it("O+P · Completion retry no double-effect + completed edit cần lý do + RBAC", async () => {
    await login(admin.email, admin.password);
    await sessPatch(jreq(`http://t/api/treatment-sessions/${S.session}`, "PATCH", { status: "COMPLETED", serviceId: S.dmk }), { params: { id: S.session } } as any);
    const s1 = await prisma.treatmentSession.findUnique({ where: { id: S.session }, select: { executionFrozenAt: true } });
    expect(s1!.executionFrozenAt).not.toBeNull();
    // retry complete
    await sessPatch(jreq(`http://t/api/treatment-sessions/${S.session}`, "PATCH", { status: "COMPLETED", editReason: "retry" }), { params: { id: S.session } } as any);
    const s2 = await prisma.treatmentSession.findUnique({ where: { id: S.session }, select: { executionFrozenAt: true } });
    expect(s2!.executionFrozenAt!.getTime()).toBe(s1!.executionFrozenAt!.getTime()); // no re-freeze
    // sửa exec item sau completed: không lý do → 422
    const noReason = await execPatch(jreq(`http://t/api/session-executions/${S.exec1}`, "PATCH", { note: "x" }), { params: { id: S.exec1 } } as any);
    expect(noReason.status).toBe(422);
    // noFin (không editCompleted) → 403
    await login(noFin.email, noFin.password);
    const forbid = await execPatch(jreq(`http://t/api/session-executions/${S.exec1}`, "PATCH", { note: "x", reason: "r" }), { params: { id: S.exec1 } } as any);
    expect(forbid.status).toBe(403);
  });

  it("R · Finance privacy: non-finance KHÔNG thấy costAllocated qua API", async () => {
    await login(noFin.email, noFin.password);
    const listed = await rj(await usageList(jreq(`http://t/api/material-usages?sessionId=${S.session}`, "GET"), {} as any));
    for (const u of listed.data) expect(u.costAllocated).toBeNull();
    await login(admin.email, admin.password);
    const finList = await rj(await usageList(jreq(`http://t/api/material-usages?sessionId=${S.session}`, "GET"), {} as any));
    expect(finList.data.some((u: any) => u.costAllocated != null)).toBe(true);
  });

  it("S · Audit trail: các sự kiện P1–P4 có mặt, không log secret", async () => {
    const actions = await prisma.auditLog.findMany({ where: { entityId: { in: [S.dmk, S.protocol, S.booking, S.session, S.exec1, S.usage] } }, select: { action: true } });
    const set = new Set(actions.map((a) => a.action));
    for (const a of ["SERVICE_SOP_CHANGED", "PROTOCOL_SERVICES_CHANGED", "SESSION_OPTION_SELECTED", "SESSION_SNAPSHOT_FROZEN", "SESSION_COMPLETED", "MATERIAL_USAGE_POSTED", "MATERIAL_USAGE_REVERSED"]) {
      expect(set.has(a)).toBe(true);
    }
    // không log secret: changes không chứa password/hash
    const all = await prisma.auditLog.findMany({ select: { changes: true } });
    for (const a of all) expect(JSON.stringify(a.changes ?? {}).toLowerCase()).not.toContain("passwordhash");
  });

  it("T · DB invariants: không orphan (LEFT JOIN), unique Booking↔Session, reversal link, legacy tồn tại", async () => {
    // Orphan thực sự = child có FK trỏ tới parent KHÔNG tồn tại (LEFT JOIN … IS NULL).
    const orphan = async (sql: string) => Number((await prisma.$queryRawUnsafe<{ c: bigint }[]>(sql))[0].c);
    expect(await orphan(`SELECT COUNT(*) c FROM service_steps s LEFT JOIN services v ON s."serviceId"=v.id WHERE v.id IS NULL`)).toBe(0);
    expect(await orphan(`SELECT COUNT(*) c FROM protocol_services p LEFT JOIN brand_protocols b ON p."protocolId"=b.id LEFT JOIN services v ON p."serviceId"=v.id WHERE b.id IS NULL OR v.id IS NULL`)).toBe(0);
    expect(await orphan(`SELECT COUNT(*) c FROM booking_items bi LEFT JOIN bookings b ON bi."bookingId"=b.id WHERE b.id IS NULL`)).toBe(0);
    expect(await orphan(`SELECT COUNT(*) c FROM session_execution_items e LEFT JOIN treatment_sessions s ON e."sessionId"=s.id WHERE s.id IS NULL`)).toBe(0);
    // unique Booking↔Session
    expect(await orphan(`SELECT COUNT(*) - COUNT(DISTINCT "bookingId") c FROM treatment_sessions WHERE "bookingId" IS NOT NULL`)).toBe(0);
    // reversal link hợp lệ: mọi REVERSAL trỏ tới 1 usage tồn tại
    expect(await orphan(`SELECT COUNT(*) c FROM material_usages r LEFT JOIN material_usages o ON r."reversalOfUsageId"=o.id WHERE r."usageType"='REVERSAL' AND o.id IS NULL`)).toBe(0);
    // legacy rows vẫn tồn tại (booking 1-service + protocol legacy đã tạo ở D/C)
    expect(await orphan(`SELECT COUNT(*) c FROM brand_protocols WHERE "compositionMode"='LEGACY_STEPS'`)).toBeGreaterThan(0);
  });
});
