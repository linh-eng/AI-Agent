export const dynamic = "force-dynamic";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { DATASETS, parseCsv, previewImport } from "@/lib/data-io";

export const POST = handle(async (req, { params }) => {
  const session = await requireAuth();
  const ds = DATASETS[params.key];
  if (!ds) return fail(404, "Dataset không tồn tại");
  if (!ds.writePerm || !session.permissions.includes(ds.writePerm)) return fail(403, "Không có quyền nhập dữ liệu này");
  const body = await req.json();
  const rows = parseCsv(String(body.csv ?? ""));
  if (rows.length < 1) return fail(422, "CSV rỗng");
  if (rows.length > 5001) return fail(422, "Tối đa 5000 dòng/lần");
  const [header, ...dataRows] = rows;
  return ok(await previewImport(params.key, header, dataRows));
});
