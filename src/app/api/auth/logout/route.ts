export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

export const POST = handle(async () => {
  cookies().delete(SESSION_COOKIE);
  return ok({ success: true });
});