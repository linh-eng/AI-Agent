export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { bookingCreateSchema } from "@/lib/clinic-validation";
import { sequentialCode } from "@/lib/clinic";
import { resolvePrice } from "@/lib/pricing";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const bookings = await prisma.booking.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      customer: { select: { code: true, fullName: true, phone: true } },
      service: { select: { name: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 300,
  });
  return ok(bookings);
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const parsed = bookingCreateSchema.parse(await req.json());
  const code = parsed.code ?? sequentialCode("BK", await prisma.booking.count());

  // Chốt giá tại thời điểm booking (snapshot bất biến). Ưu tiên bảng giá có hiệu
  // lực (Price Management), fallback giá chuẩn của dịch vụ.
  let price = parsed.price ?? undefined;
  if (price === undefined && parsed.serviceId) {
    const resolved = await resolvePrice("SERVICE", parsed.serviceId, {
      at: parsed.scheduledAt,
      branch: parsed.branch ?? undefined,
    });
    if (resolved) {
      price = resolved.price;
    } else {
      const svc = await prisma.service.findUnique({
        where: { id: parsed.serviceId },
        select: { standardPrice: true },
      });
      if (svc) price = Number(svc.standardPrice);
    }
  }

  const booking = await prisma.booking.create({
    data: { ...parsed, code, price: price ?? null },
    include: { customer: { select: { fullName: true } }, service: { select: { name: true } } },
  });
  return created(booking);
});
