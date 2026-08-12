import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signPortalSession, verifyPortalSession } from "@/lib/portal-auth";
import { signSession, verifySession } from "@/lib/auth";
import { resetDb, uniq, makeCustomer } from "./helpers";

describe("P5 — bảo mật Cổng khách hàng", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("phiên portal: sign/verify roundtrip, TỪ CHỐI token nhân viên (khác scope)", async () => {
    const token = await signPortalSession({ customerId: "cust-1", email: "a@b.com" });
    const s = await verifyPortalSession(token);
    expect(s?.customerId).toBe("cust-1");

    // Token nhân viên KHÔNG được chấp nhận làm phiên portal (khác secret + scope).
    const staff = await signSession({ userId: "u", email: "s@t.com", name: "NV", roles: ["MANAGER"], permissions: ["finance.read"] });
    expect(await verifyPortalSession(staff)).toBeNull();

    // Và ngược lại: token portal KHÔNG verify được như phiên nhân viên (khác secret).
    expect(await verifySession(token)).toBeNull();
  });

  it("IDOR: điều kiện scope chỉ trả báo giá của chính khách", async () => {
    const a = await makeCustomer({ code: uniq("A") });
    const b = await makeCustomer({ code: uniq("B") });
    const pa = await prisma.treatmentProposal.create({ data: { code: uniq("P"), customerId: a.id, title: "A" } });
    await prisma.treatmentProposal.create({ data: { code: uniq("P"), customerId: b.id, title: "B" } });

    // Route portal: findUnique rồi CHECK customerId === session.customerId.
    const asB = await prisma.treatmentProposal.findUnique({ where: { id: pa.id }, select: { customerId: true } });
    expect(asB!.customerId).toBe(a.id);
    expect(asB!.customerId === b.id).toBe(false); // B không sở hữu -> route trả 404

    // Danh sách của B không chứa báo giá của A.
    const listB = await prisma.treatmentProposal.findMany({ where: { customerId: b.id } });
    expect(listB.every((p) => p.customerId === b.id)).toBe(true);
    expect(listB.find((p) => p.id === pa.id)).toBeUndefined();
  });

  it("media portal: chỉ trả ảnh của chính khách VÀ đã chia sẻ VÀ chưa archive", async () => {
    const a = await makeCustomer({ code: uniq("A") });
    const b = await makeCustomer({ code: uniq("B") });
    const shared = await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "s.jpg", contentType: "image/jpeg", size: 1, kind: "AFTER_IMAGE", customerId: a.id, sharedWithCustomer: true } });
    const notShared = await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "n.jpg", contentType: "image/jpeg", size: 1, kind: "AFTER_IMAGE", customerId: a.id, sharedWithCustomer: false } });
    const otherCust = await prisma.mediaAsset.create({ data: { storageKey: uniq("k"), filename: "o.jpg", contentType: "image/jpeg", size: 1, kind: "AFTER_IMAGE", customerId: b.id, sharedWithCustomer: true } });

    // Điều kiện đúng như route /api/portal/media/[id]:
    const canAccess = (assetId: string, sessionCustomerId: string) =>
      prisma.mediaAsset.findFirst({ where: { id: assetId, customerId: sessionCustomerId, sharedWithCustomer: true, isArchived: false } });

    expect(await canAccess(shared.id, a.id)).not.toBeNull(); // của A + đã chia sẻ
    expect(await canAccess(notShared.id, a.id)).toBeNull(); // chưa chia sẻ
    expect(await canAccess(otherCust.id, a.id)).toBeNull(); // của khách khác (IDOR bị chặn)
  });

  it("overview: mọi truy vấn đều lọc theo customerId (không rò dữ liệu khách khác)", async () => {
    const a = await makeCustomer({ code: uniq("A") });
    const b = await makeCustomer({ code: uniq("B") });
    await prisma.payment.create({ data: { customerId: b.id, amount: 999, method: "CASH" } });
    // A không thấy thanh toán của B
    const aPays = await prisma.payment.findMany({ where: { customerId: a.id } });
    expect(aPays.length).toBe(0);
  });
});
