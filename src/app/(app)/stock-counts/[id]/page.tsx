"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanLine, Send, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { COUNT_STATUS_LABEL, COUNT_STATUS_TONE } from "@/lib/labels";

export default function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.WAREHOUSE_WRITE);
  const canApprove = useCan(PERMISSIONS.STOCKCOUNT_APPROVE);

  const [count, setCount] = useState<any>(null);
  const [scanText, setScanText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setCount(await apiFetch(`/api/stock-counts/${id}`));
  }
  useEffect(() => {
    load();
  }, [id]);

  async function run(fn: () => Promise<any>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  function scan() {
    const serialNumbers = scanText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return run(() => apiFetch(`/api/stock-counts/${id}/scan`, { method: "POST", body: JSON.stringify({ serialNumbers }) }), "Đã ghi nhận quét.").then(() => setScanText(""));
  }
  const submit = () => run(() => apiFetch(`/api/stock-counts/${id}/submit`, { method: "POST" }), "Đã trình duyệt.");
  const approve = () => run(() => apiFetch(`/api/stock-counts/${id}/approve`, { method: "POST" }), "Đã duyệt & sinh bút toán điều chỉnh.");

  if (!count) return <p className="text-muted-foreground">Đang tải...</p>;

  const missing = count.lines.filter((l: any) => l.expected && !l.scanned);
  const extra = count.lines.filter((l: any) => !l.expected && l.scanned);
  const matched = count.lines.filter((l: any) => l.expected && l.scanned);
  const editable = count.status === "DRAFT" || count.status === "COUNTING";

  return (
    <div>
      <div className="mb-4">
        <Link href="/stock-counts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách kiểm kê
        </Link>
      </div>
      <PageHeader
        title={`Kiểm kê ${count.number}`}
        description={count.warehouse ? `Kho ${count.warehouse.code} — ${count.warehouse.name}` : ""}
        action={<Badge tone={COUNT_STATUS_TONE[count.status]}>{COUNT_STATUS_LABEL[count.status]}</Badge>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-emerald-600">{matched.length}</div><div className="text-xs text-muted-foreground">Khớp</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-destructive">{missing.length}</div><div className="text-xs text-muted-foreground">Thiếu (kỳ vọng, không thấy)</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-600">{extra.length}</div><div className="text-xs text-muted-foreground">Thừa (thấy, không kỳ vọng)</div></CardContent></Card>
      </div>

      {editable && canWrite && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-4 w-4" /> Quét serial thực tế</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[90px] w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              placeholder={"Quét serial, mỗi dòng 1 serial"}
              autoFocus
            />
            <div className="flex justify-between">
              <Button onClick={scan} disabled={busy || !scanText.trim()}><ScanLine className="h-4 w-4" /> Ghi nhận quét</Button>
              <Button variant="outline" onClick={submit} disabled={busy}><Send className="h-4 w-4" /> Trình duyệt</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {count.status === "PENDING_APPROVAL" && (
        <Card className="mb-4">
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm">Phiếu đang chờ BGĐ duyệt chênh lệch.</span>
            {canApprove && <Button onClick={approve} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Duyệt & điều chỉnh</Button>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Chi tiết đối chiếu ({count.lines.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Serial</TH><TH>Kỳ vọng</TH><TH>Quét thấy</TH><TH>Kết luận</TH><TH>Ghi chú</TH></TR></THead>
            <TBody>
              {count.lines.map((l: any) => {
                const isMissing = l.expected && !l.scanned;
                const isExtra = !l.expected && l.scanned;
                return (
                  <TR key={l.id}>
                    <TD className="font-mono">{l.serialNumber}</TD>
                    <TD>{l.expected ? "Có" : "—"}</TD>
                    <TD>{l.scanned ? "Có" : "—"}</TD>
                    <TD>
                      {isMissing ? <Badge tone="danger">Thiếu</Badge> : isExtra ? <Badge tone="warning">Thừa</Badge> : <Badge tone="success">Khớp</Badge>}
                    </TD>
                    <TD className="text-xs text-muted-foreground">{l.note}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
