export const dynamic = "force-dynamic";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { DATASETS, parseCsv, commitImport } from "@/lib/data-io";
import { auditLog } from "@/lib/clinic";

export const POST = handle(async (req, { params }) => {
  const session = await requireAuth();
  const ds = DATASETS[params.key];
  if (!ds) return fail(404, "Dataset không tồn tại");
  if (!ds.writePerm || !session.permissions.includes(ds.writePerm)) return fail(403, "Không có quyền nhập dữ liệu này");
  const body = await req.json();
  const rows = parseCsv(String(body.csv ?? ""));
  if (rows.length < 2) return fail(422, "CSV cần tiêu đề + ít nhất 1 dòng");
  if (rows.length > 5001) return fail(422, "Tối đa 5000 dòng/lần");
  const [header, ...dataRows] = rows;
  const report = await commitImport(params.key, header, dataRows);
  await auditLog({ userId: session.userId, action: "DATA_IMPORTED", entityType: ds.model, entityId: params.key, changes: { total: report.total, created: report.created, updated: report.updated, skippedError: report.skippedError } });
  return ok(report);
});
