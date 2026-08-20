"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/prescription";

const TONE: Record<string, "muted" | "success" | "warning"> = { DRAFT: "warning", ISSUED: "success", CANCELLED: "muted" };

export default function PrescriptionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      setRows(await apiFetch<any[]>(`/api/prescriptions${p.toString() ? `?${p}` : ""}`));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.code?.toLowerCase().includes(s) || r.customer?.fullName?.toLowerCase().includes(s) || r.customer?.code?.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader title="Kê toa (toa chăm sóc)" description="Toa sản phẩm dùng tại nhà + lời dặn, kê sau buổi trị liệu. Tạo toa từ màn Ghi nhận buổi (khối H)." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm mã toa / tên / mã KH..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">— Mọi trạng thái —</option>
          {Object.entries(PRESCRIPTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button variant="outline" onClick={load}>Tải lại</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Mã toa</TH><TH>Khách hàng</TH><TH>Buổi</TH><TH className="text-right">Số SP</TH><TH>Ngày</TH><TH>Trạng thái</TH></TR></THead>
          <TBody>
            {loading ? <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR> :
              filtered.length === 0 ? <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có toa nào</TD></TR> :
              filtered.map((r) => (
                <TR key={r.id} className="cursor-pointer hover:bg-muted/40">
                  <TD className="font-mono font-medium"><Link href={`/prescriptions/${r.id}`} className="text-primary hover:underline">{r.code}</Link></TD>
                  <TD>{r.customer?.fullName} <span className="font-mono text-xs text-muted-foreground">{r.customer?.code}</span></TD>
                  <TD className="text-muted-foreground">{r.session?.code ?? "—"}</TD>
                  <TD className="text-right">{(r.items ?? []).length}</TD>
                  <TD>{formatDate(r.issuedAt || r.createdAt)}</TD>
                  <TD><Badge tone={TONE[r.status] ?? "muted"}>{PRESCRIPTION_STATUS_LABEL[r.status] ?? r.status}</Badge></TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </div></CardContent></Card>
    </div>
  );
}
