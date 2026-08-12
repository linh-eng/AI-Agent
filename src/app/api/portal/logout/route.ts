export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ok, handle } from "@/lib/api";
import { PORTAL_COOKIE } from "@/lib/portal-auth";

export const POST = handle(async () => {
  cookies().delete(PORTAL_COOKIE);
  return ok({ loggedOut: true });
});
