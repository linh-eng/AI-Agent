export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { created, handle } from "@/lib/api";
import { requirePermission, HttpError } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { shotLogSchema } from "@/lib/validation";

function parseDate(v?: string | null): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Ghi nhận số shot đã bắn: tạo ShotLog + cộng dồn usedShots (1 transaction). */
export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.ASSET_WRITE);
  const input = shotLogSchema.parse(await req.json());

  const result = await prisma.$transaction(async (tx) => {
    const hp = await tx.handpiece.findUniqueOrThrow({ where: { id: ctx.params.id } });
    if (hp.status === "RETIRED") {
      throw new HttpError(400, "Tay cầm đã ngừng dùng, không thể ghi shot");
    }
    // Chặn ghi vượt định mức shot tối đa (usedShots + shots không được > maxShots).
    const remaining = hp.maxShots - hp.usedShots;
    if (input.shots > remaining) {
      throw new HttpError(
        400,
        remaining <= 0
          ? `Tay cầm đã hết shot (đã dùng ${hp.usedShots}/${hp.maxShots}). Cần thay tay cầm mới.`
          : `Vượt định mức: chỉ còn ${remaining} shot (đã dùng ${hp.usedShots}/${hp.maxShots}). Không thể ghi ${input.shots} shot.`
      );
    }
    const log = await tx.shotLog.create({
      data: {
        handpieceId: hp.id,
        shots: input.shots,
        customerName: input.customerName,
        note: input.note,
        performedAt: parseDate(input.performedAt),
        createdById: session.userId,
      },
    });
    const updated = await tx.handpiece.update({
      where: { id: hp.id },
      data: { usedShots: { increment: input.shots } },
    });
    return { log, handpiece: updated };
  });

  return created(result);
});
