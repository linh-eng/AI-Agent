export const dynamic = "force-dynamic";

import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { SPECS, parseRows, runImport, type Entity } from "@/lib/import-service";

export const POST = handle(async (req, ctx) => {
  const entity = ctx.params.entity as Entity;
  if (!SPECS[entity]) return fail(400, "Loại nhập liệu không hợp lệ");
  const session = await requirePermission(SPECS[entity].perm as any);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Chưa chọn file Excel");
  if (file.size === 0) return fail(400, "File rỗng");
  if (file.size > 8 * 1024 * 1024) return fail(400, "File quá lớn (tối đa 8MB)");

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, any>[];
  try {
    rows = parseRows(entity, buf);
  } catch {
    return fail(400, "Không đọc được file — hãy dùng đúng form mẫu (.xlsx)");
  }
  if (rows.length === 0) return fail(400, "File không có dòng dữ liệu nào");

  const result = await runImport(entity, rows, session.userId);
  return ok(result);
});
