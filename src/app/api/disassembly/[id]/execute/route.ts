export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { disassemblyExecuteSchema } from "@/lib/validation";
import { executeDisassembly } from "@/lib/disassembly-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WARRANTY_WRITE);
  const input = disassemblyExecuteSchema.parse(await req.json());
  const result = await executeDisassembly(params.id, input, session.userId);
  return ok(result);
});
