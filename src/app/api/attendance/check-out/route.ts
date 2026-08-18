export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { attendanceCheckOutSchema } from "@/lib/clinic-validation";
import { checkOut } from "@/lib/attendance-service";

export const POST = handle(async (req) => {
  const session = await requireAuth();
  const canWrite = session.permissions.includes(PERMISSIONS.ATTENDANCE_WRITE);
  const input = attendanceCheckOutSchema.parse(await req.json());
  const rec = await checkOut(session, input, canWrite);
  return ok(rec);
});
