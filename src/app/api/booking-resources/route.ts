export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sequentialCode } from "@/lib/clinic";

// Danh mục tài nguyên đặt lịch (Phòng/Giường/Máy) — nguồn cho dropdown trong form.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const p = new URL(req.url).searchParams;
  const type = p.get("type") ?? undefined;
  const activeOnly = p.get("active") === "1";
  const items = await prisma.bookingResource.findMany({
    where: { ...(type ? { type: type as any } : {}), ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: 500,
  });
  return ok(items);
});

const createSchema = z.object({
  name: z.string().min(1, "Nhập tên tài nguyên"),
  type: z.enum(["ROOM", "BED", "MACHINE"]),
  parentId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.BOOKING_WRITE);
  const d = createSchema.parse(await req.json());
  const prefix = d.type === "ROOM" ? "PH" : d.type === "BED" ? "GI" : "MAY";
  const code = sequentialCode(prefix, await prisma.bookingResource.count({ where: { type: d.type } }));
  const item = await prisma.bookingResource.create({ data: { ...d, parentId: d.type === "BED" ? d.parentId ?? null : null, code } });
  return created(item);
});
