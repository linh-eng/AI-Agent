export const dynamic = "force-dynamic";

import { fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { SPECS, buildTemplate, type Entity } from "@/lib/import-service";

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") as Entity;
  if (!entity || !SPECS[entity]) return fail(400, "Loại nhập liệu không hợp lệ");
  await requirePermission(SPECS[entity].perm as any);
  const buf = buildTemplate(entity);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mau-${entity}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
