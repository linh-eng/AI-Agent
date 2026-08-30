// =============================================================================
// Tổng hợp & báo cáo VẬT TƯ SỬ DỤNG (spa). Chỉ số nghiệp vụ tiêu hao dịch vụ.
// =============================================================================
import { prisma } from "./prisma";

const n = (v: any) => (v == null ? 0 : Number(v));

/** Dashboard vật tư sử dụng. */
export async function materialsDashboard(now = new Date()) {
  const soonExpiry = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [inUse, opened, low, empty, expiringSoon, containers] = await Promise.all([
    prisma.materialContainer.count({ where: { status: "IN_USE" } }),
    prisma.materialContainer.count({ where: { status: { in: ["IN_USE", "LOW"] }, openedAt: { not: null } } }),
    prisma.materialContainer.count({ where: { status: "LOW" } }),
    prisma.materialContainer.count({ where: { status: "EMPTY" } }),
    prisma.materialContainer.findMany({
      where: { status: { in: ["IN_USE", "LOW"] }, expiryDate: { not: null, lte: soonExpiry } },
      include: { material: { select: { name: true } } },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.materialContainer.findMany({
      where: { status: { in: ["IN_USE", "LOW"] } },
      include: { material: { select: { name: true } } },
      orderBy: { remainingQty: "asc" },
      take: 10,
    }),
  ]);

  const usedToday = await prisma.materialUsage.aggregate({
    where: { occurredAt: { gte: startToday } },
    _sum: { costAllocated: true },
    _count: true,
  });

  // Tiêu hao theo dịch vụ / công nghệ (số lần + chi phí).
  const byService = await prisma.materialUsage.groupBy({
    by: ["serviceId"],
    where: { serviceId: { not: null } },
    _sum: { costAllocated: true, quantity: true },
    _count: true,
  });
  const byTech = await prisma.materialUsage.groupBy({
    by: ["technologyId"],
    where: { technologyId: { not: null } },
    _sum: { costAllocated: true, quantity: true },
    _count: true,
  });

  return {
    cards: {
      inUse,
      opened,
      low,
      empty,
      expiringSoon: expiringSoon.length,
      usedTodayCount: usedToday._count,
      usedTodayCost: n(usedToday._sum.costAllocated),
    },
    lowContainers: low > 0 ? containers.filter((c) => c.status === "LOW").map(fmtContainer) : [],
    lowStockList: containers.map(fmtContainer),
    expiringSoon: expiringSoon.map(fmtContainer),
    byService: byService.map((r) => ({ serviceId: r.serviceId, count: r._count, qty: n(r._sum.quantity), cost: n(r._sum.costAllocated) })),
    byTech: byTech.map((r) => ({ technologyId: r.technologyId, count: r._count, qty: n(r._sum.quantity), cost: n(r._sum.costAllocated) })),
  };
}

function fmtContainer(c: any) {
  return {
    id: c.id,
    containerNo: c.containerNo,
    material: c.material?.name,
    remainingQty: n(c.remainingQty),
    initialQty: n(c.initialQty),
    unit: c.unit,
    status: c.status,
    openedAt: c.openedAt,
    expiryDate: c.expiryDate,
  };
}

/** Báo cáo vật tư — các chiều tiêu hao + chi phí + expected vs actual. */
export async function materialsReport() {
  const usages = await prisma.materialUsage.findMany({
    include: {
      container: { include: { material: { select: { name: true, expectedPerSession: true } } } },
      customerMaterial: { select: { name: true, unit: true } },
      session: { select: { name: true, sessionNumber: true, planId: true } },
    },
  });

  // Tên vật tư + đơn vị + nguồn (Kho vật tư sử dụng | Vật tư khách hàng) cho từng lần tiêu hao.
  const materialInfo = (u: (typeof usages)[number]) => {
    if (u.container?.material?.name) return { name: u.container.material.name, unit: u.container.unit ?? "", source: "Kho vật tư sử dụng" };
    if (u.customerMaterial?.name) return { name: u.customerMaterial.name, unit: u.customerMaterial.unit ?? "", source: "Vật tư khách hàng" };
    return { name: "", unit: "", source: "" };
  };

  const groupSum = (keyFn: (u: (typeof usages)[number]) => string | null) => {
    const map = new Map<string, { key: string; count: number; qty: number; cost: number }>();
    for (const u of usages) {
      const k = keyFn(u);
      if (!k) continue;
      const cur = map.get(k) ?? { key: k, count: 0, qty: 0, cost: 0 };
      cur.count += 1;
      cur.qty += n(u.quantity);
      cur.cost += n(u.costAllocated);
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  };

  // Expected vs actual theo buổi (định mức container vs thực dùng).
  const expectedVsActual = groupSum((u) => u.sessionId ?? null).map((row) => {
    const rel = usages.filter((u) => u.sessionId === row.key);
    const expected = rel.reduce((s, u) => s + n(u.container?.material?.expectedPerSession), 0);
    const label = rel[0]?.session ? `Buổi ${rel[0].session.sessionNumber ?? ""} ${rel[0].session.name ?? ""}` : row.key;
    return { session: label, expected, actual: row.qty, cost: row.cost };
  });

  // Giải tên cho các id (khách/dịch vụ/công nghệ/protocol) để báo cáo dễ đọc.
  const ids = {
    cust: [...new Set(usages.map((u) => u.customerId).filter(Boolean) as string[])],
    svc: [...new Set(usages.map((u) => u.serviceId).filter(Boolean) as string[])],
    tech: [...new Set(usages.map((u) => u.technologyId).filter(Boolean) as string[])],
    proto: [...new Set(usages.map((u) => u.brandProtocolId).filter(Boolean) as string[])],
  };
  const [custs, svcs, techs, protos] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: ids.cust } }, select: { id: true, fullName: true } }),
    prisma.service.findMany({ where: { id: { in: ids.svc } }, select: { id: true, name: true } }),
    prisma.technology.findMany({ where: { id: { in: ids.tech } }, select: { id: true, name: true } }),
    prisma.brandProtocol.findMany({ where: { id: { in: ids.proto } }, select: { id: true, name: true } }),
  ]);
  const nameOf = (arr: { id: string; name?: string; fullName?: string }[], k: string) => {
    const f = arr.find((x) => x.id === k);
    return f?.name ?? f?.fullName ?? k;
  };
  const label = (arr: any[], nameArr: any[]) => arr.map((r) => ({ ...r, label: nameOf(nameArr, r.key) }));

  // Tiêu hao theo VẬT TƯ (tên lọ/sản phẩm) — chiều quan trọng nhất: dùng hết bao nhiêu mỗi loại.
  const byMaterialMap = new Map<string, { key: string; label: string; unit: string; source: string; count: number; qty: number; cost: number }>();
  for (const u of usages) {
    const info = materialInfo(u);
    if (!info.name) continue;
    const cur = byMaterialMap.get(info.name) ?? { key: info.name, label: info.name, unit: info.unit, source: info.source, count: 0, qty: 0, cost: 0 };
    cur.count += 1;
    cur.qty += n(u.quantity);
    cur.cost += n(u.costAllocated);
    if (!cur.unit) cur.unit = info.unit;
    byMaterialMap.set(info.name, cur);
  }
  const byMaterial = [...byMaterialMap.values()].sort((a, b) => b.cost - a.cost || b.qty - a.qty);

  return {
    byMaterial,
    byCustomer: label(groupSum((u) => u.customerId), custs),
    bySession: groupSum((u) => u.sessionId).map((r) => {
      const rel = usages.find((u) => u.sessionId === r.key);
      return { ...r, label: rel?.session ? `Buổi ${rel.session.sessionNumber ?? ""} ${rel.session.name ?? ""}` : r.key };
    }),
    byService: label(groupSum((u) => u.serviceId), svcs),
    byTech: label(groupSum((u) => u.technologyId), techs),
    byProtocol: label(groupSum((u) => u.brandProtocolId), protos),
    byStaff: groupSum((u) => u.performedBy).map((r) => ({ ...r, label: r.key })),
    byPlan: groupSum((u) => u.session?.planId ?? null).map((r) => ({ ...r, label: r.key })),
    expectedVsActual,
  };
}
