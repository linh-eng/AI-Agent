export const dynamic = "force-dynamic";
import { requireAuth, HttpError } from "@/lib/session";
import { fail } from "@/lib/api";
import { DATASETS, exportDataset } from "@/lib/data-io";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  try {
    const session = await requireAuth();
    const ds = DATASETS[params.key];
    if (!ds) return fail(404, "Dataset không tồn tại");
    if (!session.permissions.includes(ds.readPerm)) return fail(403, "Không có quyền xuất dữ liệu này");
    const csv = await exportDataset(params.key);
    return new Response("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${params.key}.csv"` } });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    return fail(500, "Lỗi xuất dữ liệu");
  }
}
