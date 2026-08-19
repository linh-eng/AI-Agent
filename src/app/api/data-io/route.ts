export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { listDatasets } from "@/lib/data-io";

export const GET = handle(async () => {
  const session = await requireAuth();
  return ok(listDatasets(session.permissions));
});
