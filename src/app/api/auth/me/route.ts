export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { ok, fail, handle } from "@/lib/api";

export const GET = handle(async () => {
  const session = await getSession();
  if (!session) return fail(401, "Chưa đăng nhập");
  return ok(session);
});