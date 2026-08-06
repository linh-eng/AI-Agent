"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

export default function DisassemblyPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.WARRANTY_WRITE);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ parentSerialNumber: "", reason: "" });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch("/api/disassembly")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const o = await apiFetch<{ id: string }>("/api/disassembly", { method: "POST", body: JSON.stringify(form) });
      setOpen(false); router.push(`/disassembly/${o.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Rã máy (tháo dỡ)"
        description="Đề nghị rã → BGĐ duyệt (bắt buộc) → thực hiện đối chiếu as-built BOM → thu hồi linh kiện vào K-TMAY."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Đề nghị rã máy</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Số lệnh</TH><TH>Máy (serial cha)</TH><TH>Lý do</TH><TH>Trạng thái</TH><TH>Ngày</TH></TR></THead>
            <TBody>
              {loading ? <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR> :
                rows.length === 0 ? <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">Chưa có lệnh rã máy</TD></TR> :
                rows.map((o) => (
                  <TR key={o.id}>
                    <TD><Link href={`/disassembly/${o.id}`} className="font-mono font-medium text-primary hover:underline">{o.number}</Link></TD>
                    <TD className="font-mono">{o.parentSerial?.serialNumber ?? "—"}</TD>
                    <TD className="text-muted-foreground">{o.reason ?? "—"}</TD>
                    <TD>{o.executedAt ? <Badge tone="success">Đã rã</Badge> : <Badge tone={DOC_STATUS_TONE[o.status]}>{DOC_STATUS_LABEL[o.status]}</Badge>}</TD>
                    <TD className="text-muted-foreground">{formatDate(o.createdAt)}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Đề nghị rã máy">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Serial máy cần rã *</Label><Input className="font-mono" value={form.parentSerialNumber} onChange={(e) => setForm({ ...form, parentSerialNumber: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Lý do</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Tạo đề nghị</Button></div>
        </form>
      </Modal>
    </div>
  );
}
