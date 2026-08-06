"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Hammer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Checkbox } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

export default function DisassemblyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.WARRANTY_WRITE);
  const canApprove = useCan(PERMISSIONS.DISASSEMBLY_APPROVE);

  const [order, setOrder] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { grade: string; scrap: boolean }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const o = await apiFetch<any>(`/api/disassembly/${id}`);
    setOrder(o);
    setGrades(Object.fromEntries(o.children.map((c: any) => [c.serialNumber, { grade: "B", scrap: false }])));
  }
  useEffect(() => { load(); }, [id]);

  async function run(fn: () => Promise<any>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try { await fn(); setMsg(okMsg); await load(); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  const approve = () => run(() => apiFetch(`/api/disassembly/${id}/approve`, { method: "POST" }), "Đã duyệt rã máy.");
  const execute = () => run(
    () => apiFetch(`/api/disassembly/${id}/execute`, {
      method: "POST",
      body: JSON.stringify({ children: Object.entries(grades).map(([serialNumber, v]) => ({ serialNumber, grade: v.grade, scrap: v.scrap })) }),
    }),
    "Đã rã máy & thu hồi linh kiện."
  );

  if (!order) return <p className="text-muted-foreground">Đang tải...</p>;
  const executed = !!order.executedAt;

  return (
    <div>
      <div className="mb-4">
        <Link href="/disassembly" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Danh sách rã máy</Link>
      </div>
      <PageHeader
        title={`Lệnh rã máy ${order.number}`}
        description={`Máy: ${order.parent?.serialNumber ?? ""} — ${order.parent?.product?.name ?? ""}`}
        action={executed ? <Badge tone="success">Đã rã</Badge> : <Badge tone={DOC_STATUS_TONE[order.status]}>{DOC_STATUS_LABEL[order.status]}</Badge>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {order.reason && <div className="mb-4 text-sm text-muted-foreground">Lý do: {order.reason}</div>}

      {order.status === "DRAFT" && (
        <Card className="mb-4"><CardContent className="flex items-center justify-between p-4">
          <span className="text-sm">Rã máy <b>bắt buộc</b> duyệt cấp quản lý/BGĐ.</span>
          {canApprove ? <Button onClick={approve} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Duyệt rã máy</Button> : <span className="text-xs text-muted-foreground">Chờ BGĐ duyệt.</span>}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Linh kiện theo as-built BOM (v{order.bomVersion}) — {order.children.length} món</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Serial con</TH><TH>Linh kiện</TH>{!executed && order.status === "APPROVED" && <><TH>Grade thu hồi</TH><TH>Hỏng/hủy</TH></>}</TR></THead>
            <TBody>
              {order.children.length === 0 ? <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">Máy không có as-built BOM</TD></TR> :
                order.children.map((c: any) => (
                  <TR key={c.serialNumber}>
                    <TD className="font-mono">{c.serialNumber}</TD>
                    <TD>{c.product}</TD>
                    {!executed && order.status === "APPROVED" && (
                      <>
                        <TD>
                          <Select className="h-8 w-20" value={grades[c.serialNumber]?.grade ?? "B"} disabled={grades[c.serialNumber]?.scrap} onChange={(e) => setGrades({ ...grades, [c.serialNumber]: { ...grades[c.serialNumber], grade: e.target.value } })}>
                            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                          </Select>
                        </TD>
                        <TD><Checkbox checked={grades[c.serialNumber]?.scrap ?? false} onChange={(e) => setGrades({ ...grades, [c.serialNumber]: { ...grades[c.serialNumber], scrap: e.target.checked } })} /></TD>
                      </>
                    )}
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {order.status === "APPROVED" && !executed && canWrite && (
        <div className="mt-4 flex justify-end">
          <Button onClick={execute} disabled={busy}><Hammer className="h-4 w-4" /> Thực hiện rã máy</Button>
        </div>
      )}
    </div>
  );
}
